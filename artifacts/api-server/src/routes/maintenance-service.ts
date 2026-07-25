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

export default router;
