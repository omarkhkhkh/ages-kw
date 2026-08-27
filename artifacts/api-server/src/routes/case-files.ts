import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

/* ═══ ملف الحالة — الخارطة الموحّدة، المرحلة ٣ ═══
   رحلة المناقصة/الممارسة: إعلان مسار التوريد (بوابة) ← قيد العمل ← تقديم للاعتماد ←
   [إيقاف مالي بسبب مُلزم] ← قرار المدير العام (قبول/رفض) — وتجاوزُه لإيقافٍ قائم
   يُسجَّل باسمه صراحةً. المدير التنفيذي مُطَّلِع لا بوابة. كل حدث في سيرة دائمة.
   قاعدة تخطّي الرافع: المدير المالي لا يوقف ملفًا رفعه هو — رقابته عليه للمدير العام. */

const router = Router();

const ENTITY: Record<string, { table: string; titleExpr: string }> = {
  tender:   { table: "tenders",   titleExpr: "tender_number || ' — ' || project_name" },
  practice: { table: "practices", titleExpr: "practice_number || ' — ' || COALESCE(title,'')" },
};

const ACTIVE = ["مفتوح", "قيد العمل"];

async function hasHat(userId: number | undefined, key: string): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_positions up JOIN positions p ON p.id = up.position_id
     WHERE up.user_id = $1 AND p.key = $2 LIMIT 1`, [userId, key]);
  return rows.length > 0;
}
const isGM = async (req: Request) => req.session.role === "admin" || (await hasHat(req.session.userId, "general_manager"));
const isCFO = async (req: Request) => hasHat(req.session.userId, "financial_manager");
const isExec = async (req: Request) => hasHat(req.session.userId, "executive_manager");
/** المطّلعون على كل الملفات: العام والتنفيذي والمالي */
const isOverseer = async (req: Request) => (await isGM(req)) || (await isExec(req)) || (await isCFO(req));

async function logEvent(caseId: number, event: string, details: string | null, actor: number | null) {
  await pool.query(
    `INSERT INTO case_file_events (case_file_id, event, details, actor_user_id) VALUES ($1,$2,$3,$4)`,
    [caseId, event, details, actor]);
}

async function entityTitle(type: string, id: number): Promise<string | null> {
  const e = ENTITY[type];
  const { rows } = await pool.query(`SELECT ${e.titleExpr} AS t FROM ${e.table} WHERE id = $1`, [id]);
  return rows.length ? String(rows[0].t) : null;
}

const CASE_SELECT = `
  cf.id, cf.entity_type AS "entityType", cf.entity_id AS "entityId",
  cf.sourcing_path AS "sourcingPath", cf.status, cf.prev_status AS "prevStatus",
  cf.hold_reason AS "holdReason", cf.held_at AS "heldAt", cf.gm_override AS "gmOverride",
  cf.decision_note AS "decisionNote", cf.outcome, cf.submitted_at AS "submittedAt", cf.decided_at AS "decidedAt",
  cf.own_source_supplier_id AS "ownSourceSupplierId", cf.researcher_user_id AS "researcherUserId",
  cf.research_assignment_id AS "researchAssignmentId", cf.raised_by AS "raisedBy",
  ru.full_name AS "raisedByName", hu.full_name AS "heldByName", du.full_name AS "decidedByName",
  su.full_name AS "researcherName", sp.name AS "ownSourceSupplierName", sp.status AS "ownSourceSupplierStatus"`;
const CASE_JOINS = `
  LEFT JOIN users ru ON ru.id = cf.raised_by
  LEFT JOIN users hu ON hu.id = cf.held_by
  LEFT JOIN users du ON du.id = cf.decided_by
  LEFT JOIN users su ON su.id = cf.researcher_user_id
  LEFT JOIN suppliers sp ON sp.id = cf.own_source_supplier_id`;

async function getCase(type: string, id: number) {
  const { rows } = await pool.query(
    `SELECT ${CASE_SELECT} FROM case_files cf ${CASE_JOINS} WHERE cf.entity_type = $1 AND cf.entity_id = $2`, [type, id]);
  return rows[0] ?? null;
}

/** رؤية الملف: المطّلعون الثلاثة، أو رافعه، أو باحثه — قاعدة «المشارك يرى ملفه» */
async function canSee(req: Request, cf: any): Promise<boolean> {
  if (await isOverseer(req)) return true;
  const me = req.session.userId;
  return cf.raisedBy === me || cf.researcherUserId === me;
}

// ملف كيان (يُنشأ ضمنيًا عند أول إعلان مسار — هنا قراءة فقط)
router.get("/by-entity", async (req: Request, res: Response) => {
  const type = String(req.query.entityType ?? "");
  const id = Number(req.query.entityId);
  if (!ENTITY[type] || !id) return res.status(400).json({ error: "نوع الكيان ومعرّفه مطلوبان" });
  try {
    const cf = await getCase(type, id);
    if (!cf) return res.json(null); // لا ملف بعد — الواجهة تعرض بوابة الإعلان
    if (!(await canSee(req, cf))) return res.status(403).json({ error: "هذا الملف لمشاركيه ومطّلعيه" });
    const { rows: events } = await pool.query(
      `SELECT e.id, e.event, e.details, e.created_at AS "createdAt", u.full_name AS "actorName"
       FROM case_file_events e LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.case_file_id = $1 ORDER BY e.id`, [cf.id]);
    return res.json({ ...cf, title: await entityTitle(type, id), events });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الملف" }); }
});

// قوائم الملفات — للمطّلعين الثلاثة
router.get("/", async (req: Request, res: Response) => {
  if (!(await isOverseer(req))) return res.status(403).json({ error: "قوائم الملفات للمديرين" });
  try {
    const params: any[] = [];
    let where = "";
    if (req.query.status) { params.push(req.query.status); where = `WHERE cf.status = $1`; }
    const { rows } = await pool.query(
      `SELECT ${CASE_SELECT} FROM case_files cf ${CASE_JOINS} ${where} ORDER BY cf.updated_at DESC LIMIT 200`, params);
    const withTitles = await Promise.all(rows.map(async (r: any) => ({ ...r, title: await entityTitle(r.entityType, r.entityId) })));
    return res.json(withTitles);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الملفات" }); }
});

/* ── بوابة إعلان مسار التوريد — تُنشئ الملف وتحدد رافعه ── */
router.post("/declare-sourcing", async (req: Request, res: Response) => {
  const type = String(req.body?.entityType ?? "");
  const id = Number(req.body?.entityId);
  const path = String(req.body?.sourcingPath ?? "");
  if (!ENTITY[type] || !id) return res.status(400).json({ error: "نوع الكيان ومعرّفه مطلوبان" });
  if (!["فريق البحث", "مصدر خاص"].includes(path)) return res.status(400).json({ error: "مسار التوريد: «فريق البحث» أو «مصدر خاص»" });
  const title = await entityTitle(type, id);
  if (title === null) return res.status(404).json({ error: "الكيان غير موجود" });

  const client = await pool.connect();
  try {
    let researcherId: number | null = null;
    let supplierId: number | null = null;
    if (path === "فريق البحث") {
      researcherId = Number(req.body?.researcherUserId);
      if (!researcherId) return res.status(400).json({ error: "اختر الباحث — المستشار يختار باحثه بنفسه" });
      const { rows } = await pool.query(`SELECT 1 FROM users WHERE id = $1 AND is_active = true`, [researcherId]);
      if (!rows.length) return res.status(404).json({ error: "الباحث غير موجود أو موقوف" });
    } else {
      supplierId = Number(req.body?.supplierId);
      if (!supplierId) return res.status(400).json({ error: "المصدر الخاص يجب أن يكون مورّدًا مسجَّلًا — أضفه أولًا (الاسم والهاتف يكفيان)" });
      const { rows } = await pool.query(`SELECT name FROM suppliers WHERE id = $1`, [supplierId]);
      if (!rows.length) return res.status(404).json({ error: "المورد غير موجود" });
    }

    const existing = await getCase(type, id);
    if (existing && !ACTIVE.includes(existing.status)) {
      return res.status(409).json({ error: `لا يُعاد إعلان المسار وملفُ الحالة «${existing.status}»` });
    }
    // إعادة الإعلان مسموحة لرافع الملف أو المديرين
    if (existing && existing.raisedBy !== req.session.userId && !(await isOverseer(req))) {
      return res.status(403).json({ error: "إعلان المسار لرافع الملف أو المديرين" });
    }

    await client.query("BEGIN");
    let caseId: number;
    if (existing) {
      caseId = existing.id;
      await client.query(
        `UPDATE case_files SET sourcing_path=$1, own_source_supplier_id=$2, researcher_user_id=$3,
                status='قيد العمل', updated_at=now() WHERE id=$4`,
        [path, supplierId, researcherId, caseId]);
    } else {
      const { rows } = await client.query(
        `INSERT INTO case_files (entity_type, entity_id, raised_by, sourcing_path, own_source_supplier_id, researcher_user_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,'قيد العمل') RETURNING id`,
        [type, id, req.session.userId ?? null, path, supplierId, researcherId]);
      caseId = rows[0].id;
    }
    // مسار البحث: تكليف مربوط بالملف للباحث الذي اختاره المستشار (يظهر في لوحة الأحمال وقابل للنقل)
    if (path === "فريق البحث" && researcherId) {
      const { rows: ra } = await client.query(
        `INSERT INTO research_assignments (title, description, assigned_to_user_id, assigned_by_user_id, linked_entity_type, linked_entity_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING id`,
        [`بحث: ${title}`.slice(0, 200), `تكليف مولَّد من ملف الحالة — اجمع العروض والمواصفات ولا تُسعّر.`,
         researcherId, req.session.userId ?? null, type, id]);
      await client.query(`UPDATE case_files SET research_assignment_id = $1 WHERE id = $2`, [ra[0].id, caseId]);
    }
    await client.query("COMMIT");
    await logEvent(caseId, existing ? "إعادة إعلان مسار التوريد" : "فتح الملف وإعلان مسار التوريد",
      path === "فريق البحث" ? `فريق البحث — الباحث المختار #${researcherId}` : `مصدر خاص — المورد #${supplierId} (ظاهر للمديرَين)`,
      req.session.userId ?? null);
    return res.status(existing ? 200 : 201).json(await getCase(type, id));
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل إعلان مسار التوريد" });
  } finally { client.release(); }
});

/* ── تقديم للاعتماد — لرافع الملف (أو المديرين)، بعد إعلان المسار ── */
router.post("/:id/submit", async (req: Request, res: Response) => {
  const caseId = Number(req.params.id);
  try {
    const { rows } = await pool.query(`SELECT * FROM case_files WHERE id = $1`, [caseId]);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });
    const cf = rows[0];
    if (cf.raised_by !== req.session.userId && !(await isOverseer(req))) {
      return res.status(403).json({ error: "التقديم لرافع الملف" });
    }
    if (!cf.sourcing_path) return res.status(400).json({ error: "أعلن مسار التوريد أولًا — بوابة إلزامية" });
    if (!ACTIVE.includes(cf.status)) return res.status(409).json({ error: `الملف «${cf.status}» — لا يُقدَّم` });
    await pool.query(
      `UPDATE case_files SET status='بانتظار الاعتماد', submitted_by=$1, submitted_at=now(), updated_at=now() WHERE id=$2`,
      [req.session.userId ?? null, caseId]);
    await logEvent(caseId, "تقديم للاعتماد", null, req.session.userId ?? null);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل التقديم" }); }
});

/* ── الإيقاف المالي — المدير المالي، بسبب مُلزم، ولا يوقف ملفًا رفعه هو ── */
router.post("/:id/hold", async (req: Request, res: Response) => {
  const caseId = Number(req.params.id);
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) return res.status(400).json({ error: "سبب الإيقاف إلزامي — يظهر لمالك الملف" });
  try {
    if (!(await isCFO(req)) && req.session.role !== "admin") {
      return res.status(403).json({ error: "الإيقاف المالي للمدير المالي" });
    }
    const { rows } = await pool.query(`SELECT * FROM case_files WHERE id = $1`, [caseId]);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });
    const cf = rows[0];
    // قاعدة تخطّي الرافع: لا يوقف المالي ملفًا رفعه هو — رقابته عليه للمدير العام
    if (cf.raised_by === req.session.userId && req.session.role !== "admin") {
      return res.status(409).json({ error: "لا توقف ملفًا رفعتَه أنت — رقابته للمدير العام (قاعدة تخطّي الرافع)" });
    }
    if (cf.status === "موقوف ماليًا") return res.status(409).json({ error: "الملف موقوف بالفعل" });
    if (["معتمد", "مرفوض", "مغلق"].includes(cf.status)) return res.status(409).json({ error: `الملف «${cf.status}» — محسوم` });
    await pool.query(
      `UPDATE case_files SET prev_status=status, status='موقوف ماليًا', hold_reason=$1, held_by=$2, held_at=now(), updated_at=now() WHERE id=$3`,
      [reason, req.session.userId ?? null, caseId]);
    await logEvent(caseId, "إيقاف مالي", reason, req.session.userId ?? null);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل الإيقاف" }); }
});

/* ── رفع الإيقاف — المالي نفسه، أو المدير العام (تجاوز يُسجَّل) ── */
router.post("/:id/release-hold", async (req: Request, res: Response) => {
  const caseId = Number(req.params.id);
  try {
    const gm = await isGM(req);
    const cfo = await isCFO(req);
    if (!gm && !cfo) return res.status(403).json({ error: "رفع الإيقاف للمدير المالي أو المدير العام" });
    const { rows } = await pool.query(`SELECT * FROM case_files WHERE id = $1`, [caseId]);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });
    const cf = rows[0];
    if (cf.status !== "موقوف ماليًا") return res.status(409).json({ error: "الملف غير موقوف" });
    const isOverride = !cfo && gm && cf.held_by !== req.session.userId;
    await pool.query(
      `UPDATE case_files SET status=COALESCE(prev_status,'قيد العمل'), prev_status=NULL, hold_reason=NULL, held_by=NULL, held_at=NULL,
              gm_override = gm_override OR $1, updated_at=now() WHERE id=$2`,
      [isOverride, caseId]);
    await logEvent(caseId, isOverride ? "تجاوز المدير العام — رفع إيقافًا ماليًا" : "رفع الإيقاف المالي",
      isOverride ? "سلطة التجاوز المطلقة — مسجَّلة باسمه" : null, req.session.userId ?? null);
    return res.json({ ok: true, override: isOverride });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل رفع الإيقاف" }); }
});

/* ── قرار المدير العام: اعتماد أو رفض — والاعتماد فوق إيقافٍ قائم تجاوزٌ مسجَّل ── */
async function decide(req: Request, res: Response, approve: boolean) {
  const caseId = Number(req.params.id);
  const note = String(req.body?.note ?? "").trim() || null;
  try {
    if (!(await isGM(req))) return res.status(403).json({ error: "القرار النهائي للمدير العام" });
    const { rows } = await pool.query(`SELECT * FROM case_files WHERE id = $1`, [caseId]);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });
    const cf = rows[0];
    if (["معتمد", "مرفوض", "مغلق"].includes(cf.status)) return res.status(409).json({ error: `الملف «${cf.status}» — محسوم` });
    if (!approve && !note) return res.status(400).json({ error: "سبب الرفض إلزامي — يعود به الملف لرافعه" });
    const overHold = cf.status === "موقوف ماليًا";
    await pool.query(
      `UPDATE case_files SET status=$1, decided_by=$2, decided_at=now(), decision_note=$3,
              gm_override = gm_override OR $4,
              prev_status=NULL, hold_reason=NULL, held_by=NULL, held_at=NULL, updated_at=now() WHERE id=$5`,
      [approve ? "معتمد" : "مرفوض", req.session.userId ?? null, note, overHold, caseId]);
    await logEvent(caseId,
      approve ? (overHold ? "اعتماد بتجاوز إيقاف مالي قائم" : "اعتماد نهائي") : "رفض",
      note ?? (overHold ? "سلطة التجاوز المطلقة — مسجَّلة باسمه" : null),
      req.session.userId ?? null);
    return res.json({ ok: true, override: overHold });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل تسجيل القرار" }); }
}
router.post("/:id/approve", (req, res) => decide(req, res, true));
router.post("/:id/reject", (req, res) => decide(req, res, false));


/* ═══ المرحلة ٤: بوابتا الإغلاق + بطاقة «من ذاكرة الشركة» ═══ */

/** جلسة فض العطاء لكيان — البوابة الأولى للإغلاق */
async function bidSessionOf(type: string, id: number): Promise<{ id: number; entries: number } | null> {
  const col = type === "tender" ? "tender_id" : "practice_id";
  const { rows } = await pool.query(
    `SELECT br.id, (SELECT COUNT(*)::int FROM bid_entries be WHERE be.bid_result_id = br.id) AS entries
     FROM bid_results br WHERE br.source_type = $1 AND br.${col} = $2 ORDER BY br.id DESC LIMIT 1`, [type, id]);
  return rows.length ? { id: rows[0].id, entries: Number(rows[0].entries) } : null;
}

// جاهزية الإغلاق: هل الجلسة مسجلة؟ (تستخدمها الواجهة قبل فتح نافذة الإغلاق)
router.get("/:id/closure-readiness", async (req: Request, res: Response) => {
  const caseId = Number(req.params.id);
  try {
    const { rows } = await pool.query(`SELECT * FROM case_files WHERE id = $1`, [caseId]);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });
    const cf = rows[0];
    const cfView = await getCase(cf.entity_type, cf.entity_id);
    if (!(await canSee(req, cfView))) return res.status(403).json({ error: "هذا الملف لمشاركيه ومطّلعيه" });
    const session = await bidSessionOf(cf.entity_type, cf.entity_id);
    return res.json({ hasBidSession: !!session, bidEntries: session?.entries ?? 0, status: cf.status });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل فحص الجاهزية" }); }
});

/* ── الإغلاق ببوابتين: فوز/خسارة تتطلب جلسة الفض + الدرس؛ الانسحاب يُعفى من الجلسة ── */
router.post("/:id/close", async (req: Request, res: Response) => {
  const caseId = Number(req.params.id);
  const outcome = String(req.body?.outcome ?? "");
  const reasons = String(req.body?.reasons ?? "").trim();
  const lessons = String(req.body?.lessons ?? "").trim();
  if (!["فوز", "خسارة", "انسحاب"].includes(outcome)) {
    return res.status(400).json({ error: "النتيجة: «فوز» أو «خسارة» أو «انسحاب»" });
  }
  const client = await pool.connect();
  try {
    const { rows } = await pool.query(`SELECT * FROM case_files WHERE id = $1`, [caseId]);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });
    const cf = rows[0];
    if (cf.raised_by !== req.session.userId && !(await isOverseer(req))) {
      return res.status(403).json({ error: "الإغلاق لرافع الملف أو المديرين" });
    }
    if (cf.status === "مغلق") return res.status(409).json({ error: "الملف مغلق بالفعل" });
    if (cf.status === "موقوف ماليًا") return res.status(409).json({ error: "الملف موقوف ماليًا — يُرفع الإيقاف قبل الإغلاق" });

    // البوابة الأولى: جلسة فض العطاء — إلزامية للفوز والخسارة، والانسحاب قبل التقديم يُعفى
    let session: { id: number; entries: number } | null = null;
    if (outcome !== "انسحاب") {
      session = await bidSessionOf(cf.entity_type, cf.entity_id);
      if (!session) {
        return res.status(409).json({ error: "بوابة الإغلاق: سجّل جلسة فض العطاء أولًا (تبويب فض العطاء) — من نافسنا وبكم ومن فاز. الأرشيف يكتمل بحكم الدورة لا بحكم الهمّة." });
      }
      if (session.entries === 0) {
        return res.status(409).json({ error: "جلسة الفض بلا شركات — أدخل المتنافسين وأسعارهم قبل الإغلاق" });
      }
    }
    // البوابة الثانية: الدرس المستفاد — الأسباب إلزامية دائمًا، والدروس عند الخسارة على الأقل
    if (!reasons) return res.status(400).json({ error: "بوابة الإغلاق: اكتب أسباب النتيجة — تدخل مركز المعرفة" });
    if (outcome === "خسارة" && !lessons) return res.status(400).json({ error: "الخسارة بلا درس خسارتان — اكتب الدروس المستفادة" });

    const title = (await entityTitle(cf.entity_type, cf.entity_id)) ?? `#${cf.entity_id}`;
    // أسماء المنافسين تُسحب من الجلسة تلقائيًا (لا إدخال يدوي مكرر)
    let competitorNames: string | null = null;
    if (session) {
      const { rows: comps } = await pool.query(
        `SELECT string_agg(company_name, '، ') AS names FROM bid_entries WHERE bid_result_id = $1 AND is_us = false`, [session.id]);
      competitorNames = comps[0]?.names ?? null;
    }
    const outcomeMap: Record<string, string> = { "فوز": "won", "خسارة": "lost", "انسحاب": "other" };

    await client.query("BEGIN");
    const { rows: ke } = await client.query(
      `INSERT INTO knowledge_entries (tender_id, practice_id, title, outcome, reasons, lessons_learned, competitor_names, tags, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [cf.entity_type === "tender" ? cf.entity_id : null,
       cf.entity_type === "practice" ? cf.entity_id : null,
       `${outcome}: ${title}`.slice(0, 300), outcomeMap[outcome], reasons, lessons || null,
       competitorNames, "إغلاق ملف", req.session.userId ?? null]);
    await client.query(
      `UPDATE case_files SET status='مغلق', outcome=$1, bid_result_id=$2, knowledge_entry_id=$3, updated_at=now() WHERE id=$4`,
      [outcome, session?.id ?? null, ke[0].id, caseId]);
    await client.query("COMMIT");
    await logEvent(caseId, `إغلاق الملف — ${outcome}`,
      outcome === "انسحاب"
        ? "انسحاب قبل التقديم — مُعفى من جلسة الفض"
        : `جلسة الفض #${session!.id} (${session!.entries} شركة) + الدرس المستفاد #${ke[0].id}${competitorNames ? " — نافسنا: " + competitorNames : ""}`,
      req.session.userId ?? null);
    // تلميح تقييم الموردين: مصدر الملف الخاص إن وُجد
    return res.json({
      ok: true, outcome, knowledgeEntryId: ke[0].id, bidResultId: session?.id ?? null,
      evaluateSupplierId: cf.own_source_supplier_id ?? null,
      nextStep: outcome === "فوز" ? "التحويل إلى عقد نشط يأتي في المرحلة الخامسة" : null,
    });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل إغلاق الملف" });
  } finally { client.release(); }
});

/* ── بطاقة «من ذاكرة الشركة» — تُدفع لحظة فتح الملف، لا تُسأل ── */
router.get("/memory-card", async (req: Request, res: Response) => {
  const type = String(req.query.entityType ?? "");
  const id = Number(req.query.entityId);
  if (!ENTITY[type] || !id) return res.status(400).json({ error: "نوع الكيان ومعرّفه مطلوبان" });
  try {
    // جهة الكيان (المناقصات والممارسات كلتاهما تحملان government_entity_id)
    const { rows: ent } = await pool.query(
      `SELECT government_entity_id AS gid FROM ${ENTITY[type].table} WHERE id = $1`, [id]);
    if (!ent.length) return res.status(404).json({ error: "الكيان غير موجود" });
    const gid = ent[0].gid;
    if (!gid) return res.json({ hasHistory: false, note: "لا جهة محددة للكيان — اربطه بجهة ليعمل استرجاع الذاكرة" });

    // كل جلسات الفض السابقة مع نفس الجهة (مناقصات وممارسات) — عدا الكيان الحالي
    const { rows: sessions } = await pool.query(
      `SELECT br.id,
              MAX(CASE WHEN be.is_us THEN be.total_price END) AS our_price,
              MAX(CASE WHEN be.is_winner THEN be.total_price END) AS winner_price,
              BOOL_OR(be.is_us AND be.is_winner) AS we_won
       FROM bid_results br
       JOIN bid_entries be ON be.bid_result_id = br.id
       LEFT JOIN tenders t ON t.id = br.tender_id
       LEFT JOIN practices pr ON pr.id = br.practice_id
       WHERE COALESCE(t.government_entity_id, pr.government_entity_id) = $1
         AND NOT (br.source_type = $2 AND COALESCE(br.tender_id, br.practice_id) = $3)
       GROUP BY br.id`, [gid, type, id]);

    const total = sessions.length;
    const wins = sessions.filter((s: any) => s.we_won).length;
    const gaps = sessions
      .filter((s: any) => !s.we_won && s.our_price != null && s.winner_price != null && Number(s.our_price) > 0)
      .map((s: any) => ((Number(s.our_price) - Number(s.winner_price)) / Number(s.our_price)) * 100);
    const avgGapPct = gaps.length ? Math.round((gaps.reduce((a: number, b: number) => a + b, 0) / gaps.length) * 10) / 10 : null;

    // المنافسون المتوقعون: تكرار الحضور والفوز عند هذه الجهة
    const { rows: competitors } = await pool.query(
      `SELECT be.company_name AS name,
              COUNT(*)::int AS appearances,
              COUNT(*) FILTER (WHERE be.is_winner)::int AS wins,
              ROUND(AVG(be.total_price)::numeric, 3) AS "avgPrice"
       FROM bid_results br
       JOIN bid_entries be ON be.bid_result_id = br.id AND be.is_us = false
       LEFT JOIN tenders t ON t.id = br.tender_id
       LEFT JOIN practices pr ON pr.id = br.practice_id
       WHERE COALESCE(t.government_entity_id, pr.government_entity_id) = $1
         AND NOT (br.source_type = $2 AND COALESCE(br.tender_id, br.practice_id) = $3)
       GROUP BY be.company_name
       ORDER BY appearances DESC, wins DESC LIMIT 5`, [gid, type, id]);

    // دروس سابقة مع نفس الجهة
    const { rows: lessons } = await pool.query(
      `SELECT ke.title, ke.outcome, ke.reasons
       FROM knowledge_entries ke
       LEFT JOIN tenders t ON t.id = ke.tender_id
       LEFT JOIN practices pr ON pr.id = ke.practice_id
       WHERE COALESCE(t.government_entity_id, pr.government_entity_id) = $1
       ORDER BY ke.id DESC LIMIT 3`, [gid]);

    return res.json({
      hasHistory: total > 0 || competitors.length > 0 || lessons.length > 0,
      sessions: total, wins, losses: total - wins, avgGapPct,
      competitors, lessons,
    });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل استرجاع الذاكرة" }); }
});

export default router;
