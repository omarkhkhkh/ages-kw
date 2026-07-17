import { Router, type Request, type Response } from "express";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  correspondenceLettersTable,
  correspondenceAttachmentsTable,
  insertCorrespondenceLetterSchema,
  updateCorrespondenceLetterSchema,
  insertCorrespondenceAttachmentSchema,
} from "@workspace/db";
import { generateLetterNumber, cancelLetterNumber } from "../lib/correspondence-numbering";
import { logActivity } from "../middleware/activity-logger";

const router = Router();

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePositiveInt(val: string | undefined, fallback: number, max?: number): number {
  const n = parseInt(val ?? "", 10);
  if (isNaN(n) || n < 0) return fallback;
  return max !== undefined ? Math.min(n, max) : n;
}

function sessionUser(req: Request) {
  return {
    userId: req.session.userId!,
    username: req.session.username ?? "",
    fullName: req.session.fullName ?? "",
    ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || undefined,
  };
}

/* ── LIST / SEARCH ── */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      sourceType, search, direction, letterType, approvalStatus,
      responsibleEmployee, dateFrom, dateTo,
    } = req.query as Record<string, string>;
    const sourceId = req.query.sourceId ? Number(req.query.sourceId) : null;
    const governmentEntityId = req.query.governmentEntityId ? Number(req.query.governmentEntityId) : null;
    const limit = parsePositiveInt(req.query.limit as string, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parsePositiveInt(req.query.offset as string, 0);

    const conditions: SQL[] = [];

    if (sourceType && sourceId) {
      const col = {
        tender: correspondenceLettersTable.tenderId,
        practice: correspondenceLettersTable.practiceId,
        contract: correspondenceLettersTable.contractId,
        purchase_order: correspondenceLettersTable.purchaseOrderId,
        supplier: correspondenceLettersTable.supplierId,
        project: correspondenceLettersTable.projectId,
        government_entity: correspondenceLettersTable.governmentEntityId,
      }[sourceType];
      if (col) conditions.push(eq(col, sourceId));
    }
    if (governmentEntityId) conditions.push(eq(correspondenceLettersTable.governmentEntityId, governmentEntityId));
    if (direction) conditions.push(eq(correspondenceLettersTable.direction, direction));
    if (letterType) conditions.push(eq(correspondenceLettersTable.letterType, letterType));
    if (approvalStatus) conditions.push(eq(correspondenceLettersTable.approvalStatus, approvalStatus));
    if (responsibleEmployee) conditions.push(ilike(correspondenceLettersTable.responsibleEmployee, `%${responsibleEmployee}%`));
    if (dateFrom) conditions.push(gte(correspondenceLettersTable.letterDate, dateFrom));
    if (dateTo) conditions.push(lte(correspondenceLettersTable.letterDate, dateTo));
    if (search) {
      conditions.push(or(
        ilike(correspondenceLettersTable.subject, `%${search}%`),
        ilike(correspondenceLettersTable.letterNumber, `%${search}%`),
        ilike(correspondenceLettersTable.senderName, `%${search}%`),
        ilike(correspondenceLettersTable.recipientName, `%${search}%`),
        ilike(correspondenceLettersTable.referenceNumber, `%${search}%`),
        ilike(correspondenceLettersTable.bodyHtml, `%${search}%`),
      )!);
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db.select().from(correspondenceLettersTable).where(where)
        .orderBy(desc(correspondenceLettersTable.createdAt))
        .limit(limit).offset(offset),
      db.select({ id: correspondenceLettersTable.id }).from(correspondenceLettersTable).where(where),
    ]);

    return res.json({ rows, total: countRows.length });
  } catch {
    return res.status(500).json({ error: "فشل في جلب المراسلات" });
  }
});

/* ── DASHBOARD STATS ── */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [counts] = await db.select({
      outgoingCount:  sql<number>`count(*) filter (where direction = 'outgoing' and status != 'cancelled')::int`,
      incomingCount:  sql<number>`count(*) filter (where direction = 'incoming' and status != 'cancelled')::int`,
      unanswered:     sql<number>`count(*) filter (where direction = 'incoming' and is_answered = false and status != 'cancelled')::int`,
      pendingApproval: sql<number>`count(*) filter (where approval_status = 'pending' and status != 'cancelled')::int`,
    }).from(correspondenceLettersTable);

    const latest = await db.select().from(correspondenceLettersTable)
      .where(sql`${correspondenceLettersTable.status} != 'cancelled'`)
      .orderBy(desc(correspondenceLettersTable.createdAt)).limit(5);

    const deadlineAlerts = await db.select().from(correspondenceLettersTable)
      .where(and(
        sql`${correspondenceLettersTable.deadlineDate} IS NOT NULL`,
        sql`${correspondenceLettersTable.deadlineDate} <= current_date + interval '7 days'`,
        eq(correspondenceLettersTable.isAnswered, false),
        sql`${correspondenceLettersTable.status} NOT IN ('closed', 'cancelled')`,
      ))
      .orderBy(correspondenceLettersTable.deadlineDate)
      .limit(20);

    return res.json({ ...counts, latest, deadlineAlerts });
  } catch {
    return res.status(500).json({ error: "فشل في جلب إحصائيات المراسلات" });
  }
});

/* ── GET ONE (+ attachments) ── */
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [letter] = await db.select().from(correspondenceLettersTable).where(eq(correspondenceLettersTable.id, id));
    if (!letter) return res.status(404).json({ error: "الخطاب غير موجود" });
    const attachments = await db.select().from(correspondenceAttachmentsTable).where(eq(correspondenceAttachmentsTable.letterId, id));
    return res.json({ ...letter, attachments });
  } catch {
    return res.status(500).json({ error: "فشل في جلب الخطاب" });
  }
});

/* ── CREATE ── */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertCorrespondenceLetterSchema.parse(req.body);
    const { userId, username, fullName, ipAddress } = sessionUser(req);

    const letter = await db.transaction(async (tx) => {
      const letterNumber = await generateLetterNumber(tx, {
        governmentEntityId: data.governmentEntityId ?? null,
        sourceType: data.sourceType as any,
      });
      const [row] = await tx.insert(correspondenceLettersTable).values({
        ...data,
        letterNumber,
        createdByUserId: userId,
      }).returning();
      return row;
    });

    logActivity({ userId, username, fullName, action: "create", module: "correspondence", resourceId: letter.id, ipAddress }).catch(() => {});
    return res.status(201).json(letter);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(409).json({ error: "تعارض في رقم الخطاب — حاول مرة أخرى" });
    return res.status(500).json({ error: "فشل في إنشاء الخطاب" });
  }
});

/* ── UPDATE ── */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updateCorrespondenceLetterSchema.parse(req.body);
    const [row] = await db.update(correspondenceLettersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(correspondenceLettersTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "الخطاب غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الخطاب" });
  }
});

/* ── DELETE ── */
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [deleted] = await db.delete(correspondenceLettersTable).where(eq(correspondenceLettersTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "الخطاب غير موجود" });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الخطاب" });
  }
});

/* ── APPROVE ── */
router.patch("/:id/approve", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  const { approved } = req.body as { approved: boolean };
  if (typeof approved !== "boolean") return res.status(400).json({ error: "قيمة approved يجب أن تكون boolean" });
  try {
    const { userId, username, fullName, ipAddress } = sessionUser(req);
    const [row] = await db.update(correspondenceLettersTable).set({
      approvalStatus: approved ? "approved" : "rejected",
      approvedByUserId: userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(correspondenceLettersTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "الخطاب غير موجود" });
    logActivity({ userId, username, fullName, action: "letter_approve", module: "correspondence", resourceId: id, details: approved ? "تم الاعتماد" : "تم الرفض", ipAddress }).catch(() => {});
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في اعتماد الخطاب" });
  }
});

/* ── SEND ── */
router.patch("/:id/send", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { userId, username, fullName, ipAddress } = sessionUser(req);
    const [row] = await db.update(correspondenceLettersTable).set({
      status: "sent",
      sentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(correspondenceLettersTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "الخطاب غير موجود" });
    logActivity({ userId, username, fullName, action: "letter_send", module: "correspondence", resourceId: id, ipAddress }).catch(() => {});
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في إرسال الخطاب" });
  }
});

/* ── CANCEL (void) ── */
router.patch("/:id/cancel", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { userId, username, fullName, ipAddress } = sessionUser(req);
    const [letter] = await db.select().from(correspondenceLettersTable).where(eq(correspondenceLettersTable.id, id));
    if (!letter) return res.status(404).json({ error: "الخطاب غير موجود" });
    if (letter.status === "cancelled") return res.status(400).json({ error: "الخطاب ملغى بالفعل" });

    const { row, reclaimed } = await db.transaction(async (tx) => {
      const { reclaimed } = await cancelLetterNumber(tx, letter.letterNumber);
      const [row] = await tx.update(correspondenceLettersTable).set({
        status: "cancelled",
        letterNumber: reclaimed ? `${letter.letterNumber}-VOID` : letter.letterNumber,
        cancelledAt: new Date(),
        cancelledByUserId: userId,
        updatedAt: new Date(),
      }).where(eq(correspondenceLettersTable.id, id)).returning();
      return { row, reclaimed };
    });

    logActivity({
      userId, username, fullName, action: "letter_cancel", module: "correspondence", resourceId: id,
      details: reclaimed ? "تم إلغاء الخطاب واسترجاع رقمه" : "تم إلغاء الخطاب (رقمه محجوز بسبب خطابات لاحقة)",
      ipAddress,
    }).catch(() => {});
    return res.json({ ...row, numberReclaimed: reclaimed });
  } catch {
    return res.status(500).json({ error: "فشل في إلغاء الخطاب" });
  }
});

/* ── MARK ANSWERED ── */
router.patch("/:id/mark-answered", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  const { isAnswered } = req.body as { isAnswered: boolean };
  if (typeof isAnswered !== "boolean") return res.status(400).json({ error: "قيمة isAnswered يجب أن تكون boolean" });
  try {
    const [row] = await db.update(correspondenceLettersTable)
      .set({ isAnswered, updatedAt: new Date() })
      .where(eq(correspondenceLettersTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "الخطاب غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث حالة الرد" });
  }
});

/* ── ATTACHMENTS ── */
router.get("/:id/attachments", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const rows = await db.select().from(correspondenceAttachmentsTable).where(eq(correspondenceAttachmentsTable.letterId, id));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المرفقات" });
  }
});

router.post("/:id/attachments", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = insertCorrespondenceAttachmentSchema.parse({ ...req.body, letterId: id });
    const { userId, username, fullName, ipAddress } = sessionUser(req);
    const [row] = await db.insert(correspondenceAttachmentsTable).values({
      ...data,
      uploadedByUserId: userId,
    }).returning();
    logActivity({ userId, username, fullName, action: "letter_upload_attachment", module: "correspondence", resourceId: id, details: data.fileName, ipAddress }).catch(() => {});
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في رفع المرفق" });
  }
});

router.delete("/:id/attachments/:attachmentId", async (req: Request, res: Response) => {
  const attachmentId = parseId(req.params.attachmentId);
  if (!attachmentId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [deleted] = await db.delete(correspondenceAttachmentsTable).where(eq(correspondenceAttachmentsTable.id, attachmentId)).returning();
    if (!deleted) return res.status(404).json({ error: "المرفق غير موجود" });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المرفق" });
  }
});

router.get("/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  const attachmentId = parseId(req.params.attachmentId);
  if (!attachmentId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [attachment] = await db.select().from(correspondenceAttachmentsTable).where(eq(correspondenceAttachmentsTable.id, attachmentId));
    if (!attachment) return res.status(404).json({ error: "المرفق غير موجود" });
    const { userId, username, fullName, ipAddress } = sessionUser(req);
    logActivity({ userId, username, fullName, action: "letter_download", module: "correspondence", resourceId: attachment.letterId, details: attachment.fileName, ipAddress }).catch(() => {});
    return res.redirect(`/api/storage${attachment.fileUrl}`);
  } catch {
    return res.status(500).json({ error: "فشل في تحميل المرفق" });
  }
});

export default router;
