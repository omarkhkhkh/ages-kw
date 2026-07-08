import { Router, type Request, type Response } from "express";
import { desc, ilike, eq, or, sql } from "drizzle-orm";
import { db, practicesTable, insertPracticeSchema, updatePracticeSchema } from "@workspace/db";

const router = Router();

/* ── LIST ── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (status && status !== "all") conditions.push(eq(practicesTable.status, status));
    if (search) conditions.push(or(
      ilike(practicesTable.projectName,    `%${search}%`),
      ilike(practicesTable.governmentEntity, `%${search}%`),
      ilike(practicesTable.practiceNumber, `%${search}%`),
      ilike(practicesTable.description,    `%${search}%`),
    ));

    let query = db.select().from(practicesTable).$dynamic();
    if (conditions.length === 1) query = query.where(conditions[0]);
    if (conditions.length >= 2)  query = query.where(sql`(${conditions[0]}) and (${conditions[1]})`);

    const rows = await query.orderBy(desc(practicesTable.createdAt));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الممارسات" });
  }
});

/* ── STATS ── */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totals] = await db.select({
      total:              sql<number>`count(*)::int`,
      current:            sql<number>`count(*) filter (where status='current')::int`,
      previous:           sql<number>`count(*) filter (where status='previous')::int`,
      targeted:           sql<number>`count(*) filter (where status='targeted')::int`,
      underSubmission:    sql<number>`count(*) filter (where status='under_submission')::int`,
      future:             sql<number>`count(*) filter (where status='future')::int`,
      totalContractValue:   sql<string>`coalesce(sum(contract_value) filter (where status in ('current','previous')), 0)::text`,
      currentContractValue: sql<string>`coalesce(sum(contract_value) filter (where status='current'), 0)::text`,
    }).from(practicesTable);
    return res.json(totals);
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات الممارسات" });
  }
});

/* ── helper: validate numeric ID ── */
function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ── GET ONE ── */
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select().from(practicesTable).where(eq(practicesTable.id, id));
    if (!row) return res.status(404).json({ error: "الممارسة غير موجودة" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الممارسة" });
  }
});

/* ── CREATE ── */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertPracticeSchema.parse(req.body);
    const [row] = await db.insert(practicesTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء الممارسة" });
  }
});

/* ── UPDATE ── */
// Fields a responsible employee (without canEdit) is allowed to patch on their own practice.
const OWNER_ALLOWED_FIELDS = new Set([
  "status", "fileConditions", "filePricing", "fileSuppliers", "fileOpening",
]);

router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });

  const session = req.session as any;
  const isAdmin = session.role === "admin";
  const hasCanEdit = !!session.canEdit;

  try {
    // Fetch current record to validate ownership before applying changes
    const [existing] = await db.select().from(practicesTable).where(eq(practicesTable.id, id));
    if (!existing) return res.status(404).json({ error: "الممارسة غير موجودة" });

    const isOwner = session.fullName && existing.responsibleEmployee === session.fullName;

    // Authorization: admin and canEdit users can update anything.
    // Responsible employee (owner) can only update status and file fields.
    if (!isAdmin && !hasCanEdit) {
      if (!isOwner) {
        return res.status(403).json({ error: "ليس لديك صلاحية تعديل هذه الممارسة." });
      }
      const requestedFields = Object.keys(req.body);
      const forbidden = requestedFields.filter(f => !OWNER_ALLOWED_FIELDS.has(f));
      if (forbidden.length > 0) {
        return res.status(403).json({ error: `الموظف المسؤول لا يملك صلاحية تعديل: ${forbidden.join(", ")}` });
      }
    }

    const data = updatePracticeSchema.parse(req.body);
    const [row] = await db.update(practicesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(practicesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "الممارسة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الممارسة" });
  }
});

/* ── DELETE ── */
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(practicesTable).where(eq(practicesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الممارسة" });
  }
});

export default router;
