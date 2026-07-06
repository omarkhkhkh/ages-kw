import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, suppliersTable, insertSupplierSchema, updateSupplierSchema } from "@workspace/db";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const suppliers = await db
      .select()
      .from(suppliersTable)
      .orderBy(suppliersTable.name);
    return res.json(suppliers);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الموردين" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [supplier] = await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, id));
    if (!supplier) return res.status(404).json({ error: "المورد غير موجود" });
    return res.json(supplier);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المورد" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertSupplierSchema.parse(req.body);
    const [supplier] = await db.insert(suppliersTable).values(data).returning();
    return res.status(201).json(supplier);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء المورد" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateSupplierSchema.parse(req.body);
    const [supplier] = await db
      .update(suppliersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suppliersTable.id, id))
      .returning();
    if (!supplier) return res.status(404).json({ error: "المورد غير موجود" });
    return res.json(supplier);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث المورد" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المورد" });
  }
});

export default router;
