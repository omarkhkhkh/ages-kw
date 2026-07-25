import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, pool, costCentersTable, insertCostCenterSchema, updateCostCenterSchema, costAllocationRulesTable, insertCostAllocationRuleSchema } from "@workspace/db";

const router = Router();
const isAdmin = (req: Request) => req.session.role === "admin";

/* مراكز التكلفة/الربح — النواة الموحّدة للنظام المالي. للمدير فقط. */

/* الأصول الموحّدة (معدات + مركبات) — تقرير رأسمالي عابر للأقسام. static قبل /:id */
router.get("/assets", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const assetType = req.query.assetType as string | undefined;
    const { rows } = await pool.query(
      `SELECT a.id, a.asset_type AS "assetType", a.name, a.code, a.category, a.status,
              a.location, a.branch, a.purchase_value AS "purchaseValue", a.purchase_date AS "purchaseDate",
              a.legacy_source AS "legacySource", a.legacy_id AS "legacyId",
              a.cost_center_id AS "costCenterId", cc.name AS "costCenterName"
       FROM assets a LEFT JOIN cost_centers cc ON cc.id = a.cost_center_id
       ${assetType ? "WHERE a.asset_type = $1" : ""}
       ORDER BY a.purchase_date DESC NULLS LAST, a.name`,
      assetType ? [assetType] : []
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الأصول" });
  }
});

/* الميزانيات الموحّدة لكل قسم — static قبل /:id */
router.get("/budgets", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { rows } = await pool.query(
      `SELECT b.id, b.cost_center_id AS "costCenterId", cc.name AS "costCenterName",
              b.year, b.month, b.target_amount AS "targetAmount"
       FROM cost_center_budgets b JOIN cost_centers cc ON cc.id = b.cost_center_id
       WHERE b.year = $1 ORDER BY cc.name, b.month`,
      [year]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الميزانيات" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const rows = await db.select().from(costCentersTable).orderBy(costCentersTable.name);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الأقسام" });
  }
});

/* ── قواعد توزيع التكاليف غير المباشرة (static قبل /:id) ── */
router.get("/allocation-rules", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.cost_center_id AS "costCenterId", cc.name AS "costCenterName",
              r.cost_type AS "costType", r.driver, r.share_ratio AS "shareRatio", r.notes
       FROM cost_allocation_rules r JOIN cost_centers cc ON cc.id = r.cost_center_id
       ORDER BY cc.name`
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب قواعد التوزيع" });
  }
});

router.post("/allocation-rules", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const data = insertCostAllocationRuleSchema.parse({
      ...req.body,
      shareRatio: req.body?.shareRatio != null ? String(req.body.shareRatio) : "0",
    });
    const [row] = await db.insert(costAllocationRulesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة القاعدة" });
  }
});

router.delete("/allocation-rules/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    await db.delete(costAllocationRulesTable).where(eq(costAllocationRulesTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف القاعدة" });
  }
});

/**
 * الربحية بثلاث طبقات لكل مركز ربح:
 *  ١) الهامش المباشر = الدخل المباشر − المصروف المباشر (ببُعد القسم)
 *  ٢) بعد التحميل   = الهامش المباشر − نصيب القسم من مجمّع التكاليف المشتركة (allocatable × share_ratio)
 * المجمّع المشترك = مصروفات الأقسام من نوع allocatable. مجموع النِّسب يُعرض للموازنة (يُفترض ≈ ١).
 */
router.get("/profitability", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const [{ rows: poolRows }, { rows: ratioRows }, { rows: centers }] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(fe.amount),0)::numeric AS pool FROM finance_expenses fe
         JOIN cost_centers cc ON cc.id = fe.cost_center_id
         WHERE cc.type = 'allocatable' AND EXTRACT(YEAR FROM COALESCE(fe.transaction_date, fe.created_at::date))::int = $1`,
        [year]
      ),
      pool.query(`SELECT cost_center_id, COALESCE(SUM(share_ratio),0)::numeric AS ratio FROM cost_allocation_rules GROUP BY cost_center_id`),
      pool.query(`SELECT id, name, type FROM cost_centers WHERE type = 'profit' AND is_active = true ORDER BY name`),
    ]);
    const pool_ = Number(poolRows[0]?.pool ?? 0);
    const ratioBy: Record<number, number> = {};
    for (const r of ratioRows) ratioBy[r.cost_center_id] = Number(r.ratio);
    const totalShareRatio = ratioRows.reduce((s: number, r: any) => s + Number(r.ratio), 0);

    const perCenter = await Promise.all((centers as any[]).map(async (c) => {
      const { rows: inc } = await pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric AS v FROM finance_income WHERE cost_center_id=$1 AND EXTRACT(YEAR FROM date)::int=$2`, [c.id, year]);
      const { rows: exp } = await pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric AS v FROM finance_expenses WHERE cost_center_id=$1 AND EXTRACT(YEAR FROM COALESCE(transaction_date, created_at::date))::int=$2`, [c.id, year]);
      const directIncome = Number(inc[0].v);
      const directExpense = Number(exp[0].v);
      const directMargin = directIncome - directExpense;
      const shareRatio = ratioBy[c.id] ?? 0;
      const allocatedShare = pool_ * shareRatio;
      return {
        costCenterId: c.id, name: c.name,
        directIncome, directExpense, directMargin,
        shareRatio, allocatedShare,
        afterAllocation: directMargin - allocatedShare,
      };
    }));
    return res.json({ year, allocatablePool: pool_, totalShareRatio, centers: perCenter });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في حساب الربحية" });
  }
});

/**
 * لوحة الشركة الموحّدة — نظرة تنفيذية واحدة على كل الأقسام من الدفتر العام (بُعد القسم المخزّن):
 *  · إجماليات الدخل/المصروف/الصافي + الرأسمالي، وتفصيل المصروف حسب نوع المركز.
 *  · شلال الربح: الدخل الكلي − مصروف مراكز الربح − مراكز التكلفة − التكاليف المشتركة = صافي الربح.
 *  · اتجاه شهري (١٢ شهرًا) + تنبؤ نهاية السنة بمعدّل الجريان (YTD ÷ الأشهر المنقضية × ١٢).
 * قراءة فقط، إضافية — لا تلمس أي مسار تشغيلي.
 */
router.get("/company-dashboard", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const [{ rows: centerRows }, { rows: monthRows }, { rows: capexRows }] = await Promise.all([
      pool.query(
        `SELECT cc.id, cc.name, cc.type,
            COALESCE((SELECT SUM(fi.amount) FROM finance_income fi
               WHERE fi.cost_center_id = cc.id AND EXTRACT(YEAR FROM fi.date)::int = $1), 0)::numeric AS income,
            COALESCE((SELECT SUM(fe.amount) FROM finance_expenses fe
               WHERE fe.cost_center_id = cc.id
                 AND EXTRACT(YEAR FROM COALESCE(fe.transaction_date, fe.created_at::date))::int = $1), 0)::numeric AS expense
         FROM cost_centers cc WHERE cc.is_active = true ORDER BY cc.name`,
        [year]
      ),
      pool.query(
        `SELECT gs.month,
            COALESCE((SELECT SUM(fi.amount) FROM finance_income fi
               WHERE EXTRACT(YEAR FROM fi.date)::int = $1 AND EXTRACT(MONTH FROM fi.date)::int = gs.month), 0)::numeric AS income,
            COALESCE((SELECT SUM(fe.amount) FROM finance_expenses fe
               WHERE EXTRACT(YEAR  FROM COALESCE(fe.transaction_date, fe.created_at::date))::int = $1
                 AND EXTRACT(MONTH FROM COALESCE(fe.transaction_date, fe.created_at::date))::int = gs.month), 0)::numeric AS expense
         FROM generate_series(1,12) AS gs(month) ORDER BY gs.month`,
        [year]
      ),
      pool.query(
        `SELECT COALESCE(SUM(purchase_value),0)::numeric AS capex FROM assets
         WHERE purchase_date IS NOT NULL AND EXTRACT(YEAR FROM purchase_date)::int = $1`,
        [year]
      ),
    ]);

    const byCenter = (centerRows as any[]).map((c) => {
      const income = Number(c.income), expense = Number(c.expense);
      return { id: c.id, name: c.name, type: c.type, income, expense, margin: income - expense };
    });
    const sumExpByType = (t: string) => byCenter.filter((c) => c.type === t).reduce((s, c) => s + c.expense, 0);
    const income = byCenter.reduce((s, c) => s + c.income, 0);
    const expense = byCenter.reduce((s, c) => s + c.expense, 0);
    const profitExpense = sumExpByType("profit");
    const costExpense = sumExpByType("cost");
    const allocatableExpense = sumExpByType("allocatable");
    const capex = Number(capexRows[0]?.capex ?? 0);
    const net = income - expense;

    const monthly = (monthRows as any[]).map((m) => {
      const inc = Number(m.income), exp = Number(m.expense);
      return { month: m.month, income: inc, expense: exp, net: inc - exp };
    });

    const waterfall = [
      { label: "الدخل الكلي", value: income, kind: "start" as const },
      { label: "مصروف مراكز الربح", value: -profitExpense, kind: "down" as const },
      { label: "مراكز التكلفة", value: -costExpense, kind: "down" as const },
      { label: "التكاليف المشتركة", value: -allocatableExpense, kind: "down" as const },
      { label: "صافي الربح", value: net, kind: "total" as const },
    ];

    // تنبؤ بمعدّل الجريان
    const now = new Date();
    const curYear = now.getFullYear(), curMonth = now.getMonth() + 1;
    const monthsElapsed = year < curYear ? 12 : year > curYear ? 0 : curMonth;
    const isComplete = monthsElapsed >= 12;
    const project = (v: number) => (monthsElapsed > 0 && !isComplete ? (v / monthsElapsed) * 12 : v);
    const forecast = {
      monthsElapsed, isComplete,
      projectedIncome: project(income),
      projectedExpense: project(expense),
      projectedNet: project(income) - project(expense),
    };

    return res.json({
      year,
      totals: { income, expense, net, profitExpense, costExpense, allocatableExpense, capex },
      byCenter, monthly, waterfall, forecast,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب لوحة الشركة" });
  }
});

/**
 * محرّك الميزانية الموحّد — تقرير قياسي واحد لأي قسم يعتمد فقط على بُعد القسم المخزّن:
 *   المصروف/الدخل من الدفتر (cost_center_id) · الميزانية من cost_center_budgets · الرأسمالي من assets.
 * يُعمّم استعلامَي ميزانية الصيانة/النقل في محرّك واحد. تشغيل متوازٍ — لا يستبدلهما بعد.
 */
router.get("/:id/budget-summary", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  const cc = Number(req.params.id);
  if (!cc) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { rows } = await pool.query(
      `SELECT gs.month,
         COALESCE(b.target_amount, 0)::numeric AS budget,
         COALESCE((SELECT SUM(fe.amount) FROM finance_expenses fe
            WHERE fe.cost_center_id = $1
              AND EXTRACT(YEAR  FROM COALESCE(fe.transaction_date, fe.created_at::date))::int = $2
              AND EXTRACT(MONTH FROM COALESCE(fe.transaction_date, fe.created_at::date))::int = gs.month), 0)::numeric AS spent,
         COALESCE((SELECT SUM(fi.amount) FROM finance_income fi
            WHERE fi.cost_center_id = $1
              AND EXTRACT(YEAR FROM fi.date)::int = $2 AND EXTRACT(MONTH FROM fi.date)::int = gs.month), 0)::numeric AS income,
         COALESCE((SELECT SUM(a.purchase_value) FROM assets a
            WHERE a.cost_center_id = $1 AND a.purchase_date IS NOT NULL
              AND EXTRACT(YEAR FROM a.purchase_date)::int = $2 AND EXTRACT(MONTH FROM a.purchase_date)::int = gs.month), 0)::numeric AS capex
       FROM generate_series(1,12) AS gs(month)
       LEFT JOIN cost_center_budgets b ON b.cost_center_id = $1 AND b.year = $2 AND b.month = gs.month
       ORDER BY gs.month`,
      [cc, year]
    );
    const monthly = rows.map((r: any) => ({
      month: r.month, budget: Number(r.budget), spent: Number(r.spent),
      income: Number(r.income), capex: Number(r.capex), net: Number(r.income) - Number(r.spent),
    }));
    const annualBudget = monthly.reduce((s, r) => s + r.budget, 0);
    const annualSpent  = monthly.reduce((s, r) => s + r.spent, 0);
    const annualIncome = monthly.reduce((s, r) => s + r.income, 0);
    const annualCapex  = monthly.reduce((s, r) => s + r.capex, 0);
    return res.json({
      costCenterId: cc, year,
      annualBudget, annualSpent, annualRemaining: annualBudget - annualSpent,
      annualIncome, annualCapex, annualNet: annualIncome - annualSpent,
      monthly,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب ملخص ميزانية القسم" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const data = insertCostCenterSchema.parse(req.body);
    const [row] = await db.insert(costCentersTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "اسم القسم مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في إنشاء القسم" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const data = updateCostCenterSchema.parse(req.body);
    const [row] = await db.update(costCentersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(costCentersTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "القسم غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "اسم القسم مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في تحديث القسم" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    await db.delete(costCentersTable).where(eq(costCentersTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف القسم" });
  }
});

export default router;
