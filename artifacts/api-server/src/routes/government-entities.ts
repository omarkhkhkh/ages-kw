import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, governmentEntitiesTable, insertGovernmentEntitySchema, updateGovernmentEntitySchema } from "@workspace/db";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const entities = await db
      .select()
      .from(governmentEntitiesTable)
      .orderBy(governmentEntitiesTable.name);
    return res.json(entities);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الجهات الحكومية" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [entity] = await db
      .select()
      .from(governmentEntitiesTable)
      .where(eq(governmentEntitiesTable.id, id));
    if (!entity) return res.status(404).json({ error: "الجهة غير موجودة" });
    return res.json(entity);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الجهة" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertGovernmentEntitySchema.parse(req.body);
    const [entity] = await db.insert(governmentEntitiesTable).values(data).returning();
    return res.status(201).json(entity);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الجهة" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateGovernmentEntitySchema.parse(req.body);
    const [entity] = await db
      .update(governmentEntitiesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(governmentEntitiesTable.id, id))
      .returning();
    if (!entity) return res.status(404).json({ error: "الجهة غير موجودة" });
    return res.json(entity);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الجهة" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(governmentEntitiesTable).where(eq(governmentEntitiesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الجهة" });
  }
});

export default router;
