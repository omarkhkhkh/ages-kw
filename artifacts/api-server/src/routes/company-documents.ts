import { Router, type Request, type Response } from "express";
import { desc, ilike, or, and, sql, eq } from "drizzle-orm";
import { ownRecordsOnly } from "../middleware/auth";
import {
  db, pool,
  companiesTable, insertCompanySchema, updateCompanySchema,
  companyDocumentsTable, insertCompanyDocumentSchema, updateCompanyDocumentSchema,
  usersTable,
} from "@workspace/db";

const router = Router();

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ══════════════════════════════════════
   COMPANIES (الشركات)
══════════════════════════════════════ */
router.get("/companies", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.notes, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
             COUNT(d.id)::int AS "documentCount"
      FROM companies c
      LEFT JOIN company_documents d ON d.company_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الشركات" });
  }
});

router.post("/companies", async (req: Request, res: Response) => {
  try {
    const data = insertCompanySchema.parse(req.body);
    const [row] = await db.insert(companiesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(400).json({ error: "اسم الشركة مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في إنشاء الشركة" });
  }
});

router.patch("/companies/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updateCompanySchema.parse(req.body);
    const [row] = await db.update(companiesTable).set({ ...data, updatedAt: new Date() }).where(eq(companiesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "الشركة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(400).json({ error: "اسم الشركة مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في تحديث الشركة" });
  }
});

router.delete("/companies/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [deleted] = await db.delete(companiesTable).where(eq(companiesTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "الشركة غير موجودة" });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الشركة" });
  }
});

/* ── STATS ── */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const where = companyId ? sql`where company_id = ${companyId}` : sql``;
    const [row] = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) filter (where expiry_date > current_date + interval '90 days' or expiry_date is null)::int AS active,
        count(*) filter (where expiry_date <= current_date + interval '90 days' and expiry_date > current_date + interval '30 days')::int AS expiring90,
        count(*) filter (where expiry_date <= current_date + interval '30 days' and expiry_date >= current_date)::int AS expiring30,
        count(*) filter (where expiry_date < current_date)::int AS expired
      FROM company_documents
      ${where}
    `).then((r: any) => r.rows);
    const today = new Date().toISOString().slice(0, 10);
    return res.json({ ...row, today });
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات الوثائق" });
  }
});

/* ── LIST ── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, companyId } = req.query as Record<string, string>;
    const conditions = [];
    if (companyId) conditions.push(eq(companyDocumentsTable.companyId, Number(companyId)));
    if (search) conditions.push(or(
      ilike(companyDocumentsTable.name, `%${search}%`),
      ilike(companyDocumentsTable.documentNumber, `%${search}%`),
      ilike(companyDocumentsTable.issuingBody, `%${search}%`),
      ilike(companyDocumentsTable.responsibleEmployee, `%${search}%`),
    )!);
    // خصوصية السجلات: الموظف بنطاق 'own' يرى ما هو مُسنَد إليه فقط (وغير المُسنَد للمدير فقط)
    if (ownRecordsOnly(req)) conditions.push(eq(companyDocumentsTable.assignedUserId, req.session.userId!));
    let query = db.select({
      id: companyDocumentsTable.id,
      companyId: companyDocumentsTable.companyId,
      name: companyDocumentsTable.name,
      assignedUserId: companyDocumentsTable.assignedUserId,
      assignedName: usersTable.fullName,
      documentNumber: companyDocumentsTable.documentNumber,
      issuingBody: companyDocumentsTable.issuingBody,
      issueDate: companyDocumentsTable.issueDate,
      expiryDate: companyDocumentsTable.expiryDate,
      fileUrl: companyDocumentsTable.fileUrl,
      notes: companyDocumentsTable.notes,
      responsibleEmployee: companyDocumentsTable.responsibleEmployee,
      createdAt: companyDocumentsTable.createdAt,
      updatedAt: companyDocumentsTable.updatedAt,
    }).from(companyDocumentsTable)
      .leftJoin(usersTable, eq(companyDocumentsTable.assignedUserId, usersTable.id))
      .$dynamic();
    if (conditions.length) query = query.where(and(...conditions));
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
    // المُنشئ يصبح المسؤول افتراضيًا؛ المدير وحده يعيد التعيين لاحقًا
    const [row] = await db.insert(companyDocumentsTable).values({ ...data, assignedUserId: req.session.userId ?? null }).returning();
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
    const data = updateCompanyDocumentSchema.parse(req.body) as Record<string, any>;
    // إعادة تعيين الموظف المسؤول للمدير فقط
    if (req.session.role !== "admin") delete data.assignedUserId;
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
