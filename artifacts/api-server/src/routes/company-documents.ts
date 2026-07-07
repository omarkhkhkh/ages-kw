import { Router, type Request, type Response } from "express";
import { desc, ilike, or, sql, eq } from "drizzle-orm";
import { db, companyDocumentsTable, insertCompanyDocumentSchema, updateCompanyDocumentSchema } from "@workspace/db";

const router = Router();

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ── STATS ── */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db.select({
      total:      sql<number>`count(*)::int`,
      active:     sql<number>`count(*) filter (where expiry_date > current_date + interval '90 days' or expiry_date is null)::int`,
      expiring90: sql<number>`count(*) filter (where expiry_date <= current_date + interval '90 days' and expiry_date > current_date + interval '30 days')::int`,
      expiring30: sql<number>`count(*) filter (where expiry_date <= current_date + interval '30 days' and expiry_date >= current_date)::int`,
      expired:    sql<number>`count(*) filter (where expiry_date < current_date)::int`,
    }).from(companyDocumentsTable);
    return res.json({ ...row, today });
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات الوثائق" });
  }
});

/* ── LIST ── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search } = req.query as Record<string, string>;
    let query = db.select().from(companyDocumentsTable).$dynamic();
    if (search) query = query.where(or(
      ilike(companyDocumentsTable.name, `%${search}%`),
      ilike(companyDocumentsTable.documentNumber, `%${search}%`),
      ilike(companyDocumentsTable.issuingBody, `%${search}%`),
      ilike(companyDocumentsTable.responsibleEmployee, `%${search}%`),
    ));
    const rows = await query.orderBy(companyDocumentsTable.name);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الوثائق" });
  }
});

/* ── GET ONE ── */
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select().from(companyDocumentsTable).where(eq(companyDocumentsTable.id, id));
    if (!row) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الوثيقة" });
  }
});

/* ── CREATE ── */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertCompanyDocumentSchema.parse(req.body);
    const [row] = await db.insert(companyDocumentsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الوثيقة" });
  }
});

/* ── UPDATE ── */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updateCompanyDocumentSchema.parse(req.body);
    const [row] = await db.update(companyDocumentsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companyDocumentsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الوثيقة" });
  }
});

/* ── DELETE ── */
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [deleted] = await db.delete(companyDocumentsTable).where(eq(companyDocumentsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الوثيقة" });
  }
});

export default router;
