import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

/* المرحلة ٧: دفتر التسعير المرجعي (كتالوج أصناف بأسعار تكلفة/بيع قياسية). للمدير فقط. */

const router = Router();
const isAdmin = (req: Request) => req.session.role === "admin";

const COLS = `id, item_code AS "itemCode", item_name AS "itemName", category, unit,
  standard_cost AS "standardCost", standard_price AS "standardPrice", currency, notes,
  is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`;

router.get("/", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const params: any[] = [];
    let where = "";
    if (search) { params.push(`%${search}%`); where = `WHERE item_code ILIKE $1 OR item_name ILIKE $1 OR category ILIKE $1`; }
    const { rows } = await pool.query(`SELECT ${COLS} FROM pricing_book ${where} ORDER BY item_name`, params);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب دفتر التسعير" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const b = req.body ?? {};
    if (!b.itemCode?.trim() || !b.itemName?.trim()) return res.status(400).json({ error: "رمز الصنف واسمه مطلوبان" });
    const { rows } = await pool.query(
      `INSERT INTO pricing_book (item_code, item_name, category, unit, standard_cost, standard_price, currency, notes, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,true)) RETURNING ${COLS}`,
      [b.itemCode.trim(), b.itemName.trim(), b.category?.trim() || null, b.unit?.trim() || null,
       Number(b.standardCost) || 0, Number(b.standardPrice) || 0, (b.currency?.trim() || "KWD"), b.notes?.trim() || null,
       b.isActive]
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "رمز الصنف مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في إضافة الصنف" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    const b = req.body ?? {};
    const sets: string[] = [];
    const params: any[] = [];
    const map: Record<string, string> = { itemCode: "item_code", itemName: "item_name", category: "category", unit: "unit",
      standardCost: "standard_cost", standardPrice: "standard_price", currency: "currency", notes: "notes", isActive: "is_active" };
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) {
        params.push(["standardCost", "standardPrice"].includes(k) ? Number(b[k]) || 0 : b[k]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "لا تغييرات" });
    params.push(Number(req.params.id));
    const { rows } = await pool.query(`UPDATE pricing_book SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING ${COLS}`, params);
    if (!rows.length) return res.status(404).json({ error: "الصنف غير موجود" });
    return res.json(rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "رمز الصنف مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في تحديث الصنف" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "للمدير فقط" });
  try {
    await pool.query(`DELETE FROM pricing_book WHERE id = $1`, [Number(req.params.id)]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الصنف" });
  }
});

export default router;
