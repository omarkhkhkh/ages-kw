import { Router, type Request, type Response } from "express";
import { desc, ilike, eq, or, sql, and, getTableColumns } from "drizzle-orm";
import { db, pool, practicesTable, insertPracticeSchema, updatePracticeSchema, usersTable } from "@workspace/db";

/* حزمة الممارسات: نفس حزمة المناقصات — المديرون يرون الكل وغيرهم «كل مسؤول يرى مالته» */
async function isManagerHat(req: Request): Promise<boolean> {
  if (req.session.role === "admin") return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_positions up JOIN positions p ON p.id = up.position_id
     WHERE up.user_id = $1 AND p.key IN ('general_manager','executive_manager','financial_manager') LIMIT 1`,
    [req.session.userId]);
  return rows.length > 0;
}
async function isPracticeConsultant(req: Request, practiceId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM practice_assignments WHERE practice_id = $1 AND role = 'المستشار المسؤول' AND user_id = $2`,
    [practiceId, req.session.userId]);
  return rows.length > 0;
}
import { ownRecordsOnly } from "../middleware/auth";

const router = Router();

/* ── LIST ── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query as Record<string, string>;

    const conditions: any[] = [];
    // «كل مسؤول يرى مالته»: الإسناد بالأدوار أو المسنَد القديم أو المنشئ — والمديرون يرون الكل
    if (!(await isManagerHat(req))) {
      const uid = req.session.userId;
      conditions.push(sql`(${practicesTable.assignedUserId} = ${uid}
        OR ${practicesTable.createdByUserId} = ${uid}
        OR EXISTS (SELECT 1 FROM practice_assignments pa WHERE pa.practice_id = ${practicesTable.id} AND pa.user_id = ${uid}))`);
    }
    if (status && status !== "all") conditions.push(eq(practicesTable.status, status));
    if (search) conditions.push(or(
      ilike(practicesTable.projectName,    `%${search}%`),
      ilike(practicesTable.governmentEntity, `%${search}%`),
      ilike(practicesTable.practiceNumber, `%${search}%`),
      ilike(practicesTable.description,    `%${search}%`),
    ));

    let query = db.select({ ...getTableColumns(practicesTable), assignedName: usersTable.fullName })
      .from(practicesTable)
      .leftJoin(usersTable, eq(practicesTable.assignedUserId, usersTable.id))
      .$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));

    const rows = await query.orderBy(desc(practicesTable.createdAt));
    // إثراء: المستشار المسؤول (الأدوار) + حالة الملف + إنذار الكفالة
    const ids = rows.map((r: any) => r.id);
    const consultantOf = new Map<number, string>();
    const caseStatusOf = new Map<number, string>();
    const contractOf = new Map<number, number>();
    if (ids.length) {
      const { rows: cons } = await pool.query(
        `SELECT pa.practice_id AS id, u.full_name AS name FROM practice_assignments pa
         JOIN users u ON u.id = pa.user_id WHERE pa.role = 'المستشار المسؤول' AND pa.practice_id = ANY($1::int[])`, [ids]);
      for (const c of cons) consultantOf.set(Number(c.id), c.name);
      const { rows: cases } = await pool.query(
        `SELECT entity_id AS id, status FROM case_files WHERE entity_type = 'practice' AND entity_id = ANY($1::int[])`, [ids]);
      for (const c of cases) caseStatusOf.set(Number(c.id), c.status);
      const { rows: cts } = await pool.query(
        `SELECT practice_id AS id, MAX(id) AS cid FROM contracts WHERE practice_id = ANY($1::int[]) GROUP BY practice_id`, [ids]);
      for (const c of cts) contractOf.set(Number(c.id), Number(c.cid));
    }
    const today = Date.now();
    return res.json(rows.map((r: any) => ({
      ...r,
      consultantName: consultantOf.get(r.id) ?? null,
      caseStatus: caseStatusOf.get(r.id) ?? null,
      contractId: contractOf.get(r.id) ?? null,
      bondAlert: !!(r.bondValue && !r.initialBondIssued && r.deadline
        && (new Date(r.deadline).getTime() - today) / 86400000 <= 3
        && !["submitted", "under_evaluation", "won", "lost", "cancelled"].includes(r.status)),
    })));
  } catch {
    return res.status(500).json({ error: "فشل في جلب الممارسات" });
  }
});

/* ── STATS (بنمط إحصائيات المناقصات تمامًا) ── */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const privacy = ownRecordsOnly(req)
      ? sql`assigned_user_id = ${req.session.userId}`
      : sql`true`;
    // قائمة ثابتة من الكود — تُدرج حرفيًا (تمرير مصفوفة عبر قالب sql`` يكسر ANY)
    const activeStatusesList = sql.raw(
      ["new", "studying", "requesting_quotes", "preparing_technical", "preparing_financial", "management_review", "ready_to_submit", "under_evaluation"]
        .map((s) => `'${s}'`).join(", "),
    );
    const [totals] = await db.select({
      total:           sql<number>`count(*)::int`,
      urgentCount:     sql<number>`count(*) filter (where deadline IS NOT NULL AND deadline >= current_date AND deadline <= current_date + interval '7 days' AND status IN (${activeStatusesList}))::int`,
      wonCount:        sql<number>`count(*) filter (where status='won')::int`,
      lostCount:       sql<number>`count(*) filter (where status='lost')::int`,
      totalOfferValue: sql<string>`coalesce(sum(offer_value), 0)::text`,
      submittedCount:  sql<number>`count(*) filter (where is_submitted)::int`,
    }).from(practicesTable).where(privacy);
    const decided = (totals.wonCount ?? 0) + (totals.lostCount ?? 0);
    return res.json({
      ...totals,
      winRate: decided > 0 ? Math.round(((totals.wonCount ?? 0) / decided) * 1000) / 10 : 0,
    });
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات الممارسات" });
  }
});

/* ── helper: validate numeric ID ── */
function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ── GET ONE ── */
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select().from(practicesTable).where(eq(practicesTable.id, id));
    if (!row) return res.status(404).json({ error: "الممارسة غير موجودة" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الممارسة" });
  }
});

/* ── CREATE ── */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertPracticeSchema.parse(req.body);
    // المُنشئ يصبح المسؤول افتراضيًا (إلا إذا حدّد المدير مسؤولًا في النموذج)؛ المدير وحده يعيد التعيين لاحقًا
    const assignedUserId = req.session.role === "admin" && data.assignedUserId != null
      ? Number(data.assignedUserId)
      : (req.session.userId ?? null);
    const [row] = await db.insert(practicesTable).values({ ...data, assignedUserId, createdByUserId: req.session.userId ?? null }).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الممارسة" });
  }
});

/* ── UPDATE ── */
// Fields a responsible employee (without canEdit) is allowed to patch on their own practice.
const OWNER_ALLOWED_FIELDS = new Set([
  "status", "fileConditions", "filePricing", "fileSuppliers", "fileOpening",
]);

router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });

  const session = req.session as any;
  const isAdmin = session.role === "admin";
  const hasCanEdit = !!session.canEdit;

  try {
    // Fetch current record to validate ownership before applying changes
    const [existing] = await db.select().from(practicesTable).where(eq(practicesTable.id, id));
    if (!existing) return res.status(404).json({ error: "الممارسة غير موجودة" });

    const isOwner = session.fullName && existing.responsibleEmployee === session.fullName;

    // Authorization: admin and canEdit users can update anything.
    // Responsible employee (owner) can only update status and file fields.
    if (!isAdmin && !hasCanEdit) {
      if (!isOwner) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل هذه الممارسة." });
      }
      const requestedFields = Object.keys(req.body);
      const forbidden = requestedFields.filter(f => !OWNER_ALLOWED_FIELDS.has(f));
      if (forbidden.length > 0) {
        return res.status(403).json({ error: `الموظف المسؤول لا يملك صلاحية تعديل: ${forbidden.join(", ")}` });
      }
    }

    // تغيير الحالة يدويًا: للمديرين الثلاثة والمستشار المسؤول (والمسنَد القديم) — ويُقيَّد في السيرة
    if (req.body.status !== undefined && req.body.status !== existing.status) {
      const allowed = (await isManagerHat(req)) || (await isPracticeConsultant(req, id))
        || existing.assignedUserId === req.session.userId;
      if (!allowed) return res.status(403).json({ error: "تغيير حالة الممارسة للمديرين أو المستشار المسؤول عنها" });
      pool.query(
        `INSERT INTO case_file_events (case_file_id, event, details, actor_user_id)
         SELECT cf.id, 'تغيير حالة الممارسة يدويًا', $1, $2 FROM case_files cf
         WHERE cf.entity_type = 'practice' AND cf.entity_id = $3`,
        [`← ${req.body.status}`, req.session.userId ?? null, id]).catch(() => {});
    }
    const data = updatePracticeSchema.parse(req.body) as Record<string, any>;
    // إعادة تعيين الموظف المسؤول للمدير فقط
    if (!isAdmin) delete data.assignedUserId;
    const [row] = await db.update(practicesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(practicesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "الممارسة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الممارسة" });
  }
});

/* ── الإسنادات الحقيقية (نفس أدوار المناقصات) ── */
router.get("/:id/assignments", async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT pa.id, pa.role, pa.user_id AS "userId", u.full_name AS "userName"
     FROM practice_assignments pa JOIN users u ON u.id = pa.user_id WHERE pa.practice_id = $1 ORDER BY pa.role`,
    [Number(req.params.id)]);
  return res.json(rows);
});
router.post("/:id/assignments", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const role = String(req.body?.role ?? "");
  const userId = Number(req.body?.userId);
  if (!["المستشار المسؤول", "منسق مشتريات", "منسق مالي", "منسق نقل"].includes(role) || !userId) {
    return res.status(400).json({ error: "الدور والموظف مطلوبان" });
  }
  if (!(await isManagerHat(req))) return res.status(403).json({ error: "الإسناد للمديرين" });
  const { rows: u } = await pool.query(`SELECT 1 FROM users WHERE id = $1 AND is_active = true`, [userId]);
  if (!u.length) return res.status(404).json({ error: "الموظف غير موجود أو موقوف" });
  await pool.query(
    `INSERT INTO practice_assignments (practice_id, role, user_id) VALUES ($1,$2,$3)
     ON CONFLICT (practice_id, role) DO UPDATE SET user_id = EXCLUDED.user_id, created_at = now()`, [id, role, userId]);
  const { createNotification } = await import("./notifications");
  createNotification({ recipientUserId: userId, type: "practice_assigned", message: `أُسندت إليك ممارسة بدور «${role}»`, link: `/practices/${id}` }).catch(() => {});
  return res.status(201).json({ ok: true });
});
router.delete("/:id/assignments/:role", async (req: Request, res: Response) => {
  if (!(await isManagerHat(req))) return res.status(403).json({ error: "الإسناد للمديرين" });
  await pool.query(`DELETE FROM practice_assignments WHERE practice_id = $1 AND role = $2`,
    [Number(req.params.id), String(req.params.role)]);
  return res.status(204).send();
});

/* ── تسجيل الكفالة الأولية — ضمان «ابتدائية» مربوط بالممارسة ── */
router.post("/:id/issue-bond", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const guaranteeNumber = String(req.body?.guaranteeNumber ?? "").trim();
  const bankName = String(req.body?.bankName ?? "").trim();
  if (!guaranteeNumber || !bankName) return res.status(400).json({ error: "رقم الكفالة والبنك مطلوبان" });
  if (!(await isManagerHat(req)) && !(await isPracticeConsultant(req, id))) {
    return res.status(403).json({ error: "تسجيل الكفالة للمديرين أو المستشار المسؤول" });
  }
  const { rows: tr } = await pool.query(`SELECT bond_value, initial_bond_issued FROM practices WHERE id = $1`, [id]);
  if (!tr.length) return res.status(404).json({ error: "الممارسة غير موجودة" });
  if (tr[0].initial_bond_issued) return res.status(409).json({ error: "الكفالة مسجَّلة بالفعل" });
  const issueDate = req.body?.issueDate ? String(req.body.issueDate) : new Date().toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // المستشار يعبي البيانات؛ المسؤولية في السجل للمدير المالي (وإلا التنفيذي)
    const { rows: own } = await client.query(
      `SELECT up.user_id FROM user_positions up JOIN positions p ON p.id = up.position_id
       WHERE p.key IN ('financial_manager','executive_manager')
       ORDER BY CASE p.key WHEN 'financial_manager' THEN 0 ELSE 1 END LIMIT 1`);
    const { rows: g } = await client.query(
      `INSERT INTO bank_guarantees (practice_id, guarantee_number, type, bank_name, amount, issue_date, expiry_date, status, assigned_user_id)
       VALUES ($1,$2,'ابتدائية',$3,$4,$5,$6,'active',$7) RETURNING id`,
      [id, guaranteeNumber, bankName, tr[0].bond_value, issueDate, req.body?.expiryDate || null, own[0]?.user_id ?? req.session.userId ?? null]);
    await client.query(
      `UPDATE practices SET initial_bond_issued = true, initial_bond_number = $1, initial_bond_bank = $2,
              initial_bond_issue_date = $3, initial_bond_guarantee_id = $4, updated_at = now() WHERE id = $5`,
      [guaranteeNumber, bankName, issueDate, g[0].id, id]);
    await client.query("COMMIT");
    return res.status(201).json({ ok: true, guaranteeId: g[0].id });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل تسجيل الكفالة" });
  } finally { client.release(); }
});

/* ── DELETE ── */
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(practicesTable).where(eq(practicesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الممارسة" });
  }
});

export default router;
