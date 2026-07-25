import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, pool, costCentersTable, insertCostCenterSchema, updateCostCenterSchema } from "@workspace/db";

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
