import { Router, type Request, type Response } from "express";
import { desc, ilike, or, and, sql, eq } from "drizzle-orm";
import { db, governmentRegistrationsTable, insertGovernmentRegistrationSchema, updateGovernmentRegistrationSchema } from "@workspace/db";

const router = Router();

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ── STATS ── */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const where = companyId ? sql`where company_id = ${companyId}` : sql``;
    const [row] = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) filter (where expiry_date > current_date + interval '30 days' or expiry_date is null)::int AS active,
        count(*) filter (where expiry_date <= current_date + interval '30 days' and expiry_date >= current_date)::int AS expiring30,
        count(*) filter (where expiry_date < current_date)::int AS expired
      FROM government_registrations
      ${where}
    `).then((r: any) => r.rows);
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات التسجيلات" });
  }
});

/* ── LIST ── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, companyId } = req.query as Record<string, string>;
    const conditions = [];
    if (companyId) conditions.push(eq(governmentRegistrationsTable.companyId, Number(companyId)));
    if (search) conditions.push(or(
      ilike(governmentRegistrationsTable.entityName, `%${search}%`),
      ilike(governmentRegistrationsTable.registrationNumber, `%${search}%`),
      ilike(governmentRegistrationsTable.responsibleEmployee, `%${search}%`),
    )!);
    let query = db.select().from(governmentRegistrationsTable).$dynamic();
    if (conditions.length) query = query.where(and(...conditions));
    const rows = await query.orderBy(governmentRegistrationsTable.entityName);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب التسجيلات" });
  }
});

/* ── GET ONE ── */
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select().from(governmentRegistrationsTable).where(eq(governmentRegistrationsTable.id, id));
    if (!row) return res.status(404).json({ error: "التسجيل غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب التسجيل" });
  }
});

/* ── CREATE ── */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertGovernmentRegistrationSchema.parse(req.body);
    const [row] = await db.insert(governmentRegistrationsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء التسجيل" });
  }
});

/* ── UPDATE ── */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updateGovernmentRegistrationSchema.parse(req.body);
    const [row] = await db.update(governmentRegistrationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(governmentRegistrationsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "التسجيل غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث التسجيل" });
  }
});

/* ── DELETE ── */
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [deleted] = await db.delete(governmentRegistrationsTable).where(eq(governmentRegistrationsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "التسجيل غير موجود" });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف التسجيل" });
  }
});

export default router;
