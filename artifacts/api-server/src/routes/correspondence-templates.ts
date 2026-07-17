import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  correspondenceTemplatesTable,
  insertCorrespondenceTemplateSchema,
  updateCorrespondenceTemplateSchema,
} from "@workspace/db";

const router = Router();

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ── LIST ── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category } = req.query as Record<string, string>;
    let query = db.select().from(correspondenceTemplatesTable).$dynamic();
    if (category) query = query.where(eq(correspondenceTemplatesTable.category, category));
    const rows = await query.orderBy(correspondenceTemplatesTable.name);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب النماذج" });
  }
});

/* ── GET ONE ── */
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select().from(correspondenceTemplatesTable).where(eq(correspondenceTemplatesTable.id, id));
    if (!row) return res.status(404).json({ error: "النموذج غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب النموذج" });
  }
});

/* ── CREATE (custom templates only) ── */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertCorrespondenceTemplateSchema.parse({ ...req.body, isSystem: false });
    const [row] = await db.insert(correspondenceTemplatesTable).values({
      ...data,
      createdByUserId: req.session.userId!,
    }).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء النموذج" });
  }
});

/* ── UPDATE (custom templates only) ── */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(correspondenceTemplatesTable).where(eq(correspondenceTemplatesTable.id, id));
    if (!existing) return res.status(404).json({ error: "النموذج غير موجود" });
    if (existing.isSystem) return res.status(400).json({ error: "لا يمكن تعديل نموذج نظام جاهز" });

    const data = updateCorrespondenceTemplateSchema.parse(req.body);
    const [row] = await db.update(correspondenceTemplatesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(correspondenceTemplatesTable.id, id))
      .returning();
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث النموذج" });
  }
});

/* ── DELETE (custom templates only) ── */
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(correspondenceTemplatesTable).where(eq(correspondenceTemplatesTable.id, id));
    if (!existing) return res.status(404).json({ error: "النموذج غير موجود" });
    if (existing.isSystem) return res.status(400).json({ error: "لا يمكن حذف نموذج نظام جاهز" });

    await db.delete(correspondenceTemplatesTable).where(eq(correspondenceTemplatesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف النموذج" });
  }
});

export default router;
