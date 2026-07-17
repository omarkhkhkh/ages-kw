import { Router, type Request, type Response } from "express";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { db, tendersTable, departmentsTable, governmentContactsTable, pool } from "@workspace/db";
import { insertAutomationTask } from "./task-automation";

const router = Router();

function formatTender(t: typeof tendersTable.$inferSelect) {
  return {
    id: t.id,
    tenderNumber: t.tenderNumber,
    governmentEntity: t.governmentEntity,
    governmentEntityId: t.governmentEntityId,
    departmentId: t.departmentId,
    contactId: t.contactId,
    companyId: t.companyId,
    projectName: t.projectName,
    tenderType: t.tenderType,
    announcementDate: t.announcementDate,
    deadline: t.deadline,
    preliminaryMeetingHeld: t.preliminaryMeetingHeld,
    preliminaryMeetingDate: t.preliminaryMeetingDate,
    bondValue: t.bondValue !== null ? Number(t.bondValue) : null,
    docsValue: t.docsValue !== null ? Number(t.docsValue) : null,
    responsibleEngineer: t.responsibleEngineer,
    status: t.status,
    offerValue: t.offerValue !== null ? Number(t.offerValue) : null,
    profitPercentage:
      t.profitPercentage !== null ? Number(t.profitPercentage) : null,
    isSubmitted: t.isSubmitted,
    winner: t.winner,
    notes: t.notes,
    fileConditions: t.fileConditions,
    filePricing: t.filePricing,
    fileSuppliers: t.fileSuppliers,
    fileOpening: t.fileOpening,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const VALID_STATUSES = [
  "new",
  "studying",
  "requesting_quotes",
  "preparing_technical",
  "preparing_financial",
  "management_review",
  "ready_to_submit",
  "submitted",
  "under_evaluation",
  "won",
  "lost",
  "cancelled",
];

// GET /api/tenders
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { status, entity, urgent, won, engineer, search } = req.query;
  const userId  = req.session.userId!;
  const isAdmin = req.session.role === "admin";

  const conditions: ReturnType<typeof eq>[] = [];

  // Employees: hide tenders where the admin has set can_view = false
  if (!isAdmin) {
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM tender_permissions tp
        WHERE tp.tender_id = ${tendersTable.id}
          AND tp.user_id   = ${userId}
          AND tp.can_view  = false
      )` as ReturnType<typeof eq>
    );
  }

  if (status && typeof status === "string") {
    conditions.push(eq(tendersTable.status, status));
  }
  if (entity && typeof entity === "string") {
    conditions.push(ilike(tendersTable.governmentEntity, `%${entity}%`) as ReturnType<typeof eq>);
  }
  if (won === "true") {
    conditions.push(eq(tendersTable.status, "won"));
  }
  if (engineer && typeof engineer === "string") {
    conditions.push(ilike(tendersTable.responsibleEngineer, `%${engineer}%`) as ReturnType<typeof eq>);
  }
  if (urgent === "true") {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const today = new Date().toISOString().split("T")[0];
    const urgentDate = sevenDaysFromNow.toISOString().split("T")[0];
    const activeStatuses = ["new", "studying", "requesting_quotes", "preparing_technical", "preparing_financial", "management_review", "ready_to_submit", "under_evaluation"];
    conditions.push(
      and(
        sql`${tendersTable.deadline} IS NOT NULL`,
        sql`${tendersTable.deadline} >= ${today}`,
        sql`${tendersTable.deadline} <= ${urgentDate}`,
        sql`${tendersTable.status} = ANY(${activeStatuses})`
      ) as ReturnType<typeof eq>
    );
  }
  if (search && typeof search === "string") {
    conditions.push(
      or(
        ilike(tendersTable.tenderNumber, `%${search}%`),
        ilike(tendersTable.projectName,  `%${search}%`),
        ilike(tendersTable.governmentEntity, `%${search}%`)
      ) as ReturnType<typeof eq>
    );
  }

  const rows = await db
    .select()
    .from(tendersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${tendersTable.createdAt} DESC`);

  res.json(rows.map(formatTender));
});

// GET /api/tenders/stats
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  const all = await db.select().from(tendersTable);

  const byStatus: Record<string, number> = {};
  let totalOfferValue = 0;
  let wonCount = 0;

  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  const todayStr = today.toISOString().split("T")[0];
  const urgentStr = sevenDaysFromNow.toISOString().split("T")[0];
  const activeStatuses = new Set(["new", "studying", "requesting_quotes", "preparing_technical", "preparing_financial", "management_review", "ready_to_submit", "under_evaluation"]);

  let urgentCount = 0;

  for (const t of all) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    if (t.offerValue) totalOfferValue += Number(t.offerValue);
    if (t.status === "won") wonCount++;
    if (
      t.deadline &&
      t.deadline >= todayStr &&
      t.deadline <= urgentStr &&
      activeStatuses.has(t.status)
    ) {
      urgentCount++;
    }
  }

  const completedStatuses = ["won", "lost", "cancelled"];
  const completedCount = all.filter((t) =>
    completedStatuses.includes(t.status)
  ).length;
  const winRate =
    completedCount > 0 ? Math.round((wonCount / completedCount) * 100) : 0;

  res.json({
    total: all.length,
    byStatus: Object.entries(byStatus).map(([status, count]) => ({
      status,
      count,
    })),
    urgentCount,
    wonCount,
    totalOfferValue,
    winRate,
  });
});

// GET /api/tenders/:id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  // Employees: check if this tender is explicitly blocked
  if (req.session.role !== "admin") {
    const { rows: blocked } = await pool.query(
      `SELECT 1 FROM tender_permissions WHERE tender_id=$1 AND user_id=$2 AND can_view=false`,
      [id, req.session.userId]
    );
    if (blocked.length > 0) {
      res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذه المناقصة" });
      return;
    }
  }

  const rows = await db
    .select()
    .from(tendersTable)
    .where(eq(tendersTable.id, id));

  if (rows.length === 0) {
    res.status(404).json({ error: "Tender not found" });
    return;
  }

  const tender = rows[0];
  let departmentName: string | null = null;
  let contactName: string | null = null;
  if (tender.departmentId) {
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, tender.departmentId));
    departmentName = dept?.name ?? null;
  }
  if (tender.contactId) {
    const [contact] = await db.select().from(governmentContactsTable).where(eq(governmentContactsTable.id, tender.contactId));
    contactName = contact?.name ?? null;
  }

  res.json({ ...formatTender(tender), departmentName, contactName });
});

// POST /api/tenders
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  if (!body.tenderNumber || !body.projectName || !body.status) {
    res.status(400).json({ error: "tenderNumber, projectName, and status are required" });
    return;
  }

  const status = String(body.status);
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status: ${status}` });
    return;
  }

  const rows = await db
    .insert(tendersTable)
    .values({
      tenderNumber: String(body.tenderNumber),
      governmentEntity: body.governmentEntity ? String(body.governmentEntity) : null,
      governmentEntityId: body.governmentEntityId ? Number(body.governmentEntityId) : null,
      departmentId: body.departmentId ? Number(body.departmentId) : null,
      contactId: body.contactId ? Number(body.contactId) : null,
      companyId: body.companyId ? Number(body.companyId) : null,
      projectName: String(body.projectName),
      tenderType: body.tenderType ? String(body.tenderType) : null,
      announcementDate: body.announcementDate ? String(body.announcementDate) : null,
      deadline: body.deadline ? String(body.deadline) : null,
      preliminaryMeetingHeld: Boolean(body.preliminaryMeetingHeld ?? false),
      preliminaryMeetingDate: body.preliminaryMeetingDate ? String(body.preliminaryMeetingDate) : null,
      bondValue: body.bondValue != null ? String(body.bondValue) : null,
      docsValue: body.docsValue != null ? String(body.docsValue) : null,
      responsibleEngineer: body.responsibleEngineer ? String(body.responsibleEngineer) : null,
      status,
      offerValue: body.offerValue != null ? String(body.offerValue) : null,
      profitPercentage: body.profitPercentage != null ? String(body.profitPercentage) : null,
      isSubmitted: Boolean(body.isSubmitted ?? false),
      winner: body.winner ? String(body.winner) : null,
      notes: body.notes ? String(body.notes) : null,
    })
    .returning();

  insertAutomationTask({
    title: `متابعة مناقصة جديدة: ${rows[0].projectName}`,
    sourceType: "tender_created", sourceId: rows[0].id, triggerKey: "created",
    linkedEntityType: "tender", linkedEntityId: rows[0].id, dueDate: rows[0].deadline,
  }).catch(() => {});

  res.status(201).json(formatTender(rows[0]));
});

// PATCH /api/tenders/:id
router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  // Employees must not mutate blocked records
  if (req.session.role !== "admin") {
    const { rows: blocked } = await pool.query(
      `SELECT 1 FROM tender_permissions WHERE tender_id=$1 AND user_id=$2 AND can_view=false`,
      [id, req.session.userId]
    );
    if (blocked.length > 0) {
      res.status(403).json({ error: "لا تملك صلاحية تعديل هذه المناقصة" });
      return;
    }
  }

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.tenderNumber !== undefined) updates.tenderNumber = String(body.tenderNumber);
  if (body.governmentEntity !== undefined) updates.governmentEntity = body.governmentEntity ? String(body.governmentEntity) : null;
  if (body.governmentEntityId !== undefined) updates.governmentEntityId = body.governmentEntityId ? Number(body.governmentEntityId) : null;
  if (body.departmentId !== undefined) updates.departmentId = body.departmentId ? Number(body.departmentId) : null;
  if (body.contactId !== undefined) updates.contactId = body.contactId ? Number(body.contactId) : null;
  if (body.companyId !== undefined) updates.companyId = body.companyId ? Number(body.companyId) : null;
  if (body.projectName !== undefined) updates.projectName = String(body.projectName);
  if (body.tenderType !== undefined) updates.tenderType = body.tenderType ? String(body.tenderType) : null;
  if (body.announcementDate !== undefined) updates.announcementDate = body.announcementDate ? String(body.announcementDate) : null;
  if (body.deadline !== undefined) updates.deadline = body.deadline ? String(body.deadline) : null;
  if (body.preliminaryMeetingHeld !== undefined) updates.preliminaryMeetingHeld = Boolean(body.preliminaryMeetingHeld);
  if (body.preliminaryMeetingDate !== undefined) updates.preliminaryMeetingDate = body.preliminaryMeetingDate ? String(body.preliminaryMeetingDate) : null;
  if (body.bondValue !== undefined) updates.bondValue = body.bondValue != null ? String(body.bondValue) : null;
  if (body.docsValue !== undefined) updates.docsValue = body.docsValue != null ? String(body.docsValue) : null;
  if (body.responsibleEngineer !== undefined) updates.responsibleEngineer = body.responsibleEngineer ? String(body.responsibleEngineer) : null;
  if (body.status !== undefined) {
    const newStatus = String(body.status);
    if (!VALID_STATUSES.includes(newStatus)) {
      res.status(400).json({ error: `Invalid status: ${newStatus}` });
      return;
    }
    updates.status = newStatus;
  }
  if (body.offerValue !== undefined) updates.offerValue = body.offerValue != null ? String(body.offerValue) : null;
  if (body.profitPercentage !== undefined) updates.profitPercentage = body.profitPercentage != null ? String(body.profitPercentage) : null;
  if (body.isSubmitted !== undefined) updates.isSubmitted = Boolean(body.isSubmitted);
  if (body.winner !== undefined) updates.winner = body.winner ? String(body.winner) : null;
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
  if (body.fileConditions !== undefined) updates.fileConditions = body.fileConditions ? String(body.fileConditions) : null;
  if (body.filePricing    !== undefined) updates.filePricing    = body.filePricing    ? String(body.filePricing)    : null;
  if (body.fileSuppliers  !== undefined) updates.fileSuppliers  = body.fileSuppliers  ? String(body.fileSuppliers)  : null;
  if (body.fileOpening    !== undefined) updates.fileOpening    = body.fileOpening    ? String(body.fileOpening)    : null;

  const rows = await db
    .update(tendersTable)
    .set(updates as Parameters<typeof db.update>[0] extends { set: (v: infer V) => unknown } ? V : never)
    .where(eq(tendersTable.id, id))
    .returning();

  if (rows.length === 0) {
    res.status(404).json({ error: "Tender not found" });
    return;
  }

  res.json(formatTender(rows[0]));
});

// DELETE /api/tenders/:id
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  // Employees must not delete blocked records
  if (req.session.role !== "admin") {
    const { rows: blocked } = await pool.query(
      `SELECT 1 FROM tender_permissions WHERE tender_id=$1 AND user_id=$2 AND can_view=false`,
      [id, req.session.userId]
    );
    if (blocked.length > 0) {
      res.status(403).json({ error: "لا تملك صلاحية حذف هذه المناقصة" });
      return;
    }
  }

  const rows = await db
    .delete(tendersTable)
    .where(eq(tendersTable.id, id))
    .returning();

  if (rows.length === 0) {
    res.status(404).json({ error: "Tender not found" });
    return;
  }

  res.status(204).send();
});

export default router;
