import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

/* ═══ النقل الموحّد — الخارطة الموحّدة، المرحلة ٢ ═══
   كل عمل مسند (مهمة، تكليف بحث، أمر صيانة، فرصة، تسجيل جهة، مستند، مهمة نقل)
   يُنقل بنفس الزر ونفس السجل: النقل يغيّر عمود المالك في جدول الكيان نفسه ويقيّد
   سطرًا دائمًا في work_transfers. الحوكمة: المدير العام وحامل قبعة التنفيذي ينفذان
   مباشرة؛ المالك الحالي يطلب النقل بسبب، والطلب يُنفَّذ أو يُرفض من أحدهما. */

const router = Router();

/** سجل الكيانات القابلة للنقل: الجدول، عمود المالك، عمود العنوان، الاسم الظاهر.
    أسماء الجداول والأعمدة ثابتة من هذا السجل حصرًا — لا يصل منها شيء من العميل. */
const ENTITIES: Record<string, { table: string; ownerCol: string; titleCol: string; labelAr: string; openCond: string }> = {
  task:                    { table: "tasks",                    ownerCol: "assigned_to",            titleCol: "title",        labelAr: "مهمة",         openCond: "status NOT IN ('completed','cancelled')" },
  research_assignment:     { table: "research_assignments",     ownerCol: "assigned_to_user_id",    titleCol: "title",        labelAr: "تكليف بحث",    openCond: "status <> 'completed'" },
  maintenance_work_order:  { table: "maintenance_work_orders",  ownerCol: "assigned_technician_id", titleCol: "order_number", labelAr: "أمر صيانة",    openCond: "stage <> 'closed'" },
  transport_task:          { table: "transport_tasks",          ownerCol: "assigned_to",            titleCol: "title",        labelAr: "مهمة نقل",     openCond: "TRUE" },
  opportunity:             { table: "procurement_opportunities",            ownerCol: "claimed_by_user_id",     titleCol: "title",        labelAr: "فرصة",         openCond: "TRUE" },
  government_registration: { table: "government_registrations", ownerCol: "assigned_user_id",       titleCol: "entity_name",  labelAr: "تسجيل جهة",    openCond: "TRUE" },
  company_document:        { table: "company_documents",        ownerCol: "assigned_user_id",       titleCol: "name",         labelAr: "مستند شركة",   openCond: "TRUE" },
};

async function isExecutive(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_positions up JOIN positions p ON p.id = up.position_id
     WHERE up.user_id = $1 AND p.key = 'executive_manager' LIMIT 1`, [userId]);
  return rows.length > 0;
}
async function canTransfer(req: Request): Promise<boolean> {
  return req.session.role === "admin" || (await isExecutive(req.session.userId));
}

/** المالك الحالي لكيان — null إن كان الكيان غير موجود، وقيمة المالك قد تكون null (غير مسنَد) */
async function currentOwner(type: string, id: number): Promise<{ ownerId: number | null; title: string } | null> {
  const e = ENTITIES[type];
  const { rows } = await pool.query(`SELECT ${e.ownerCol} AS owner, ${e.titleCol} AS title FROM ${e.table} WHERE id = $1`, [id]);
  if (!rows.length) return null;
  return { ownerId: rows[0].owner ?? null, title: String(rows[0].title ?? "") };
}

/** تنفيذ النقل: تحديث المالك + قيد السجل — في معاملة واحدة */
async function executeTransfer(opts: {
  type: string; id: number; toUserId: number; reason: string;
  byUserId: number | null; requestId?: number | null;
}): Promise<{ fromUserId: number | null; title: string } | { error: string; code: number }> {
  const e = ENTITIES[opts.type];
  const cur = await currentOwner(opts.type, opts.id);
  if (!cur) return { error: "العمل غير موجود", code: 404 };
  if (cur.ownerId === opts.toUserId) return { error: "العمل مسنَد لهذا الموظف بالفعل", code: 409 };
  const { rows: u } = await pool.query(`SELECT 1 FROM users WHERE id = $1 AND is_active = true`, [opts.toUserId]);
  if (!u.length) return { error: "الموظف المستلم غير موجود أو موقوف", code: 404 };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE ${e.table} SET ${e.ownerCol} = $1 WHERE id = $2`, [opts.toUserId, opts.id]);
    await client.query(
      `INSERT INTO work_transfers (entity_type, entity_id, from_user_id, to_user_id, transferred_by, reason, request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [opts.type, opts.id, cur.ownerId, opts.toUserId, opts.byUserId, opts.reason, opts.requestId ?? null]);
    await client.query("COMMIT");
    return { fromUserId: cur.ownerId, title: cur.title };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    throw err;
  } finally { client.release(); }
}

// أنواع الكيانات (للواجهة)
router.get("/entity-types", (_req: Request, res: Response) => {
  return res.json(Object.entries(ENTITIES).map(([key, e]) => ({ key, labelAr: e.labelAr })));
});

/* ── لوحة الأحمال: الأعمال المفتوحة لكل موظف نشط + قبعاته ── */
router.get("/workload", async (req: Request, res: Response) => {
  if (!(await canTransfer(req))) return res.status(403).json({ error: "لوحة الأحمال للمدير العام أو التنفيذي" });
  try {
    const parts = Object.entries(ENTITIES).map(([key, e]) =>
      `(SELECT COUNT(*)::int FROM ${e.table} WHERE ${e.ownerCol} = u.id AND ${e.openCond}) AS "${key}"`);
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name AS "fullName", u.role,
              COALESCE((SELECT json_agg(p.name_ar ORDER BY p.sort_order) FROM user_positions up JOIN positions p ON p.id = up.position_id WHERE up.user_id = u.id), '[]') AS positions,
              ${parts.join(", ")}
       FROM users u WHERE u.is_active = true ORDER BY u.full_name`);
    const enriched = rows.map((r: any) => ({
      ...r,
      total: Object.keys(ENTITIES).reduce((s, k) => s + Number(r[k] ?? 0), 0),
    }));
    return res.json(enriched);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب لوحة الأحمال" }); }
});

// الأعمال المفتوحة لموظف بعينه (لاختيار ما يُنقل)
router.get("/user/:id/items", async (req: Request, res: Response) => {
  if (!(await canTransfer(req))) return res.status(403).json({ error: "للمدير العام أو التنفيذي" });
  const userId = Number(req.params.id);
  try {
    const parts = Object.entries(ENTITIES).map(([key, e]) =>
      `(SELECT json_agg(json_build_object('entityType', '${key}', 'entityId', id, 'title', ${e.titleCol}))
        FROM (SELECT id, ${e.titleCol} FROM ${e.table} WHERE ${e.ownerCol} = $1 AND ${e.openCond} ORDER BY id DESC LIMIT 50) s${key}) AS "${key}"`);
    const { rows } = await pool.query(`SELECT ${parts.join(", ")}`, [userId]);
    const items: any[] = [];
    for (const key of Object.keys(ENTITIES)) if (rows[0][key]) items.push(...rows[0][key]);
    return res.json(items.map((i) => ({ ...i, typeLabel: ENTITIES[i.entityType].labelAr })));
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الأعمال" }); }
});

// سيرة نقل كيان — المديرون أو طرفا النقل
router.get("/history", async (req: Request, res: Response) => {
  const type = String(req.query.entityType ?? "");
  const id = Number(req.query.entityId);
  if (!ENTITIES[type] || !id) return res.status(400).json({ error: "نوع العمل ومعرّفه مطلوبان" });
  try {
    const manager = await canTransfer(req);
    const { rows } = await pool.query(
      `SELECT wt.id, wt.reason, wt.created_at AS "createdAt",
              fu.full_name AS "fromName", tu.full_name AS "toName", bu.full_name AS "byName",
              wt.from_user_id AS "fromUserId", wt.to_user_id AS "toUserId"
       FROM work_transfers wt
       LEFT JOIN users fu ON fu.id = wt.from_user_id
       JOIN users tu ON tu.id = wt.to_user_id
       LEFT JOIN users bu ON bu.id = wt.transferred_by
       WHERE wt.entity_type = $1 AND wt.entity_id = $2 ORDER BY wt.id`, [type, id]);
    const me = req.session.userId;
    const visible = manager ? rows : rows.filter((r: any) => r.fromUserId === me || r.toUserId === me);
    return res.json(visible);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب سيرة النقل" }); }
});

// آخر تحركات الشركة (شريط المتابعة)
router.get("/recent", async (req: Request, res: Response) => {
  if (!(await canTransfer(req))) return res.status(403).json({ error: "للمدير العام أو التنفيذي" });
  try {
    const { rows } = await pool.query(
      `SELECT wt.id, wt.entity_type AS "entityType", wt.entity_id AS "entityId", wt.reason, wt.created_at AS "createdAt",
              fu.full_name AS "fromName", tu.full_name AS "toName", bu.full_name AS "byName"
       FROM work_transfers wt
       LEFT JOIN users fu ON fu.id = wt.from_user_id
       JOIN users tu ON tu.id = wt.to_user_id
       LEFT JOIN users bu ON bu.id = wt.transferred_by
       ORDER BY wt.id DESC LIMIT 30`);
    return res.json(rows.map((r: any) => ({ ...r, typeLabel: ENTITIES[r.entityType]?.labelAr ?? r.entityType })));
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب التحركات" }); }
});

// النقل المباشر — المدير العام أو التنفيذي، والسبب إلزامي
router.post("/", async (req: Request, res: Response) => {
  if (!(await canTransfer(req))) return res.status(403).json({ error: "النقل للمدير العام أو التنفيذي — اطلب النقل بدلًا من ذلك" });
  const type = String(req.body?.entityType ?? "");
  const id = Number(req.body?.entityId);
  const toUserId = Number(req.body?.toUserId);
  const reason = String(req.body?.reason ?? "").trim();
  if (!ENTITIES[type] || !id || !toUserId) return res.status(400).json({ error: "نوع العمل ومعرّفه والموظف المستلم مطلوبة" });
  if (!reason) return res.status(400).json({ error: "سبب النقل إلزامي — يبقى في سيرة العمل" });
  try {
    const r = await executeTransfer({ type, id, toUserId, reason, byUserId: req.session.userId ?? null });
    if ("error" in r) return res.status(r.code).json({ error: r.error });
    return res.status(201).json({ ok: true, fromUserId: r.fromUserId, title: r.title });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل تنفيذ النقل" }); }
});

/* ── طلبات النقل: الموظف يطلب، والمدير ينفذ أو يرفض ── */
router.post("/requests", async (req: Request, res: Response) => {
  const type = String(req.body?.entityType ?? "");
  const id = Number(req.body?.entityId);
  const reason = String(req.body?.reason ?? "").trim();
  const suggested = req.body?.suggestedToUserId ? Number(req.body.suggestedToUserId) : null;
  if (!ENTITIES[type] || !id) return res.status(400).json({ error: "نوع العمل ومعرّفه مطلوبان" });
  if (!reason) return res.status(400).json({ error: "سبب الطلب إلزامي" });
  try {
    const cur = await currentOwner(type, id);
    if (!cur) return res.status(404).json({ error: "العمل غير موجود" });
    if (cur.ownerId !== req.session.userId && req.session.role !== "admin") {
      return res.status(403).json({ error: "طلب النقل لمالك العمل الحالي فقط" });
    }
    const { rows: dup } = await pool.query(
      `SELECT 1 FROM work_transfer_requests WHERE entity_type = $1 AND entity_id = $2 AND status = 'معلق'`, [type, id]);
    if (dup.length) return res.status(409).json({ error: "يوجد طلب نقل معلق لهذا العمل بالفعل" });
    const { rows } = await pool.query(
      `INSERT INTO work_transfer_requests (entity_type, entity_id, requested_by, suggested_to_user_id, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [type, id, req.session.userId, suggested, reason]);
    return res.status(201).json({ id: rows[0].id });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل إنشاء الطلب" }); }
});

// قائمة الطلبات: المديرون يرون الكل، والموظف طلباته
router.get("/requests", async (req: Request, res: Response) => {
  try {
    const manager = await canTransfer(req);
    const params: any[] = [];
    const cond: string[] = [];
    if (req.query.status) { params.push(req.query.status); cond.push(`r.status = $${params.length}`); }
    if (!manager) { params.push(req.session.userId); cond.push(`r.requested_by = $${params.length}`); }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT r.id, r.entity_type AS "entityType", r.entity_id AS "entityId", r.reason, r.status,
              r.created_at AS "createdAt", r.suggested_to_user_id AS "suggestedToUserId",
              ru.full_name AS "requestedByName", su.full_name AS "suggestedToName", du.full_name AS "decidedByName"
       FROM work_transfer_requests r
       JOIN users ru ON ru.id = r.requested_by
       LEFT JOIN users su ON su.id = r.suggested_to_user_id
       LEFT JOIN users du ON du.id = r.decided_by
       ${where} ORDER BY r.id DESC LIMIT 100`, params);
    return res.json(rows.map((r: any) => ({ ...r, typeLabel: ENTITIES[r.entityType]?.labelAr ?? r.entityType })));
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الطلبات" }); }
});

// تنفيذ طلب — المستلم النهائي إما المقترَح وإما من يحدده المدير
router.post("/requests/:id/approve", async (req: Request, res: Response) => {
  if (!(await canTransfer(req))) return res.status(403).json({ error: "تنفيذ الطلبات للمدير العام أو التنفيذي" });
  const reqId = Number(req.params.id);
  try {
    const { rows } = await pool.query(`SELECT * FROM work_transfer_requests WHERE id = $1`, [reqId]);
    if (!rows.length) return res.status(404).json({ error: "الطلب غير موجود" });
    const r = rows[0];
    if (r.status !== "معلق") return res.status(409).json({ error: "الطلب محسوم بالفعل" });
    const toUserId = req.body?.toUserId ? Number(req.body.toUserId) : (r.suggested_to_user_id ?? null);
    if (!toUserId) return res.status(400).json({ error: "حدّد الموظف المستلم — الطلب بلا اقتراح" });
    const done = await executeTransfer({
      type: r.entity_type, id: r.entity_id, toUserId,
      reason: `تنفيذ طلب نقل: ${r.reason}`, byUserId: req.session.userId ?? null, requestId: reqId,
    });
    if ("error" in done) return res.status(done.code).json({ error: done.error });
    await pool.query(
      `UPDATE work_transfer_requests SET status = 'منفذ', decided_by = $1, decided_at = now() WHERE id = $2`,
      [req.session.userId ?? null, reqId]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل تنفيذ الطلب" }); }
});

router.post("/requests/:id/reject", async (req: Request, res: Response) => {
  if (!(await canTransfer(req))) return res.status(403).json({ error: "رفض الطلبات للمدير العام أو التنفيذي" });
  const reqId = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE work_transfer_requests SET status = 'مرفوض', decided_by = $1, decided_at = now()
       WHERE id = $2 AND status = 'معلق' RETURNING id`,
      [req.session.userId ?? null, reqId]);
    if (!rows.length) return res.status(404).json({ error: "الطلب غير موجود أو محسوم" });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل رفض الطلب" }); }
});

export default router;
