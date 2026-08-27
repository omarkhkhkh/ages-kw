import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

/* ═══ المركز المالي — الخارطة الموحّدة، المرحلة ٧ (الأخيرة) ═══
   الأبواب الخمسة: ① لوحة القيادة (تقويم السيولة + الإنذارات) ② دفتر العمليات (نوافذ
   على القائم) ③ مراكز التكلفة والربح (الامتصاص وتكلفة الجاهزية) ④ الميزانيات ذات
   الأسنان ⑤ طاولة المدير المالي (كل ما ينتظر رأيه في مكان واحد). */

const router = Router();

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
const canSee = async (req: Request) => (await isGM(req)) || (await isCFO(req)) || (await isExec(req));
const canDecide = async (req: Request) => (await isGM(req)) || (await isCFO(req));

/* ── ① تقويم السيولة: تنبؤ ستة أشهر — الداخل من العقود النشطة والخارج من المستحقات ── */
router.get("/liquidity", async (req: Request, res: Response) => {
  if (!(await canSee(req))) return res.status(403).json({ error: "المركز المالي للمديرين" });
  const months = Math.min(12, Number(req.query.months) || 6);
  const safety = Number(req.query.safety) || 0;
  try {
    // الرصيد النقدي الحالي (نفس تعريف النظام: الدخل − المدفوع)
    const { rows: bal } = await pool.query(
      `SELECT (SELECT COALESCE(SUM(amount),0) FROM finance_income)::numeric
            - (SELECT COALESCE(SUM(amount),0) FROM finance_expenses WHERE status = 'paid')::numeric AS cash`);
    const cash = Number(bal[0].cash);

    // الخارج المتوقع: مصروفات معلقة باستحقاقها (وما لا استحقاق له → الشهر الأول)
    const { rows: out } = await pool.query(
      `SELECT GREATEST(0, LEAST($1 - 1,
                (EXTRACT(YEAR FROM COALESCE(due_date, CURRENT_DATE)) - EXTRACT(YEAR FROM CURRENT_DATE)) * 12
              + (EXTRACT(MONTH FROM COALESCE(due_date, CURRENT_DATE)) - EXTRACT(MONTH FROM CURRENT_DATE))))::int AS m,
              COALESCE(SUM(amount),0)::numeric AS total
       FROM finance_expenses WHERE status <> 'paid'
       GROUP BY 1`, [months]);

    // الداخل المتوقع: المتبقي من كل عقد نشط موزعًا على أشهره المتبقية حتى نهايته
    const { rows: contracts } = await pool.query(
      `SELECT c.id, c.contract_number AS "contractNumber", c.contract_value::numeric AS value, c.end_date AS "endDate",
              ge.name AS "entityName",
              COALESCE((SELECT SUM(amount) FROM finance_income fi WHERE fi.contract_id = c.id),0)::numeric AS collected
       FROM contracts c LEFT JOIN government_entities ge ON ge.id = c.government_entity_id
       WHERE c.status = 'active' AND c.contract_value IS NOT NULL`);
    const inflow = new Array(months).fill(0);
    const receivables: any[] = [];
    const now = new Date();
    for (const c of contracts) {
      const remaining = Number(c.value) - Number(c.collected);
      if (remaining <= 0) continue;
      let monthsLeft = 1;
      if (c.endDate) {
        const end = new Date(c.endDate);
        monthsLeft = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + 1);
      }
      const per = remaining / monthsLeft;
      for (let m = 0; m < Math.min(months, monthsLeft); m++) inflow[m] += per;
      receivables.push({ contractId: c.id, contractNumber: c.contractNumber, entityName: c.entityName, remaining: Math.round(remaining * 1000) / 1000, monthsLeft });
    }
    const outflow = new Array(months).fill(0);
    for (const r of out) outflow[Number(r.m)] += Number(r.total);

    // منحنى الرصيد المتوقع شهرًا بشهر + أول شهر يهبط تحت حد الأمان
    const calendar: any[] = [];
    let running = cash;
    let firstBreach: number | null = null;
    for (let m = 0; m < months; m++) {
      running += inflow[m] - outflow[m];
      const d = new Date(now.getFullYear(), now.getMonth() + m + 1, 1);
      calendar.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        inflow: Math.round(inflow[m] * 1000) / 1000,
        outflow: Math.round(outflow[m] * 1000) / 1000,
        projectedBalance: Math.round(running * 1000) / 1000,
        belowSafety: running < safety,
      });
      if (running < safety && firstBreach === null) firstBreach = m;
    }

    // أداتا العلاج: استعجال التحصيل (أكبر الذمم) وتأخير الصرف (مستحقات قابلة للتأجيل)
    receivables.sort((a, b) => b.remaining - a.remaining);
    const { rows: deferrable } = await pool.query(
      `SELECT e.id, e.description, e.amount::numeric, e.due_date AS "dueDate", e.vendor, e.category
       FROM finance_expenses e WHERE e.status <> 'paid'
       ORDER BY e.amount DESC LIMIT 10`);

    return res.json({ cash, safety, calendar, firstBreach, collectNow: receivables.slice(0, 8), deferCandidates: deferrable });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل حساب تقويم السيولة" }); }
});

/* ── ③ تكلفة الجاهزية ونسب الامتصاص — القسم بلا عقود تغطيه يظهر باسمه ── */
router.get("/readiness", async (req: Request, res: Response) => {
  if (!(await canSee(req))) return res.status(403).json({ error: "المركز المالي للمديرين" });
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const { rows } = await pool.query(
      `SELECT cc.id, cc.name, cc.type AS "centerType",
              COALESCE(SUM(e.amount),0)::numeric AS "totalCosts",
              COALESCE(SUM(e.amount) FILTER (WHERE e.contract_id IS NOT NULL),0)::numeric AS "coveredByContracts"
       FROM cost_centers cc
       LEFT JOIN finance_expenses e ON e.cost_center_id = cc.id
            AND EXTRACT(YEAR FROM COALESCE(e.transaction_date, e.created_at))::int = $1
       GROUP BY cc.id, cc.name, cc.type
       HAVING COALESCE(SUM(e.amount),0) > 0
       ORDER BY "totalCosts" DESC`, [year]);
    const centers = rows.map((r: any) => {
      const total = Number(r.totalCosts), covered = Number(r.coveredByContracts);
      return {
        ...r, totalCosts: total, coveredByContracts: covered,
        readinessCost: Math.round((total - covered) * 1000) / 1000,
        absorptionPct: total > 0 ? Math.round((covered / total) * 1000) / 10 : null,
      };
    });
    const totalReadiness = centers.reduce((s: number, c: any) => s + c.readinessCost, 0);
    return res.json({ year, centers, totalReadiness: Math.round(totalReadiness * 1000) / 1000 });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل حساب الجاهزية" }); }
});

/* ── ① شريط الإنذارات ── */
router.get("/alerts", async (req: Request, res: Response) => {
  if (!(await canSee(req))) return res.status(403).json({ error: "المركز المالي للمديرين" });
  try {
    const { rows } = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM case_files WHERE status = 'موقوف ماليًا') AS "heldFiles",
        (SELECT COUNT(*)::int FROM case_files WHERE status = 'بانتظار الاعتماد') AS "pendingFiles",
        (SELECT COUNT(*)::int FROM budget_overrun_requests WHERE status = 'معلق') AS "pendingOverruns",
        (SELECT COUNT(*)::int FROM contracts c WHERE c.status = 'active' AND c.contract_value IS NOT NULL AND c.contract_value > 0
           AND (SELECT COALESCE(SUM(amount),0) FROM finance_expenses e WHERE e.contract_id = c.id) >= c.contract_value * 0.8) AS "bleedingContracts",
        (SELECT COUNT(*)::int FROM (
           SELECT expiry_date AS e FROM government_registrations WHERE expiry_date IS NOT NULL
           UNION ALL SELECT expiry_date FROM company_documents WHERE expiry_date IS NOT NULL
           UNION ALL SELECT d.expiry FROM workers w CROSS JOIN LATERAL (VALUES
             (w.residency_expiry),(w.passport_expiry),(w.health_insurance_expiry),(w.work_permit_expiry)) AS d(expiry)
             WHERE w.status = 'active' AND d.expiry IS NOT NULL
         ) x WHERE x.e <= CURRENT_DATE + 30) AS "obligationsSoon",
        (SELECT (SELECT COALESCE(SUM(amount),0) FROM financial_events WHERE event_type='income')
              = (SELECT COALESCE(SUM(amount),0) FROM finance_income)
             AND (SELECT COALESCE(SUM(amount),0) FROM financial_events WHERE event_type='expense')
              = (SELECT COALESCE(SUM(amount),0) FROM finance_expenses)) AS "ledgerInSync"`);
    return res.json(rows[0]);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الإنذارات" }); }
});

/* ── ④ ميزانيات الفئات: الثلاثية الحية ── */
router.get("/category-budgets", async (req: Request, res: Response) => {
  if (!(await canSee(req))) return res.status(403).json({ error: "المركز المالي للمديرين" });
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.cost_center_id AS "costCenterId", cc.name AS "centerName", b.category, b.amount::numeric AS allocated,
              COALESCE((SELECT SUM(e.amount) FROM finance_expenses e
                        WHERE e.cost_center_id = b.cost_center_id AND e.category = b.category
                          AND EXTRACT(YEAR FROM COALESCE(e.transaction_date, e.created_at))::int = b.year),0)::numeric AS spent
       FROM cost_center_category_budgets b
       JOIN cost_centers cc ON cc.id = b.cost_center_id
       WHERE b.year = $1 ORDER BY cc.name, b.category`, [year]);
    return res.json(rows.map((r: any) => {
      const allocated = Number(r.allocated), spent = Number(r.spent);
      const pct = allocated > 0 ? Math.round((spent / allocated) * 1000) / 10 : null;
      return { ...r, allocated, spent, remaining: Math.round((allocated - spent) * 1000) / 1000, pct,
               alert: pct != null && pct >= 100 ? "تجاوز" : pct != null && pct >= 80 ? "إنذار" : null };
    }));
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الميزانيات" }); }
});

// إنشاء/تعديل بند ميزانية (upsert) — واقتراح القيمة من مصروف العام المنصرم يعرضه العميل
router.post("/category-budgets", async (req: Request, res: Response) => {
  if (!(await canDecide(req))) return res.status(403).json({ error: "الميزانيات للمدير المالي أو العام" });
  const costCenterId = Number(req.body?.costCenterId);
  const year = Number(req.body?.year) || new Date().getFullYear();
  const category = String(req.body?.category ?? "").trim();
  const amount = Number(req.body?.amount);
  if (!costCenterId || !category || !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "المركز والفئة والمبلغ مطلوبة" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO cost_center_category_budgets (cost_center_id, year, category, amount)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (cost_center_id, year, category) DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()
       RETURNING id`, [costCenterId, year, category, String(amount)]);
    return res.status(201).json({ id: rows[0].id });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل حفظ الميزانية" }); }
});
router.delete("/category-budgets/:id", async (req: Request, res: Response) => {
  if (!(await canDecide(req))) return res.status(403).json({ error: "الميزانيات للمدير المالي أو العام" });
  try { await pool.query(`DELETE FROM cost_center_category_budgets WHERE id = $1`, [Number(req.params.id)]); return res.status(204).send(); }
  catch (e) { console.error(e); return res.status(500).json({ error: "فشل الحذف" }); }
});

/* ── طلبات التجاوز: تُنشأ حين يصطدم صرفٌ بميزانية مستهلكة، ويحسمها المالي ── */
router.post("/overrun-requests", async (req: Request, res: Response) => {
  const costCenterId = Number(req.body?.costCenterId);
  const category = String(req.body?.category ?? "").trim();
  const year = Number(req.body?.year) || new Date().getFullYear();
  const amount = Number(req.body?.amount);
  const reason = String(req.body?.reason ?? "").trim();
  if (!costCenterId || !category || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "المركز والفئة والمبلغ مطلوبة" });
  if (!reason) return res.status(400).json({ error: "سبب التجاوز إلزامي — يقرؤه المدير المالي" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO budget_overrun_requests (cost_center_id, category, year, amount, reason, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [costCenterId, category, year, String(amount), reason, req.session.userId ?? null]);
    return res.status(201).json({ id: rows[0].id });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل إنشاء الطلب" }); }
});
router.get("/overrun-requests", async (req: Request, res: Response) => {
  if (!(await canSee(req))) return res.status(403).json({ error: "للمديرين" });
  try {
    const params: any[] = [];
    let where = "";
    if (req.query.status) { params.push(req.query.status); where = "WHERE r.status = $1"; }
    const { rows } = await pool.query(
      `SELECT r.id, r.category, r.year, r.amount::numeric, r.reason, r.status, r.created_at AS "createdAt",
              cc.name AS "centerName", ru.full_name AS "requestedByName", du.full_name AS "decidedByName"
       FROM budget_overrun_requests r
       JOIN cost_centers cc ON cc.id = r.cost_center_id
       LEFT JOIN users ru ON ru.id = r.requested_by
       LEFT JOIN users du ON du.id = r.decided_by
       ${where} ORDER BY r.id DESC LIMIT 100`, params);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الطلبات" }); }
});
async function decideOverrun(req: Request, res: Response, approve: boolean) {
  if (!(await canDecide(req))) return res.status(403).json({ error: "الحسم للمدير المالي أو العام" });
  try {
    const { rows } = await pool.query(
      `UPDATE budget_overrun_requests SET status = $1, decided_by = $2, decided_at = now()
       WHERE id = $3 AND status = 'معلق' RETURNING id`,
      [approve ? "موافق" : "مرفوض", req.session.userId ?? null, Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: "الطلب غير موجود أو محسوم" });
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل الحسم" }); }
}
router.post("/overrun-requests/:id/approve", (req, res) => decideOverrun(req, res, true));
router.post("/overrun-requests/:id/reject", (req, res) => decideOverrun(req, res, false));

/* ── ⑤ طاولة المدير المالي: كل ما ينتظر رأيه في مكان واحد ── */
router.get("/cfo-desk", async (req: Request, res: Response) => {
  if (!(await canSee(req))) return res.status(403).json({ error: "الطاولة للمديرين" });
  try {
    const { rows: pendingFiles } = await pool.query(
      `SELECT cf.id, cf.entity_type AS "entityType", cf.entity_id AS "entityId", cf.submitted_at AS "submittedAt",
              ru.full_name AS "raisedByName"
       FROM case_files cf LEFT JOIN users ru ON ru.id = cf.raised_by
       WHERE cf.status = 'بانتظار الاعتماد' ORDER BY cf.submitted_at LIMIT 30`);
    const { rows: heldFiles } = await pool.query(
      `SELECT cf.id, cf.entity_type AS "entityType", cf.entity_id AS "entityId", cf.hold_reason AS "holdReason",
              cf.held_at AS "heldAt", hu.full_name AS "heldByName"
       FROM case_files cf LEFT JOIN users hu ON hu.id = cf.held_by
       WHERE cf.status = 'موقوف ماليًا' ORDER BY cf.held_at DESC LIMIT 30`);
    const { rows: overruns } = await pool.query(
      `SELECT r.id, r.category, r.amount::numeric, r.reason, cc.name AS "centerName", ru.full_name AS "requestedByName"
       FROM budget_overrun_requests r JOIN cost_centers cc ON cc.id = r.cost_center_id
       LEFT JOIN users ru ON ru.id = r.requested_by WHERE r.status = 'معلق' ORDER BY r.id`);
    const { rows: attentionVariances } = await pool.query(
      `SELECT v.id, v.item_name AS "itemName", v.estimated_cost::numeric AS "estimatedCost", v.actual_cost::numeric AS "actualCost",
              v.reason, c.contract_number AS "contractNumber", s.name AS "supplierName",
              ROUND(((v.actual_cost - v.estimated_cost) / v.estimated_cost) * 100, 1) AS "risePct"
       FROM contract_variances v
       JOIN contracts c ON c.id = v.contract_id
       LEFT JOIN suppliers s ON s.id = v.supplier_id
       WHERE v.estimated_cost IS NOT NULL AND v.estimated_cost > 0
         AND v.actual_cost >= v.estimated_cost * 1.05
       ORDER BY v.id DESC LIMIT 20`);
    const { rows: overrideLog } = await pool.query(
      `SELECT e.id, e.event, e.details, e.created_at AS "createdAt", u.full_name AS "actorName",
              cf.entity_type AS "entityType", cf.entity_id AS "entityId"
       FROM case_file_events e
       JOIN case_files cf ON cf.id = e.case_file_id
       LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.event LIKE '%تجاوز%' ORDER BY e.id DESC LIMIT 20`);
    return res.json({ pendingFiles, heldFiles, overruns, attentionVariances, overrideLog });
  } catch (e) { console.error(e); return res.status(500).json({ error: "فشل في جلب الطاولة" }); }
});

export default router;
