import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

/* ═══ صيانة العقود — نموذج صيانة عقود الورش (توسيع نظام الصيانة) ═══
   المرحلة ١: كتالوج أنواع المكائن + الهيكل التعليمي (منطقة ← مدرسة ← ورشة). */

const router = Router();
const isAdmin = (req: Request) => req.session.role === "admin";

type Writable = [apiKey: string, col: string, kind?: "num" | "json"];
const coerce = (v: any, kind?: "num" | "json") =>
  kind === "num" ? (v === "" || v == null ? null : Number(v))
  : kind === "json" ? JSON.stringify(v ?? [])
  : typeof v === "string" ? (v.trim() || null) : v;

/** مصنع CRUD موحّد لكيانات الكتالوج/الهيكل البسيطة. القراءة مسموحة للوحدة؛ الكتابة للمدير. */
function crud(cfg: {
  base: string; table: string; select: string;
  writable: Writable[]; required: string[]; order: string;
  filter?: [param: string, col: string];
}) {
  router.get(cfg.base, async (req: Request, res: Response) => {
    try {
      const params: any[] = [];
      let where = "";
      if (cfg.filter && req.query[cfg.filter[0]]) { params.push(Number(req.query[cfg.filter[0]])); where = `WHERE ${cfg.filter[1]} = $1`; }
      const { rows } = await pool.query(`SELECT ${cfg.select} FROM ${cfg.table} ${where} ORDER BY ${cfg.order}`, params);
      return res.json(rows);
    } catch { return res.status(500).json({ error: "فشل في الجلب" }); }
  });

  router.post(cfg.base, async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
    for (const r of cfg.required) if (!String(req.body?.[r] ?? "").trim()) return res.status(400).json({ error: "حقول مطلوبة ناقصة" });
    const cols: string[] = [], vals: any[] = [], ph: string[] = [];
    for (const [k, col, kind] of cfg.writable) {
      if (req.body?.[k] !== undefined) { cols.push(col); vals.push(coerce(req.body[k], kind)); ph.push(`$${vals.length}`); }
    }
    if (!cols.length) return res.status(400).json({ error: "لا بيانات" });
    try {
      const { rows } = await pool.query(`INSERT INTO ${cfg.table} (${cols.join(", ")}) VALUES (${ph.join(", ")}) RETURNING ${cfg.select}`, vals);
      return res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ error: "قيمة مكرّرة (مستخدمة بالفعل)" });
      if (e?.code === "23503") return res.status(400).json({ error: "مرجع غير صالح" });
      if (e?.code === "23514") return res.status(400).json({ error: "قيمة تخالف قيود العقد (السقف/التواريخ/القيم المسموحة)" });
      if (e?.code === "23P01") return res.status(409).json({ error: "تداخل فترة إسناد لنفس المكينة في نفس المدة" });
      return res.status(500).json({ error: "فشل الإضافة" });
    }
  });

  router.patch(`${cfg.base}/:id`, async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
    const sets: string[] = [], vals: any[] = [];
    for (const [k, col, kind] of cfg.writable) {
      if (req.body?.[k] !== undefined) { vals.push(coerce(req.body[k], kind)); sets.push(`${col} = $${vals.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: "لا تغييرات" });
    vals.push(Number(req.params.id));
    try {
      const { rows } = await pool.query(`UPDATE ${cfg.table} SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING ${cfg.select}`, vals);
      if (!rows.length) return res.status(404).json({ error: "غير موجود" });
      return res.json(rows[0]);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ error: "قيمة مكرّرة" });
      if (e?.code === "23514") return res.status(400).json({ error: "قيمة تخالف قيود العقد (السقف/التواريخ/القيم المسموحة)" });
      if (e?.code === "23P01") return res.status(409).json({ error: "تداخل فترة إسناد لنفس المكينة في نفس المدة" });
      return res.status(500).json({ error: "فشل التحديث" });
    }
  });

  router.delete(`${cfg.base}/:id`, async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
    try {
      await pool.query(`DELETE FROM ${cfg.table} WHERE id = $1`, [Number(req.params.id)]);
      return res.status(204).send();
    } catch (e: any) {
      if (e?.code === "23503") return res.status(409).json({ error: "لا يمكن الحذف — مرتبط بسجلات أخرى" });
      return res.status(500).json({ error: "فشل الحذف" });
    }
  });
}

// أنواع المكائن (الكتالوج المركزي)
crud({
  base: "/equipment-types", table: "maintenance_equipment_types",
  select: `id, code, name_ar AS "nameAr", name_en AS "nameEn", default_checklist AS "defaultChecklist"`,
  writable: [["code", "code"], ["nameAr", "name_ar"], ["nameEn", "name_en"], ["defaultChecklist", "default_checklist", "json"]],
  required: ["code", "nameAr"], order: "name_ar",
});

// المناطق التعليمية (الجهة التي تُخاطَب وتُطالَب ماليًا)
crud({
  base: "/districts", table: "maintenance_districts",
  select: `id, name_ar AS "nameAr", contact_name AS "contactName", contact_phone AS "contactPhone", payment_terms AS "paymentTerms", is_active AS "isActive"`,
  writable: [["nameAr", "name_ar"], ["contactName", "contact_name"], ["contactPhone", "contact_phone"], ["paymentTerms", "payment_terms"], ["isActive", "is_active"]],
  required: ["nameAr"], order: "name_ar",
});

// المدارس (تحت المنطقة)
crud({
  base: "/schools", table: "maintenance_schools",
  select: `id, district_id AS "districtId", name_ar AS "nameAr", code, address, phone, is_active AS "isActive"`,
  writable: [["districtId", "district_id", "num"], ["nameAr", "name_ar"], ["code", "code"], ["address", "address"], ["phone", "phone"], ["isActive", "is_active"]],
  required: ["districtId", "nameAr"], order: "name_ar", filter: ["districtId", "district_id"],
});

// الورش (تحت المدرسة)
crud({
  base: "/workshops", table: "maintenance_workshops",
  select: `id, school_id AS "schoolId", name_ar AS "nameAr", supervisor_name AS "supervisorName"`,
  writable: [["schoolId", "school_id", "num"], ["nameAr", "name_ar"], ["supervisorName", "supervisor_name"]],
  required: ["schoolId", "nameAr"], order: "name_ar", filter: ["schoolId", "school_id"],
});

/* ═══ المرحلة ٢: عقود الصيانة + التغطية + الأسعار + SLA ═══ */

// عقود الصيانة
crud({
  base: "/service-contracts", table: "service_contracts",
  select: `id, contract_number AS "contractNumber", district_id AS "districtId", title,
           contract_type AS "contractType", billing_model AS "billingModel",
           start_date AS "startDate", end_date AS "endDate", contract_value AS "contractValue",
           currency, pm_visits_per_year AS "pmVisitsPerYear", auto_renew AS "autoRenew", status`,
  writable: [
    ["contractNumber", "contract_number"], ["districtId", "district_id", "num"], ["title", "title"],
    ["contractType", "contract_type"], ["billingModel", "billing_model"],
    ["startDate", "start_date"], ["endDate", "end_date"], ["contractValue", "contract_value", "num"],
    ["currency", "currency"], ["pmVisitsPerYear", "pm_visits_per_year", "num"],
    ["autoRenew", "auto_renew"], ["status", "status"],
  ],
  required: ["contractNumber", "districtId", "contractType", "billingModel", "startDate", "endDate"],
  order: "contract_number", filter: ["districtId", "district_id"],
});

// مصفوفة التغطية (بنود العقد الثلاثية الحالات)
crud({
  base: "/coverage", table: "service_contract_coverage",
  select: `id, contract_id AS "contractId", item_code AS "itemCode", item_label_ar AS "itemLabelAr",
           coverage, annual_cap AS "annualCap", consumed`,
  writable: [
    ["contractId", "contract_id", "num"], ["itemCode", "item_code"], ["itemLabelAr", "item_label_ar"],
    ["coverage", "coverage"], ["annualCap", "annual_cap", "num"], ["consumed", "consumed", "num"],
  ],
  required: ["contractId", "itemCode", "itemLabelAr", "coverage"],
  order: "item_code", filter: ["contractId", "contract_id"],
});

// قائمة أسعار العقد
crud({
  base: "/price-list", table: "service_contract_price_list",
  select: `id, contract_id AS "contractId", item_code AS "itemCode", unit, unit_price AS "unitPrice", markup_pct AS "markupPct"`,
  writable: [
    ["contractId", "contract_id", "num"], ["itemCode", "item_code"], ["unit", "unit"],
    ["unitPrice", "unit_price", "num"], ["markupPct", "markup_pct", "num"],
  ],
  required: ["contractId", "itemCode", "unit"],
  order: "item_code", filter: ["contractId", "contract_id"],
});

// اتفاقية مستوى الخدمة
crud({
  base: "/sla", table: "service_contract_sla",
  select: `id, contract_id AS "contractId", priority, response_hours AS "responseHours", resolution_hours AS "resolutionHours"`,
  writable: [
    ["contractId", "contract_id", "num"], ["priority", "priority"],
    ["responseHours", "response_hours", "num"], ["resolutionHours", "resolution_hours", "num"],
  ],
  required: ["contractId", "priority", "responseHours", "resolutionHours"],
  order: "priority", filter: ["contractId", "contract_id"],
});

/* ═══ المرحلة ٣: الإسناد الزمني + محرّك التغطية ═══ */

// إسناد المكينة (فترة زمنية لمدرسة/ورشة/عقد) — قيد منع التداخل يُترجَم لـ409
crud({
  base: "/assignments", table: "maintenance_equipment_assignments",
  select: `id, equipment_id AS "equipmentId", school_id AS "schoolId", workshop_id AS "workshopId",
           contract_id AS "contractId", valid_from AS "validFrom", valid_to AS "validTo", reason`,
  writable: [
    ["equipmentId", "equipment_id", "num"], ["schoolId", "school_id", "num"], ["workshopId", "workshop_id", "num"],
    ["contractId", "contract_id", "num"], ["validFrom", "valid_from"], ["validTo", "valid_to"], ["reason", "reason"],
  ],
  required: ["equipmentId", "schoolId", "validFrom"],
  order: "valid_from DESC", filter: ["equipmentId", "equipment_id"],
});

/**
 * محرّك التغطية — يحدّد من يتحمّل تكلفة صيانة مكينة في تاريخ معيّن:
 *   ١) الضمان أولًا (على المورّد)
 *   ٢) العقد الساري وقتها (من الإسناد الزمني) — مصفوفة التغطية بنودًا مع كشف تجاوز السقف
 *   ٣) خارج العقد (يُسعَّر من قائمة أسعار الجهة)
 * قراءة فقط؛ في المرحلة ٤ يُستدعى عند إنشاء بند الزيارة ويُحفظ ناتجه كلقطة مجمّدة.
 */
/** محرّك التغطية (قابل لإعادة الاستخدام): ضمان → عقد ساري (مع السقوف) → خارج العقد. null = المعدة غير موجودة. */
async function resolveCoverage(equipmentId: number, date: string) {
  const { rows: eq } = await pool.query(
    `SELECT (warranty_expiry IS NOT NULL AND warranty_expiry >= $2::date) AS in_warranty FROM maintenance_equipment WHERE id = $1`,
    [equipmentId, date]
  );
  if (!eq.length) return null;
  if (eq[0].in_warranty) return { path: "ضمان", billable: false, contractId: null as number | null, note: "المعدة داخل فترة الضمان — التكلفة على المورّد", items: {} as Record<string, any> };
  const { rows: asg } = await pool.query(
    `SELECT contract_id FROM maintenance_equipment_assignments
     WHERE equipment_id = $1 AND valid_from <= $2::date AND (valid_to IS NULL OR valid_to > $2::date) AND contract_id IS NOT NULL
     ORDER BY valid_from DESC LIMIT 1`,
    [equipmentId, date]
  );
  const contractId: number | null = asg[0]?.contract_id ?? null;
  if (!contractId) return { path: "خارج العقد", billable: true, contractId: null, note: "لا عقد ساري — يُسعَّر من قائمة أسعار الجهة", items: {} as Record<string, any> };
  const { rows: cov } = await pool.query(`SELECT item_code, coverage, annual_cap, consumed FROM service_contract_coverage WHERE contract_id = $1`, [contractId]);
  const items: Record<string, any> = {};
  for (const r of cov) {
    const cap = r.annual_cap == null ? null : Number(r.annual_cap);
    const consumed = Number(r.consumed);
    items[r.item_code] = { coverage: r.coverage, cap, consumed, exceeded: r.coverage === "مشمول بسقف" && cap != null && consumed >= cap };
  }
  return { path: "ضمن العقد", billable: null as boolean | null, contractId, note: "ضمن اتفاقية سارية", items };
}

router.get("/coverage-resolve", async (req: Request, res: Response) => {
  const equipmentId = Number(req.query.equipmentId);
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  if (!equipmentId) return res.status(400).json({ error: "المعدة مطلوبة" });
  try {
    const result = await resolveCoverage(equipmentId, date);
    if (!result) return res.status(404).json({ error: "المعدة غير موجودة" });
    return res.json(result);
  } catch (err) { console.error(err); return res.status(500).json({ error: "فشل حساب التغطية" }); }
});

/* ═══ المرحلة ٤: الزيارات + بنودها + العبارات الجاهزة ═══ */

async function nextVisitNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM maintenance_visits WHERE visit_number LIKE $1`, [`VIS-${year}-%`]);
  return `VIS-${year}-${String((Number(rows[0]?.c) || 0) + 1).padStart(4, "0")}`;
}
async function nextWorkOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM maintenance_work_orders WHERE order_number LIKE $1`, [`WO-${year}-%`]);
  return `WO-${year}-${String((Number(rows[0]?.c) || 0) + 1).padStart(4, "0")}`;
}

// قائمة الزيارات
router.get("/visits", async (req: Request, res: Response) => {
  try {
    const params: any[] = []; const cond: string[] = [];
    if (req.query.schoolId) { params.push(Number(req.query.schoolId)); cond.push(`v.school_id = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); cond.push(`v.status = $${params.length}`); }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT v.id, v.visit_number AS "visitNumber", v.school_id AS "schoolId", s.name_ar AS "schoolName",
              v.visit_date AS "visitDate", v.maintenance_type AS "maintenanceType", v.technician_id AS "technicianId",
              u.full_name AS "technicianName", v.status,
              (SELECT COUNT(*)::int FROM maintenance_visit_lines l WHERE l.visit_id = v.id) AS "lineCount"
       FROM maintenance_visits v
       LEFT JOIN maintenance_schools s ON s.id = v.school_id
       LEFT JOIN users u ON u.id = v.technician_id
       ${where} ORDER BY v.visit_date DESC, v.id DESC`, params);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الزيارات" }); }
});

// تفاصيل زيارة مع بنودها
router.get("/visits/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { rows: vr } = await pool.query(
      `SELECT v.id, v.visit_number AS "visitNumber", v.school_id AS "schoolId", s.name_ar AS "schoolName",
              v.workshop_id AS "workshopId", v.visit_date AS "visitDate", v.maintenance_type AS "maintenanceType",
              v.technician_id AS "technicianId", u.full_name AS "technicianName", v.status,
              v.receiver_name AS "receiverName", v.receiver_title AS "receiverTitle", v.received_at AS "receivedAt",
              v.approved_by AS "approvedBy", v.issued_at AS "issuedAt"
       FROM maintenance_visits v LEFT JOIN maintenance_schools s ON s.id = v.school_id LEFT JOIN users u ON u.id = v.technician_id
       WHERE v.id = $1`, [id]);
    if (!vr.length) return res.status(404).json({ error: "الزيارة غير موجودة" });
    const { rows: lines } = await pool.query(
      `SELECT l.id, l.line_no AS "lineNo", l.equipment_id AS "equipmentId", e.asset_number AS "assetNumber", e.name AS "equipmentName",
              l.contract_id AS "contractId", l.is_included AS "isIncluded", l.exclusion_reason AS "exclusionReason",
              l.condition, l.works_done AS "worksDone", l.notes, l.work_order_id AS "workOrderId", l.coverage_decision AS "coverageDecision"
       FROM maintenance_visit_lines l LEFT JOIN maintenance_equipment e ON e.id = l.equipment_id
       WHERE l.visit_id = $1 ORDER BY l.line_no`, [id]);
    return res.json({ ...vr[0], lines });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الزيارة" }); }
});

// إنشاء زيارة (رقم تلقائي إن لم يُرسل)
router.post("/visits", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const b = req.body ?? {};
  if (!b.schoolId || !b.visitDate) return res.status(400).json({ error: "المدرسة وتاريخ الزيارة مطلوبان" });
  try {
    const visitNumber = (b.visitNumber?.trim && b.visitNumber.trim()) || await nextVisitNumber();
    const { rows } = await pool.query(
      `INSERT INTO maintenance_visits (visit_number, school_id, workshop_id, visit_date, maintenance_type, technician_id, status)
       VALUES ($1,$2,$3,$4,COALESCE($5,'دورية'),$6,COALESCE($7,'مسودة'))
       RETURNING id, visit_number AS "visitNumber", status`,
      [visitNumber, Number(b.schoolId), b.workshopId ? Number(b.workshopId) : null, b.visitDate,
       b.maintenanceType || null, b.technicianId ? Number(b.technicianId) : null, b.status || null]);
    return res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "رقم الزيارة مستخدم" });
    if (e?.code === "23514") return res.status(400).json({ error: "قيمة غير مسموحة (النوع/الحالة)" });
    console.error(e); return res.status(500).json({ error: "فشل إنشاء الزيارة" });
  }
});

// تعديل زيارة (الحالة/المستلِم/التواريخ…)
router.patch("/visits/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const b = req.body ?? {};
  const map: Record<string, [string, "num" | undefined]> = {
    status: ["status", undefined], maintenanceType: ["maintenance_type", undefined], technicianId: ["technician_id", "num"],
    workshopId: ["workshop_id", "num"], visitDate: ["visit_date", undefined], receiverName: ["receiver_name", undefined],
    receiverTitle: ["receiver_title", undefined], receivedAt: ["received_at", undefined], receiverSignature: ["receiver_signature", undefined],
    approvedBy: ["approved_by", "num"], arrivedAt: ["arrived_at", undefined], departedAt: ["departed_at", undefined], issuedAt: ["issued_at", undefined],
  };
  const sets: string[] = [], vals: any[] = [];
  for (const [k, [col, kind]] of Object.entries(map)) {
    if (b[k] !== undefined) { vals.push(kind === "num" ? (b[k] === "" || b[k] == null ? null : Number(b[k])) : (b[k] === "" ? null : b[k])); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: "لا تغييرات" });
  vals.push(Number(req.params.id));
  try {
    const { rows } = await pool.query(`UPDATE maintenance_visits SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING id`, vals);
    if (!rows.length) return res.status(404).json({ error: "الزيارة غير موجودة" });
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "23514") return res.status(400).json({ error: "قيمة غير مسموحة" });
    console.error(e); return res.status(500).json({ error: "فشل التحديث" });
  }
});

router.delete("/visits/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try { await pool.query(`DELETE FROM maintenance_visits WHERE id = $1`, [Number(req.params.id)]); return res.status(204).send(); }
  catch { return res.status(500).json({ error: "فشل الحذف" }); }
});

// إضافة بند لزيارة — يحسب لقطة التغطية المجمّدة تلقائيًا حسب تاريخ الزيارة
router.post("/visits/:id/lines", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const visitId = Number(req.params.id);
  const b = req.body ?? {};
  if (!b.equipmentId) return res.status(400).json({ error: "المعدة مطلوبة" });
  try {
    const { rows: vr } = await pool.query(`SELECT to_char(visit_date,'YYYY-MM-DD') AS d FROM maintenance_visits WHERE id = $1`, [visitId]);
    if (!vr.length) return res.status(404).json({ error: "الزيارة غير موجودة" });
    const date = vr[0].d as string;
    const { rows: ln } = await pool.query(`SELECT COALESCE(MAX(line_no),0)+1 AS n FROM maintenance_visit_lines WHERE visit_id = $1`, [visitId]);
    const lineNo = Number(ln[0].n);
    const coverage = await resolveCoverage(Number(b.equipmentId), date);
    const contractId = coverage?.contractId ?? null;
    const isIncluded = b.isIncluded !== false;
    const condition = isIncluded ? (b.condition || "جيدة") : null;
    const exclusionReason = isIncluded ? null : (b.exclusionReason || null);
    if (!isIncluded && !exclusionReason) return res.status(400).json({ error: "سبب الاستبعاد مطلوب لبند مستبعَد" });
    const { rows } = await pool.query(
      `INSERT INTO maintenance_visit_lines (visit_id, equipment_id, contract_id, line_no, is_included, exclusion_reason, condition, works_done, notes, coverage_decision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, line_no AS "lineNo"`,
      [visitId, Number(b.equipmentId), contractId, lineNo, isIncluded, exclusionReason, condition, b.worksDone || null, b.notes || null, coverage ? JSON.stringify(coverage) : null]);
    return res.status(201).json({ ...rows[0], coverageDecision: coverage });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "المكينة مضافة في هذه الزيارة بالفعل" });
    if (e?.code === "23514") return res.status(400).json({ error: "بيانات البند غير متوافقة (تضمين يتطلب حالة، استبعاد يتطلب سببًا)" });
    console.error(e); return res.status(500).json({ error: "فشل إضافة البند" });
  }
});

router.patch("/lines/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const b = req.body ?? {};
  const map: Record<string, string> = { condition: "condition", worksDone: "works_done", notes: "notes", isIncluded: "is_included", exclusionReason: "exclusion_reason" };
  const sets: string[] = [], vals: any[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { vals.push(b[k] === "" ? null : b[k]); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: "لا تغييرات" });
  vals.push(Number(req.params.id));
  try {
    const { rows } = await pool.query(`UPDATE maintenance_visit_lines SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING id`, vals);
    if (!rows.length) return res.status(404).json({ error: "البند غير موجود" });
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "23514") return res.status(400).json({ error: "بيانات البند غير متوافقة" });
    console.error(e); return res.status(500).json({ error: "فشل التحديث" });
  }
});

router.delete("/lines/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try { await pool.query(`DELETE FROM maintenance_visit_lines WHERE id = $1`, [Number(req.params.id)]); return res.status(204).send(); }
  catch { return res.status(500).json({ error: "فشل الحذف" }); }
});

// توليد أمر صيانة من بند "تحتاج صيانة" — يُنشئ أمرًا في نظام الصيانة الحالي ويربطه بالبند
router.post("/lines/:id/generate-work-order", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const lineId = Number(req.params.id);
  try {
    const { rows: lr } = await pool.query(`SELECT * FROM maintenance_visit_lines WHERE id = $1`, [lineId]);
    if (!lr.length) return res.status(404).json({ error: "البند غير موجود" });
    const line = lr[0];
    if (line.condition !== "تحتاج صيانة") return res.status(400).json({ error: "يُولَّد الأمر فقط من بند حالته «تحتاج صيانة»" });
    if (line.work_order_id) return res.status(409).json({ error: "للبند أمر صيانة مرتبط بالفعل" });
    const orderNumber = await nextWorkOrderNumber();
    const reason = line.works_done || line.notes || "من زيارة صيانة";
    const { rows: wo } = await pool.query(
      `INSERT INTO maintenance_work_orders (order_number, equipment_id, maintenance_type, report_reason, priority, stage)
       VALUES ($1,$2,'corrective',$3,'medium','reported') RETURNING id, order_number AS "orderNumber"`,
      [orderNumber, line.equipment_id, reason]);
    const woId = wo[0].id;
    try { await pool.query(`INSERT INTO maintenance_stage_history (work_order_id, stage, changed_by_user_id) VALUES ($1,'reported',$2)`, [woId, req.session.userId || null]); } catch { /* سجل المراحل ليس حرجًا */ }
    await pool.query(`UPDATE maintenance_visit_lines SET work_order_id = $1 WHERE id = $2`, [woId, lineId]);
    return res.status(201).json({ workOrderId: woId, orderNumber: wo[0].orderNumber });
  } catch (e: any) { console.error(e); return res.status(500).json({ error: "فشل توليد أمر الصيانة" }); }
});

// مكتبة العبارات الجاهزة (بديل الأسطر المنقّطة بخط اليد)
crud({
  base: "/standard-phrases", table: "maintenance_standard_phrases",
  select: `id, category, text_ar AS "textAr", type_id AS "typeId", usage_count AS "usageCount", is_active AS "isActive"`,
  writable: [["category", "category"], ["textAr", "text_ar"], ["typeId", "type_id", "num"], ["usageCount", "usage_count", "num"], ["isActive", "is_active"]],
  required: ["category", "textAr"], order: "category, id", filter: ["typeId", "type_id"],
});

export default router;
