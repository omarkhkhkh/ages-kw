import { Router, type Request, type Response } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, competitorsTable, insertCompetitorSchema, updateCompetitorSchema } from "@workspace/db";

const router = Router();

/* GET / — list (supports ?q=search) */
router.get("/", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    let rows;
    if (q) {
      rows = await db
        .select()
        .from(competitorsTable)
        .where(or(ilike(competitorsTable.name, `%${q}%`), ilike(competitorsTable.shortName, `%${q}%`)))
        .orderBy(competitorsTable.name);
    } else {
      rows = await db.select().from(competitorsTable).orderBy(competitorsTable.name);
    }
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب قائمة الشركات" });
  }
});

/* POST / — create */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertCompetitorSchema.parse(req.body);
    const [row] = await db.insert(competitorsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "اسم الشركة موجود مسبقاً" });
    return res.status(500).json({ error: "فشل في إضافة الشركة" });
  }
});

/* PATCH /:id */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = updateCompetitorSchema.parse(req.body);
    const [row] = await db.update(competitorsTable).set(data).where(eq(competitorsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "الشركة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "اسم الشركة موجود مسبقاً" });
    return res.status(500).json({ error: "فشل في تحديث الشركة" });
  }
});

/* DELETE /:id — admin only enforced via requireAdmin in caller if needed */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(competitorsTable).where(eq(competitorsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الشركة" });
  }
});

export default router;
