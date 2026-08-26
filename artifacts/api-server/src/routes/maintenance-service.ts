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

/* ═══ المرحلة ٥: التقارير الرسمية + السجلات + الترقيم + مطالبات الضمان ═══ */

// ترقيم رسمي متسلسل آمن عند التزامن (upsert ذرّي على سلسلة النوع/السنة)
export async function nextDocNumber(docType: string): Promise<string> {
  const prefixMap: Record<string, string> = { "تقرير زيارة": "RPT", "مطالبة مالية": "INV", "عرض سعر": "QUO", "محضر استلام": "RCV", "كتاب رسمي": "LTR" };
  const prefix = prefixMap[docType] || "DOC";
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    `INSERT INTO maintenance_document_sequences (doc_type, year, last_number) VALUES ($1,$2,1)
     ON CONFLICT (doc_type, year) DO UPDATE SET last_number = maintenance_document_sequences.last_number + 1
     RETURNING last_number`,
    [docType, year]
  );
  return `${prefix}-${year}-${String(rows[0].last_number).padStart(4, "0")}`;
}

// سجل الصادر — رقم رسمي تلقائي إن لم يُرسل
router.get("/outgoing-register", async (req: Request, res: Response) => {
  try {
    const params: any[] = []; const cond: string[] = [];
    for (const [q, col] of [["docType", "doc_type"], ["visitId", "visit_id"], ["districtId", "district_id"], ["status", "status"]] as const) {
      if (req.query[q]) { params.push(q === "docType" || q === "status" ? req.query[q] : Number(req.query[q])); cond.push(`${col} = $${params.length}`); }
    }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, doc_number AS "docNumber", version, doc_type AS "docType", visit_id AS "visitId", district_id AS "districtId",
              subject, file_path AS "filePath", delivery_method AS "deliveryMethod", delivered_at AS "deliveredAt",
              receiver_name AS "receiverName", receiver_ref AS "receiverRef", status, issued_at AS "issuedAt"
       FROM maintenance_outgoing_register ${where} ORDER BY issued_at DESC, id DESC`, params);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب سجل الصادر" }); }
});

router.post("/outgoing-register", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const b = req.body ?? {};
  if (!b.docType) return res.status(400).json({ error: "نوع المستند مطلوب" });
  try {
    const docNumber = (typeof b.docNumber === "string" && b.docNumber.trim()) || await nextDocNumber(b.docType);
    const { rows } = await pool.query(
      `INSERT INTO maintenance_outgoing_register (doc_number, doc_type, visit_id, district_id, subject, file_path, delivery_method, delivered_at, receiver_name, receiver_title, receiver_ref, status, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,'أُرسل'),$13)
       RETURNING id, doc_number AS "docNumber", version, status`,
      [docNumber, b.docType, b.visitId ? Number(b.visitId) : null, b.districtId ? Number(b.districtId) : null,
       b.subject || null, b.filePath || null, b.deliveryMethod || null, b.deliveredAt || null,
       b.receiverName || null, b.receiverTitle || null, b.receiverRef || null, b.status || null, req.session.userId || null]);
    return res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "رقم/إصدار المستند مستخدم" });
    if (e?.code === "23514") return res.status(400).json({ error: "قيمة غير مسموحة (النوع/طريقة التسليم/الحالة)" });
    console.error(e); return res.status(500).json({ error: "فشل تسجيل الصادر" });
  }
});

router.patch("/outgoing-register/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const b = req.body ?? {};
  const map: Record<string, string> = { status: "status", deliveryMethod: "delivery_method", deliveredAt: "delivered_at", receiverName: "receiver_name", receiverTitle: "receiver_title", receiverRef: "receiver_ref", revisionReason: "revision_reason", subject: "subject", filePath: "file_path" };
  const sets: string[] = [], vals: any[] = [];
  for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) { vals.push(b[k] === "" ? null : b[k]); sets.push(`${col} = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: "لا تغييرات" });
  vals.push(Number(req.params.id));
  try {
    const { rows } = await pool.query(`UPDATE maintenance_outgoing_register SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING id`, vals);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "23514") return res.status(400).json({ error: "قيمة غير مسموحة" });
    console.error(e); return res.status(500).json({ error: "فشل التحديث" });
  }
});

router.delete("/outgoing-register/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try { await pool.query(`DELETE FROM maintenance_outgoing_register WHERE id = $1`, [Number(req.params.id)]); return res.status(204).send(); }
  catch { return res.status(500).json({ error: "فشل الحذف" }); }
});

// ملفات العرض (تخطيطات التقرير + تسميات الحقول لكل جهة)
crud({
  base: "/presentation-profiles", table: "maintenance_presentation_profiles",
  select: `id, name, district_id AS "districtId", contract_id AS "contractId", base_layout AS "baseLayout",
           raw_template_path AS "rawTemplatePath", show_costs AS "showCosts", show_parts AS "showParts",
           logo_path AS "logoPath", signature_blocks AS "signatureBlocks", is_default AS "isDefault"`,
  writable: [["name", "name"], ["districtId", "district_id", "num"], ["contractId", "contract_id", "num"],
    ["baseLayout", "base_layout"], ["rawTemplatePath", "raw_template_path"], ["showCosts", "show_costs"],
    ["showParts", "show_parts"], ["logoPath", "logo_path"], ["signatureBlocks", "signature_blocks", "json"], ["isDefault", "is_default"]],
  required: ["name", "baseLayout"], order: "name",
});
crud({
  base: "/field-labels", table: "maintenance_field_labels",
  select: `id, profile_id AS "profileId", field_key AS "fieldKey", label_ar AS "labelAr", label_en AS "labelEn", is_visible AS "isVisible", sort_order AS "sortOrder"`,
  writable: [["profileId", "profile_id", "num"], ["fieldKey", "field_key"], ["labelAr", "label_ar"], ["labelEn", "label_en"], ["isVisible", "is_visible"], ["sortOrder", "sort_order", "num"]],
  required: ["profileId", "fieldKey", "labelAr"], order: "sort_order, field_key", filter: ["profileId", "profile_id"],
});

// سجل الوارد
crud({
  base: "/incoming-register", table: "maintenance_incoming_register",
  select: `id, ref_number AS "refNumber", received_at AS "receivedAt", district_id AS "districtId", school_id AS "schoolId",
           subject, file_path AS "filePath", generated_visit_id AS "generatedVisitId", generated_wo_id AS "generatedWoId"`,
  writable: [["refNumber", "ref_number"], ["receivedAt", "received_at"], ["districtId", "district_id", "num"], ["schoolId", "school_id", "num"],
    ["subject", "subject"], ["filePath", "file_path"], ["generatedVisitId", "generated_visit_id", "num"], ["generatedWoId", "generated_wo_id", "num"]],
  required: ["receivedAt", "subject"], order: "received_at DESC", filter: ["districtId", "district_id"],
});

// مطالبات الضمان (لأمر صيانة، على مورّد)
crud({
  base: "/warranty-claims", table: "maintenance_warranty_claims",
  select: `id, work_order_id AS "workOrderId", supplier_id AS "supplierId", claim_number AS "claimNumber",
           requested_parts AS "requestedParts", requested_at AS "requestedAt", received_at AS "receivedAt", status, notes`,
  writable: [["workOrderId", "work_order_id", "num"], ["supplierId", "supplier_id", "num"], ["claimNumber", "claim_number"],
    ["requestedParts", "requested_parts"], ["requestedAt", "requested_at"], ["receivedAt", "received_at"], ["status", "status"], ["notes", "notes"]],
  required: ["workOrderId", "supplierId"], order: "requested_at DESC", filter: ["workOrderId", "work_order_id"],
});

/* ═══ المرحلة ٦: التقارير التحليلية ═══ */

// السجل الزمني لخدمة مكينة معيّنة عبر كل الزيارات
router.get("/analytics/equipment-history", async (req: Request, res: Response) => {
  const equipmentId = Number(req.query.equipmentId);
  if (!equipmentId) return res.status(400).json({ error: "المعدة مطلوبة" });
  try {
    const { rows } = await pool.query(
      `SELECT v.visit_date AS "visitDate", v.visit_number AS "visitNumber", s.name_ar AS "school",
              l.condition, l.works_done AS "worksDone", l.work_order_id AS "workOrderId", u.full_name AS "technician"
       FROM maintenance_visit_lines l
       JOIN maintenance_visits v ON v.id = l.visit_id
       JOIN maintenance_schools s ON s.id = v.school_id
       LEFT JOIN users u ON u.id = v.technician_id
       WHERE l.equipment_id = $1 AND l.is_included = true
       ORDER BY v.visit_date DESC`, [equipmentId]);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب السجل" }); }
});

// رصيد الزيارات الوقائية لكل عقد نشط (مستحق/منفَّذ/متبقٍّ) — خطر إخلال تعاقدي إن سالب
router.get("/analytics/contract-visit-balance", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.contract_number AS "contractNumber", d.name_ar AS "district",
              c.pm_visits_per_year AS "due", COUNT(DISTINCT v.id)::int AS "executed",
              (COALESCE(c.pm_visits_per_year,0) - COUNT(DISTINCT v.id))::int AS "remaining"
       FROM service_contracts c
       LEFT JOIN maintenance_districts d ON d.id = c.district_id
       LEFT JOIN maintenance_visit_lines vl ON vl.contract_id = c.id AND vl.is_included = true
       LEFT JOIN maintenance_visits v ON v.id = vl.visit_id AND v.status = 'صادرة' AND v.visit_date BETWEEN c.start_date AND c.end_date
       WHERE c.status = 'نشط'
       GROUP BY c.id, c.contract_number, d.name_ar, c.pm_visits_per_year
       ORDER BY "remaining" DESC`);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الرصيد" }); }
});

// بنود استُبعدت لتعذّر الوصول/عدم وجود المكينة — التزام قائم يحتاج إعادة جدولة
router.get("/analytics/pending-reschedule", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.name_ar AS "school", e.asset_number AS "assetNumber", et.name_ar AS "equipmentType",
              v.visit_date AS "visitDate", v.visit_number AS "visitNumber", l.exclusion_reason AS "exclusionReason"
       FROM maintenance_visit_lines l
       JOIN maintenance_visits v ON v.id = l.visit_id
       JOIN maintenance_schools s ON s.id = v.school_id
       JOIN maintenance_equipment e ON e.id = l.equipment_id
       LEFT JOIN maintenance_equipment_types et ON et.id = e.type_id
       WHERE l.is_included = false AND l.exclusion_reason IN ('تعذّر الوصول للورشة','المكينة غير موجودة بالموقع')
       ORDER BY v.visit_date DESC`);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب البنود" }); }
});


/* ═══ وصل الفجوة ١: فوترة العمل غير المشمول/المتجاوز للسقف كإيراد ═══
   قرار التغطية المجمّد في البند يحدّد *هل* يُفوتَر (لا يتغيّر بعد الزيارة)، بينما استهلاك
   السقف يُقرأ حيًّا لأن صرف القطع يحدث بعد الزيارة. التسعير من قائمة أسعار العقد، ولعمل
   خارج العقد من قائمة أحدث عقد نشط لنفس المنطقة («أسعار الجهة»)، وما لا سعر له يرجع
   لتكلفته الفعلية — والمبلغ يبقى قابلًا للتعديل قبل التأكيد. الإيراد يُدرَج في finance_income
   فيلتقطه trigger القسم (الصيانة) ومرآة دفتر الأحداث تلقائيًا. */

/** شرط البند القابل للفوترة: خارج العقد، أو داخل عقد تجاوز سقفه فعليًا وصُرفت له قطع. */
const BILLABLE_LINE_SQL = `
  l.income_id IS NULL AND l.is_included = true AND (
    l.coverage_decision->>'path' = 'خارج العقد'
    OR (l.coverage_decision->>'path' = 'ضمن العقد'
        AND EXISTS (SELECT 1 FROM maintenance_work_order_parts wp
                     WHERE wp.work_order_id = l.work_order_id AND wp.status = 'issued')
        AND (SELECT COALESCE(SUM(sc.consumed - sc.annual_cap),0) FROM service_contract_coverage sc
              WHERE sc.contract_id = l.contract_id AND sc.coverage = 'مشمول بسقف'
                AND sc.annual_cap IS NOT NULL AND sc.consumed > sc.annual_cap)
            > (SELECT COALESCE(SUM(l2.billed_amount),0) FROM maintenance_visit_lines l2
                WHERE l2.contract_id = l.contract_id AND l2.income_id IS NOT NULL
                  AND l2.coverage_decision->>'path' = 'ضمن العقد')))`;

const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

type QuoteItem = { itemCode: string | null; label: string; quantity: number; unitPrice: number; markupPct: number; total: number; source: string };

/** عرض سعر بند زيارة: هل يُفوتَر ولماذا، وبكم — مع تفصيل مصدر كل رقم. null = البند غير موجود. */
async function buildQuote(lineId: number) {
  const { rows: lr } = await pool.query(
    `SELECT l.id, l.line_no AS "lineNo", l.visit_id AS "visitId", l.contract_id AS "contractId",
            l.work_order_id AS "workOrderId", l.income_id AS "incomeId", l.billed_amount AS "billedAmount",
            l.is_included AS "isIncluded", l.coverage_decision AS "coverageDecision",
            v.visit_number AS "visitNumber", to_char(v.visit_date,'YYYY-MM-DD') AS "visitDate",
            s.district_id AS "districtId", s.name_ar AS "school",
            e.name AS "equipmentName", e.asset_number AS "assetNumber",
            wo.order_number AS "workOrderNumber", c.contract_number AS "contractNumber"
     FROM maintenance_visit_lines l
     JOIN maintenance_visits v ON v.id = l.visit_id
     JOIN maintenance_schools s ON s.id = v.school_id
     JOIN maintenance_equipment e ON e.id = l.equipment_id
     LEFT JOIN maintenance_work_orders wo ON wo.id = l.work_order_id
     LEFT JOIN service_contracts c ON c.id = l.contract_id
     WHERE l.id = $1`, [lineId]);
  if (!lr.length) return null;
  const line = lr[0];
  const path: string | null = line.coverageDecision?.path ?? null;

  // (أ) هل يُفوتَر؟ — المسار المجمّد يقرّر، والسقف يُراجَع حيًّا
  let billable = false, reason = "", capOverage: number | null = null;
  if (!line.isIncluded) reason = "بند مستبعَد من الزيارة — لا عمل يُفوتَر";
  else if (path === "ضمان") reason = "المكينة داخل الضمان — التكلفة على المورّد";
  else if (path === "خارج العقد") { billable = true; reason = "عمل خارج العقد — يُسعَّر من أسعار الجهة"; }
  else if (path === "ضمن العقد") {
    const { rows: caps } = await pool.query(
      `SELECT item_code AS "itemCode", (consumed - annual_cap)::numeric AS overage
       FROM service_contract_coverage
       WHERE contract_id = $1 AND coverage = 'مشمول بسقف' AND annual_cap IS NOT NULL AND consumed > annual_cap`,
      [line.contractId]);
    if (caps.length) {
      const gross = round3(caps.reduce((s: number, r: any) => s + Number(r.overage), 0));
      // السقف تعاقدي على مستوى العقد لا البند — يُخصم ما فُوتر سلفًا منه وإلا تحصّل نفس التجاوز مرتين
      const { rows: prior } = await pool.query(
        `SELECT COALESCE(SUM(billed_amount),0)::numeric AS total FROM maintenance_visit_lines
         WHERE contract_id = $1 AND income_id IS NOT NULL AND coverage_decision->>'path' = 'ضمن العقد'`,
        [line.contractId]);
      const alreadyBilled = round3(Number(prior[0]?.total ?? 0));
      capOverage = round3(gross - alreadyBilled);
      if (capOverage > 0) {
        billable = true;
        reason = `تجاوز سقف التغطية (${caps.map((r: any) => r.itemCode).join("، ")}) بمقدار ${gross.toFixed(3)} د.ك`
          + (alreadyBilled ? ` — فُوتر منه ${alreadyBilled.toFixed(3)}، والمتبقّي ${capOverage.toFixed(3)} د.ك` : "");
      } else reason = `تجاوز السقف (${gross.toFixed(3)} د.ك) مُحصَّل بالكامل سلفًا`;
    } else reason = "مشمول بالعقد ضمن السقف — لا يُفوتَر";
  } else reason = "لا يوجد قرار تغطية محفوظ لهذا البند";

  // (ب) قائمة الأسعار المرجعية: عقد البند، أو أحدث عقد نشط لنفس المنطقة حين يكون العمل خارج العقد
  let pricingContractId: number | null = line.contractId;
  let pricingBasis = line.contractId ? "قائمة أسعار العقد" : "قائمة أسعار الجهة (أحدث عقد نشط للمنطقة)";
  if (!pricingContractId && line.districtId) {
    const { rows } = await pool.query(
      `SELECT id FROM service_contracts WHERE district_id = $1 AND status = 'نشط' ORDER BY start_date DESC LIMIT 1`,
      [line.districtId]);
    pricingContractId = rows[0]?.id ?? null;
  }
  if (!pricingContractId) pricingBasis = "لا قائمة أسعار متاحة — التكلفة الفعلية";

  // (ج) البنود: قطع الغيار المصروفة على أمر الصيانة، مسعَّرة من القائمة وإلا بتكلفتها الفعلية
  const items: QuoteItem[] = [];
  let actualCost = 0;
  if (line.workOrderId) {
    const { rows: parts } = await pool.query(
      `SELECT DISTINCT ON (wp.id) wp.id, wp.part_name AS "partName", wp.quantity::numeric AS quantity,
              COALESCE(wp.unit_price,0)::numeric AS "unitPrice", inv.part_number AS "partNumber",
              pl.item_code AS "plCode", pl.unit_price::numeric AS "plPrice", COALESCE(pl.markup_pct,0)::numeric AS "plMarkup"
       FROM maintenance_work_order_parts wp
       LEFT JOIN maintenance_inventory inv ON inv.id = wp.inventory_item_id
       LEFT JOIN service_contract_price_list pl
              ON pl.contract_id = $2 AND (pl.item_code = inv.part_number OR pl.item_code = wp.part_name)
       WHERE wp.work_order_id = $1 AND wp.status = 'issued'
       ORDER BY wp.id, (pl.item_code = inv.part_number) DESC NULLS LAST, pl.id`,
      [line.workOrderId, pricingContractId]);
    for (const p of parts) {
      const qty = Number(p.quantity);
      actualCost += qty * Number(p.unitPrice);
      if (p.plPrice != null) {
        items.push({ itemCode: p.plCode, label: p.partName, quantity: qty, unitPrice: Number(p.plPrice),
          markupPct: Number(p.plMarkup), total: round3(qty * Number(p.plPrice) * (1 + Number(p.plMarkup) / 100)), source: "قائمة الأسعار" });
      } else {
        items.push({ itemCode: p.partNumber ?? null, label: p.partName, quantity: qty, unitPrice: Number(p.unitPrice),
          markupPct: 0, total: round3(qty * Number(p.unitPrice)), source: "تكلفة فعلية" });
      }
    }
    const { rows: exp } = await pool.query(
      `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM finance_expenses WHERE maintenance_work_order_id = $1`,
      [line.workOrderId]);
    actualCost += Number(exp[0]?.total ?? 0);
  }
  // بند الزيارة/العمالة من القائمة (مرة واحدة) إن كان معرَّفًا في العقد
  if (pricingContractId) {
    const { rows: labor } = await pool.query(
      `SELECT item_code AS "itemCode", unit, unit_price::numeric AS "unitPrice", COALESCE(markup_pct,0)::numeric AS "markupPct"
       FROM service_contract_price_list
       WHERE contract_id = $1 AND item_code IN ('زيارة','عمالة','أجرة عمل','labor','visit')`, [pricingContractId]);
    for (const l of labor) {
      items.push({ itemCode: l.itemCode, label: l.itemCode, quantity: 1, unitPrice: Number(l.unitPrice),
        markupPct: Number(l.markupPct), total: round3(Number(l.unitPrice) * (1 + Number(l.markupPct) / 100)), source: "قائمة الأسعار" });
    }
  }

  // (د) المبلغ المقترح — ولا يتجاوز مقدار تجاوز السقف حين تكون الفوترة بسببه
  let suggested = round3(items.reduce((s, i) => s + i.total, 0));
  if (!suggested) suggested = round3(actualCost);
  if (capOverage != null) suggested = suggested ? round3(Math.min(suggested, capOverage)) : capOverage;

  return {
    lineId: line.id, lineNo: line.lineNo, visitId: line.visitId, visitNumber: line.visitNumber, visitDate: line.visitDate,
    school: line.school, equipmentName: line.equipmentName, assetNumber: line.assetNumber,
    contractId: line.contractId, contractNumber: line.contractNumber,
    workOrderId: line.workOrderId, workOrderNumber: line.workOrderNumber,
    incomeId: line.incomeId, billedAmount: line.billedAmount == null ? null : Number(line.billedAmount),
    coveragePath: path, billable, reason, capOverage,
    pricingContractId, pricingBasis, items, actualCost: round3(actualCost), suggestedAmount: suggested,
  };
}

// البنود المستحقة للفوترة عبر كل الزيارات (لم تُفوتَر بعد)
router.get("/billing/pending", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id AS "lineId", l.line_no AS "lineNo", v.id AS "visitId", v.visit_number AS "visitNumber",
              to_char(v.visit_date,'YYYY-MM-DD') AS "visitDate", s.name_ar AS "school",
              e.name AS "equipmentName", e.asset_number AS "assetNumber",
              l.contract_id AS "contractId", c.contract_number AS "contractNumber",
              l.coverage_decision->>'path' AS "coveragePath",
              l.work_order_id AS "workOrderId", wo.order_number AS "workOrderNumber",
              COALESCE((SELECT SUM(wp.quantity * COALESCE(wp.unit_price,0)) FROM maintenance_work_order_parts wp
                        WHERE wp.work_order_id = l.work_order_id AND wp.status = 'issued'),0)::numeric AS "partsCost"
       FROM maintenance_visit_lines l
       JOIN maintenance_visits v ON v.id = l.visit_id
       JOIN maintenance_schools s ON s.id = v.school_id
       JOIN maintenance_equipment e ON e.id = l.equipment_id
       LEFT JOIN service_contracts c ON c.id = l.contract_id
       LEFT JOIN maintenance_work_orders wo ON wo.id = l.work_order_id
       WHERE ${BILLABLE_LINE_SQL}
       ORDER BY v.visit_date DESC, l.line_no`);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب البنود المستحقة" }); }
});

// البنود المفوترة (لمتابعة ما تحوّل إلى إيراد فعلًا)
router.get("/billing/billed", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id AS "lineId", v.visit_number AS "visitNumber", to_char(v.visit_date,'YYYY-MM-DD') AS "visitDate",
              s.name_ar AS "school", e.name AS "equipmentName", e.asset_number AS "assetNumber",
              c.contract_number AS "contractNumber", l.coverage_decision->>'path' AS "coveragePath",
              l.income_id AS "incomeId", l.billed_amount AS "billedAmount", l.billed_at AS "billedAt",
              l.billing_note AS "billingNote", fi.description AS "incomeDescription"
       FROM maintenance_visit_lines l
       JOIN maintenance_visits v ON v.id = l.visit_id
       JOIN maintenance_schools s ON s.id = v.school_id
       JOIN maintenance_equipment e ON e.id = l.equipment_id
       LEFT JOIN service_contracts c ON c.id = l.contract_id
       LEFT JOIN finance_income fi ON fi.id = l.income_id
       WHERE l.income_id IS NOT NULL
       ORDER BY l.billed_at DESC NULLS LAST`);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب البنود المفوترة" }); }
});

// عرض سعر بند واحد قبل الفوترة (تفصيل مصدر كل رقم)
router.get("/billing/quote", async (req: Request, res: Response) => {
  const lineId = Number(req.query.lineId);
  if (!lineId) return res.status(400).json({ error: "البند مطلوب" });
  try {
    const quote = await buildQuote(lineId);
    if (!quote) return res.status(404).json({ error: "البند غير موجود" });
    return res.json(quote);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل حساب عرض السعر" }); }
});

// الفوترة — يُنشئ سجل إيراد ويربطه بالبند (معاملة واحدة)
router.post("/lines/:id/bill", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const lineId = Number(req.params.id);
  const b = req.body ?? {};
  const client = await pool.connect();
  try {
    const quote = await buildQuote(lineId);
    if (!quote) return res.status(404).json({ error: "البند غير موجود" });
    if (quote.incomeId) return res.status(409).json({ error: "البند مفوتَر بالفعل" });
    if (!quote.billable) return res.status(400).json({ error: quote.reason });
    const amount = b.amount === undefined || b.amount === "" || b.amount === null ? quote.suggestedAmount : Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "مبلغ غير صالح" });
    const date = (typeof b.date === "string" && b.date.trim()) || quote.visitDate;
    const description = (typeof b.description === "string" && b.description.trim())
      || `${quote.coveragePath === "خارج العقد" ? "عمل خارج العقد" : "تجاوز سقف التغطية"} — زيارة ${quote.visitNumber} · ${quote.school} · ${quote.equipmentName}`;
    const note = (typeof b.note === "string" && b.note.trim()) || quote.reason;

    await client.query("BEGIN");
    const { rows: inc } = await client.query(
      `INSERT INTO finance_income (maintenance_work_order_id, source_module, income_source, description, amount, "date", category, notes, created_by)
       VALUES ($1,'maintenance','service_visit',$2,$3,$4,$5,$6,$7) RETURNING id`,
      [quote.workOrderId, description, String(round3(amount)), date,
       quote.contractId ? "contract" : "other", note, req.session.userId ?? null]);
    const incomeId = inc[0].id;
    await client.query(
      `UPDATE maintenance_visit_lines SET income_id = $1, billed_amount = $2, billed_at = now(), billing_note = $3 WHERE id = $4`,
      [incomeId, String(round3(amount)), note, lineId]);
    await client.query("COMMIT");
    return res.status(201).json({ incomeId, amount: round3(amount), date, description });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* المعاملة قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل تسجيل الفوترة" });
  } finally { client.release(); }
});

// التراجع عن الفوترة — بقيد إيراد سالب لا بالحذف: يصفّي دفتر الإيرادات إلى صفر، وتعكسه
// مرآة دفتر الأحداث تلقائيًا (AFTER INSERT)، فيبقى الدفتران append-only والفحص أخضر بصدق،
// ويبقى الصفّان شاهدَين على الفوترة وتصحيحها. البند يُفكّ ربطه فيعود قابلًا للفوترة.
// يُرفض إن كان قيد الإيراد قد عُكس سلفًا من دفتر الأحداث (المرحلة ٩) — التصحيح تمّ هناك.
router.delete("/lines/:id/bill", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const lineId = Number(req.params.id);
  const client = await pool.connect();
  try {
    const { rows: lr } = await client.query(
      `SELECT l.income_id, l.billed_amount, fi.amount, fi.description, fi.category,
              fi.cost_center_id, fi.maintenance_work_order_id
       FROM maintenance_visit_lines l LEFT JOIN finance_income fi ON fi.id = l.income_id
       WHERE l.id = $1`, [lineId]);
    if (!lr.length) return res.status(404).json({ error: "البند غير موجود" });
    const line = lr[0];
    if (!line.income_id) return res.status(400).json({ error: "البند غير مفوتَر" });
    if (line.amount == null) return res.status(409).json({ error: "سجل الإيراد الأصلي محذوف من دفتر الإيرادات — صحّح من دفتر الأحداث" });
    const { rows: ev } = await client.query(
      `SELECT id FROM financial_events WHERE source_ledger = 'finance_income' AND source_id = $1`, [line.income_id]);
    if (ev.length) {
      const { rows: rev } = await client.query(`SELECT 1 FROM financial_events WHERE reverses_event_id = $1`, [ev[0].id]);
      if (rev.length) return res.status(409).json({ error: "قيد الإيراد مُعاكَس في دفتر الأحداث — التصحيح تمّ هناك" });
    }
    await client.query("BEGIN");
    // cost_center_id يُنسخ صراحةً من الأصل (الـtrigger لا يملأ إلا الفارغ) ليقع العكس على نفس القسم
    const { rows: revInc } = await client.query(
      `INSERT INTO finance_income (maintenance_work_order_id, cost_center_id, source_module, income_source, description, amount, "date", category, notes, created_by)
       VALUES ($1,$2,'maintenance','service_visit_reversal',$3,$4,CURRENT_DATE,$5,$6,$7) RETURNING id`,
      [line.maintenance_work_order_id, line.cost_center_id,
       `عكس فوترة — ${line.description ?? ""}`.slice(0, 500), String(-Number(line.amount)),
       line.category ?? "other", `يعكس قيد الإيراد #${line.income_id}`, req.session.userId ?? null]);
    await client.query(`UPDATE maintenance_visit_lines SET income_id = NULL, billed_amount = NULL, billed_at = NULL, billing_note = NULL WHERE id = $1`, [lineId]);
    await client.query("COMMIT");
    return res.json({ reversalIncomeId: revInc[0].id, reversedIncomeId: line.income_id, amount: -Number(line.amount) });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* المعاملة قد لا تكون بدأت */ }
    console.error(e); return res.status(500).json({ error: "فشل التراجع عن الفوترة" });
  } finally { client.release(); }
});

/* ═══ وصل الفجوة ٢: ربط خطط الصيانة الوقائية بعقود الصيانة ═══
   الخطة تُنفَّذ على مكينة، والمكينة مُسندة زمنيًا لعقد — فالربط يُشتق من الإسناد بدل إدخاله
   يدويًا، ويُخزَّن على الخطة ليبقى ثابتًا في التقارير. */

// ربط تلقائي: يملأ عقد كل خطة بلا عقد من إسناد مكينتها الساري اليوم (idempotent)
router.post("/preventive-plans/auto-link", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE maintenance_preventive_plans pp
       SET contract_id = a.contract_id, updated_at = now()
       FROM maintenance_equipment_assignments a
       WHERE a.equipment_id = pp.equipment_id
         AND a.contract_id IS NOT NULL
         AND a.valid_from <= CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE)
         AND pp.contract_id IS NULL`);
    return res.json({ linked: rowCount ?? 0 });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل الربط التلقائي" }); }
});

// تغطية الصيانة الوقائية لكل عقد نشط: كم مكينة تحته، وكم منها بلا خطة سارية
router.get("/analytics/contract-pm-coverage", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `WITH covered AS (
         SELECT DISTINCT a.contract_id, a.equipment_id
         FROM maintenance_equipment_assignments a
         WHERE a.contract_id IS NOT NULL
           AND a.valid_from <= CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE))
       SELECT c.id AS "contractId", c.contract_number AS "contractNumber", d.name_ar AS "district",
              c.pm_visits_per_year AS "pmVisitsPerYear",
              COUNT(DISTINCT cv.equipment_id)::int AS "equipmentCount",
              COUNT(DISTINCT pp.equipment_id) FILTER (WHERE pp.active)::int AS "equipmentWithPlan",
              (COUNT(DISTINCT cv.equipment_id) - COUNT(DISTINCT pp.equipment_id) FILTER (WHERE pp.active))::int AS "uncovered",
              COUNT(pp.id) FILTER (WHERE pp.active AND pp.next_due_date IS NOT NULL
                                     AND pp.next_due_date <= CURRENT_DATE + 30)::int AS "dueWithin30Days",
              COUNT(pp.id) FILTER (WHERE pp.active AND pp.next_due_date IS NOT NULL
                                     AND pp.next_due_date < CURRENT_DATE)::int AS "overdue"
       FROM service_contracts c
       LEFT JOIN maintenance_districts d ON d.id = c.district_id
       LEFT JOIN covered cv ON cv.contract_id = c.id
       LEFT JOIN maintenance_preventive_plans pp
              ON pp.equipment_id = cv.equipment_id AND (pp.contract_id = c.id OR pp.contract_id IS NULL)
       WHERE c.status = 'نشط'
       GROUP BY c.id, c.contract_number, d.name_ar, c.pm_visits_per_year
       ORDER BY "uncovered" DESC, c.contract_number`);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب تغطية الوقائية" }); }
});

export default router;
