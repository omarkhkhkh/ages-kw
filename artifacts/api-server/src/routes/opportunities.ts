import { Router, type Request, type Response } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db, pool,
  procurementOpportunitiesTable, opportunityItemsTable, opportunityItemQuotesTable,
  opportunityFilesTable, opportunityStageHistoryTable,
  insertOpportunitySchema, updateOpportunitySchema,
  insertOpportunityItemSchema, updateOpportunityItemSchema,
  insertOpportunityQuoteSchema, updateOpportunityQuoteSchema,
  correspondenceLettersTable,
} from "@workspace/db";
import { createNotification } from "./notifications";
import { hasModuleAction } from "../middleware/auth";
import { generateLetterNumber } from "../lib/correspondence-numbering";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorage = new ObjectStorageService();

/* دورة الحياة والانتقالات المسموحة */
const STATUSES = [
  "new", "researching", "pending_pricing", "priced",
  "quotation_sent", "under_review", "won", "lost", "cancelled", "retendered",
];
const TRANSITIONS: Record<string, string[]> = {
  new:            ["researching", "cancelled"],
  researching:    ["pending_pricing", "cancelled"],
  pending_pricing: ["priced", "researching", "cancelled"],
  priced:         ["quotation_sent", "pending_pricing", "cancelled"],
  quotation_sent: ["under_review", "won", "lost", "cancelled", "retendered"],
  under_review:   ["won", "lost", "cancelled", "retendered"],
  retendered:     ["researching", "cancelled"],
  won: [], lost: [], cancelled: [],
};

/* الصلاحيات الدقيقة داخل الدورة (المدير يتجاوز دائمًا) */
function canPrice(req: Request) { return req.session.role === "admin" || !!(req.session as any).opportunityCanPrice; }
function canApprove(req: Request) { return req.session.role === "admin" || !!(req.session as any).opportunityCanApprove; }

/* استثناء الملكية: مستلم الفرصة يعمل عليها (بنود/عروض/ملفات/انتقالات) حتى لو
   كانت صلاحيته على الوحدة "عرض" فقط — نفس نمط الفني المكلّف في الصيانة
   والموظف المسؤول في الممارسات. أصحاب صلاحية إضافة/تعديل بالمصفوفة يعملون
   على أي فرصة. */
function hasMatrixWrite(req: Request): boolean {
  return hasModuleAction(req, "accessOpportunities", "add") || hasModuleAction(req, "accessOpportunities", "edit");
}
const OWNER_ONLY_MSG = "هذه الفرصة يعمل عليها مستلمها فقط — استلم المهمة أولًا أو اطلب صلاحية الإضافة في القسم";

async function canWorkOn(req: Request, opportunityId: number): Promise<boolean> {
  if (hasMatrixWrite(req)) return true;
  const [o] = await db.select({ claimedByUserId: procurementOpportunitiesTable.claimedByUserId })
    .from(procurementOpportunitiesTable)
    .where(eq(procurementOpportunitiesTable.id, opportunityId));
  return !!o?.claimedByUserId && o.claimedByUserId === req.session.userId;
}

async function oppIdOfItem(itemId: number): Promise<number | null> {
  const [i] = await db.select({ opportunityId: opportunityItemsTable.opportunityId })
    .from(opportunityItemsTable).where(eq(opportunityItemsTable.id, itemId));
  return i?.opportunityId ?? null;
}
async function oppIdOfQuote(quoteId: number): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT i.opportunity_id AS oid FROM opportunity_item_quotes q JOIN opportunity_items i ON i.id = q.item_id WHERE q.id = $1`,
    [quoteId]
  );
  return rows[0]?.oid ?? null;
}
async function oppIdOfFile(fileId: number): Promise<number | null> {
  const [f] = await db.select({ opportunityId: opportunityFilesTable.opportunityId })
    .from(opportunityFilesTable).where(eq(opportunityFilesTable.id, fileId));
  return f?.opportunityId ?? null;
}

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function logStage(opportunityId: number, stage: string, userId: number | null, note?: string) {
  await db.insert(opportunityStageHistoryTable).values({ opportunityId, stage, changedByUserId: userId, note: note ?? null });
}

/** إشعار جماعي لكل مستخدمي وحدة الفرص النشطين (عدا المُرسل) */
async function notifyOpportunityUsers(exceptUserId: number | null, type: string, message: string, link: string) {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE is_active = true AND (role = 'admin' OR access_opportunities = true)`
    );
    await Promise.all(
      rows.filter((u: any) => u.id !== exceptUserId)
        .map((u: any) => createNotification({ recipientUserId: u.id, type, message, link }))
    );
  } catch (err) { console.error("notifyOpportunityUsers failed", err); }
}

/* ══════════════════════════════════════
   STATS — لوحة القسم
══════════════════════════════════════ */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new')::int AS "newCount",
        COUNT(*) FILTER (WHERE status = 'researching')::int AS "researchingCount",
        COUNT(*) FILTER (WHERE status = 'pending_pricing')::int AS "pendingPricingCount",
        COUNT(*) FILTER (WHERE status IN ('quotation_sent','under_review'))::int AS "sentCount",
        COUNT(*) FILTER (WHERE status = 'won')::int AS "wonCount",
        COUNT(*) FILTER (WHERE status = 'lost')::int AS "lostCount",
        COUNT(*)::int AS total,
        COALESCE(SUM(our_price) FILTER (WHERE status IN ('quotation_sent','under_review')), 0)::numeric AS "expectedValue",
        COALESCE(SUM(our_price) FILTER (WHERE status = 'won'), 0)::numeric AS "wonValue",
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (quotation_sent_at - discovered_at)) / 3600)
          FILTER (WHERE quotation_sent_at IS NOT NULL)::numeric, 1), 0) AS "avgPrepHours"
      FROM procurement_opportunities
    `);
    const [byEntity, byResearcher, lossReasons] = await Promise.all([
      pool.query(`
        SELECT ge.name AS label, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE o.status = 'won')::int AS won
        FROM procurement_opportunities o
        JOIN government_entities ge ON ge.id = o.government_entity_id
        GROUP BY ge.name ORDER BY total DESC LIMIT 10
      `),
      pool.query(`
        SELECT u.full_name AS label, COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE o.status = 'won')::int AS won
        FROM procurement_opportunities o
        JOIN users u ON u.id = o.claimed_by_user_id
        GROUP BY u.full_name ORDER BY total DESC LIMIT 10
      `),
      pool.query(`
        SELECT loss_reason AS label, COUNT(*)::int AS total
        FROM procurement_opportunities WHERE status = 'lost' AND loss_reason IS NOT NULL
        GROUP BY loss_reason ORDER BY total DESC
      `),
    ]);
    const decided = rows[0].wonCount + rows[0].lostCount;
    return res.json({
      ...rows[0],
      winRate: decided > 0 ? Math.round((rows[0].wonCount / decided) * 1000) / 10 : 0,
      byEntity: byEntity.rows, byResearcher: byResearcher.rows, lossReasons: lossReasons.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الإحصائيات" });
  }
});

/* ══════════════════════════════════════
   LIST + CREATE
══════════════════════════════════════ */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, search, claimedBy, urgent } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (status && status !== "all") { params.push(status); conditions.push(`o.status = $${params.length}`); }
    if (claimedBy) { params.push(Number(claimedBy)); conditions.push(`o.claimed_by_user_id = $${params.length}`); }
    if (urgent === "1") conditions.push(`o.is_urgent = true`);
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(o.order_number ILIKE $${params.length} OR o.title ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT o.id, o.order_number AS "orderNumber", o.title, o.status, o.is_urgent AS "isUrgent",
              o.issue_date AS "issueDate", o.submission_deadline AS "submissionDeadline",
              o.opening_date AS "openingDate", o.bond_value AS "bondValue",
              o.claimed_by_user_id AS "claimedByUserId", o.claimed_at AS "claimedAt",
              o.our_price AS "ourPrice", o.discovered_at AS "discoveredAt",
              ge.name AS "entityName", cu.full_name AS "claimedByName",
              (SELECT COUNT(*)::int FROM opportunity_items oi WHERE oi.opportunity_id = o.id) AS "itemCount"
       FROM procurement_opportunities o
       LEFT JOIN government_entities ge ON ge.id = o.government_entity_id
       LEFT JOIN users cu ON cu.id = o.claimed_by_user_id
       ${where}
       ORDER BY o.is_urgent DESC, o.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الفرص" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertOpportunitySchema.parse(req.body) as Record<string, any>;
    for (const f of ["issueDate", "submissionDeadline", "openingDate", "bondValue"]) if (data[f] === "") data[f] = null;
    const [row] = await db.insert(procurementOpportunitiesTable)
      .values({ ...data, createdByUserId: req.session.userId ?? null } as any)
      .returning();
    await logStage(row.id, "new", req.session.userId ?? null, "اكتشاف الفرصة");
    // إعلان الفرصة الجديدة لكل القسم — بديل رسالة الواتساب
    notifyOpportunityUsers(
      req.session.userId ?? null, "opportunity_new",
      `فرصة شراء جديدة: ${row.orderNumber} — ${row.title}`, `/opportunities/${row.id}`
    );
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في إضافة الفرصة" });
  }
});

/* ══════════════════════════════════════
   CLAIM — الاستلام الحصري (تحديث شرطي ذري)
══════════════════════════════════════ */
router.post("/:id/claim", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `UPDATE procurement_opportunities
       SET claimed_by_user_id = $1, claimed_at = now(), status = 'researching', updated_at = now()
       WHERE id = $2 AND claimed_by_user_id IS NULL AND status = 'new'
       RETURNING id, order_number AS "orderNumber"`,
      [req.session.userId, id]
    );
    if (!rows.length) return res.status(409).json({ error: "سبق استلام هذه المهمة من موظف آخر" });
    await logStage(id, "researching", req.session.userId ?? null, "استلام المهمة وبدء الدراسة");
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في استلام المهمة" });
  }
});

/* ══════════════════════════════════════
   GET ONE (بالبنود والعروض والملفات والسجل)
══════════════════════════════════════ */
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT o.*, o.order_number AS "orderNumber", o.is_urgent AS "isUrgent",
              o.government_entity_id AS "governmentEntityId", o.department_id AS "departmentId", o.contact_id AS "contactId",
              o.entity_type AS "entityType", o.issue_date AS "issueDate",
              o.submission_deadline AS "submissionDeadline", o.opening_date AS "openingDate",
              o.bond_value AS "bondValue", o.claimed_by_user_id AS "claimedByUserId", o.claimed_at AS "claimedAt",
              o.discovered_at AS "discoveredAt", o.research_done_at AS "researchDoneAt",
              o.priced_at AS "pricedAt", o.quotation_sent_at AS "quotationSentAt", o.result_at AS "resultAt",
              o.pricing_sheet_id AS "pricingSheetId", o.quotation_letter_id AS "quotationLetterId",
              o.winner_name AS "winnerName", o.winner_price AS "winnerPrice", o.our_price AS "ourPrice",
              o.loss_reason AS "lossReason", o.loss_notes AS "lossNotes",
              ge.name AS "entityName", cu.full_name AS "claimedByName",
              ps.sheet_number AS "pricingSheetNumber", cl.letter_number AS "quotationLetterNumber"
       FROM procurement_opportunities o
       LEFT JOIN government_entities ge ON ge.id = o.government_entity_id
       LEFT JOIN users cu ON cu.id = o.claimed_by_user_id
       LEFT JOIN pricing_sheets ps ON ps.id = o.pricing_sheet_id
       LEFT JOIN correspondence_letters cl ON cl.id = o.quotation_letter_id
       WHERE o.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "الفرصة غير موجودة" });

    const [items, files, history] = await Promise.all([
      pool.query(
        `SELECT i.id, i.item_name AS "itemName", i.specifications, i.quantity, i.unit, i.notes, i.sort_order AS "sortOrder"
         FROM opportunity_items i WHERE i.opportunity_id = $1 ORDER BY i.sort_order, i.id`, [id]),
      pool.query(
        `SELECT f.id, f.file_name AS "fileName", f.file_url AS "fileUrl", f.extracted_text AS "extractedText", f.created_at AS "createdAt"
         FROM opportunity_files f WHERE f.opportunity_id = $1 ORDER BY f.id`, [id]),
      pool.query(
        `SELECT h.stage, h.changed_at AS "changedAt", h.note, u.full_name AS "changedByName"
         FROM opportunity_stage_history h LEFT JOIN users u ON u.id = h.changed_by_user_id
         WHERE h.opportunity_id = $1 ORDER BY h.changed_at DESC`, [id]),
    ]);

    // العروض لكل بند (مع اسم المورد من القائمة إن رُبط)
    const itemIds = items.rows.map((r: any) => r.id);
    let quotes: any[] = [];
    if (itemIds.length) {
      const { rows: qRows } = await pool.query(
        `SELECT q.id, q.item_id AS "itemId", q.supplier_id AS "supplierId",
                COALESCE(s.name, q.supplier_name) AS "supplierName",
                q.contact_person AS "contactPerson", q.phone, q.whatsapp, q.email,
                q.price, q.delivery_days AS "deliveryDays", q.quality_rating AS "qualityRating",
                q.warranty, q.quote_file_url AS "quoteFileUrl", q.catalog_file_url AS "catalogFileUrl",
                q.image_file_url AS "imageFileUrl", q.notes, q.is_chosen AS "isChosen"
         FROM opportunity_item_quotes q
         LEFT JOIN suppliers s ON s.id = q.supplier_id
         WHERE q.item_id = ANY($1::int[]) ORDER BY q.id`,
        [itemIds]
      );
      quotes = qRows;
    }

    return res.json({
      ...rows[0],
      items: items.rows.map((it: any) => ({ ...it, quotes: quotes.filter((q) => q.itemId === it.id) })),
      files: files.rows,
      history: history.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب الفرصة" });
  }
});

/* ══════════════════════════════════════
   UPDATE — بيانات + انتقالات الحالة + النتيجة
══════════════════════════════════════ */
router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(procurementOpportunitiesTable).where(eq(procurementOpportunitiesTable.id, id));
    if (!existing) return res.status(404).json({ error: "الفرصة غير موجودة" });

    // المستلم أو أصحاب صلاحية الكتابة أو مسؤولو التسعير/الاعتماد
    const isClaimer = existing.claimedByUserId != null && existing.claimedByUserId === req.session.userId;
    if (!isClaimer && !hasMatrixWrite(req) && !canPrice(req) && !canApprove(req)) {
      return res.status(403).json({ error: OWNER_ONLY_MSG });
    }

    const data = updateOpportunitySchema.parse(req.body) as Record<string, any>;
    for (const f of ["issueDate", "submissionDeadline", "openingDate", "bondValue", "winnerPrice", "ourPrice"]) {
      if (data[f] === "") data[f] = null;
    }

    const extra: Record<string, any> = {};
    if (data.status !== undefined && data.status !== existing.status) {
      if (!STATUSES.includes(data.status)) return res.status(400).json({ error: "حالة غير صالحة" });
      const allowed = TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(data.status)) {
        return res.status(400).json({ error: `لا يمكن الانتقال من الحالة الحالية إلى هذه الحالة` });
      }
      // بوابات الصلاحيات الدقيقة
      if (data.status === "priced" && !canPrice(req)) {
        return res.status(403).json({ error: "مرحلة التسعير تتطلب صلاحية قسم التسعير" });
      }
      if (data.status === "quotation_sent" && !canApprove(req)) {
        return res.status(403).json({ error: "إرسال عرض السعر يتطلب صلاحية الإدارة" });
      }
      // طوابع SLA التلقائية
      if (data.status === "pending_pricing") extra.researchDoneAt = new Date();
      if (data.status === "priced") extra.pricedAt = new Date();
      if (data.status === "quotation_sent") extra.quotationSentAt = new Date();
      if (["won", "lost", "cancelled", "retendered"].includes(data.status)) extra.resultAt = new Date();
    }

    const [row] = await db.update(procurementOpportunitiesTable)
      .set({ ...data, ...extra, updatedAt: new Date() })
      .where(eq(procurementOpportunitiesTable.id, id))
      .returning();

    if (data.status !== undefined && data.status !== existing.status) {
      await logStage(id, data.status, req.session.userId ?? null);
      // إشعارات الأحداث المفصلية
      const KEY_EVENTS: Record<string, string> = {
        pending_pricing: `الفرصة ${row.orderNumber} جاهزة للتسعير`,
        quotation_sent: `أُرسل عرض السعر للفرصة ${row.orderNumber}`,
        won: `🎉 فوز! تمت الترسية علينا في ${row.orderNumber}`,
        lost: `تمت الترسية على منافس في ${row.orderNumber}`,
      };
      if (KEY_EVENTS[data.status]) {
        notifyOpportunityUsers(req.session.userId ?? null, `opportunity_${data.status}`, KEY_EVENTS[data.status], `/opportunities/${id}`);
      }
      // عند الخسارة: تسجيل المنافس في قاعدة المنافسين تلقائيًا
      if (data.status === "lost" && row.winnerName?.trim()) {
        try {
          await pool.query(
            `INSERT INTO competitors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
            [row.winnerName.trim()]
          );
        } catch { /* جدول المنافسين قد يختلف قيده — لا يوقف التحديث */ }
      }
    }

    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث الفرصة" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(procurementOpportunitiesTable).where(eq(procurementOpportunitiesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الفرصة" });
  }
});

/* ══════════════════════════════════════
   ITEMS — البنود
══════════════════════════════════════ */
router.post("/:id/items", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    if (!(await canWorkOn(req, id))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const body = { ...req.body, opportunityId: id };
    if (body.quantity === "" || body.quantity == null) body.quantity = "1";
    if (typeof body.quantity === "number") body.quantity = String(body.quantity);
    const data = insertOpportunityItemSchema.parse(body);
    const [row] = await db.insert(opportunityItemsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة البند" });
  }
});

router.patch("/items/:itemId", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const oppId = await oppIdOfItem(itemId);
    if (!oppId) return res.status(404).json({ error: "البند غير موجود" });
    if (!(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const body = { ...req.body };
    if (typeof body.quantity === "number") body.quantity = String(body.quantity);
    if (body.quantity === "") body.quantity = "1";
    const data = updateOpportunityItemSchema.parse(body);
    const [row] = await db.update(opportunityItemsTable).set(data).where(eq(opportunityItemsTable.id, itemId)).returning();
    if (!row) return res.status(404).json({ error: "البند غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث البند" });
  }
});

router.delete("/items/:itemId", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const oppId = await oppIdOfItem(itemId);
    if (oppId && !(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    await db.delete(opportunityItemsTable).where(eq(opportunityItemsTable.id, itemId));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف البند" });
  }
});

/* ══════════════════════════════════════
   QUOTES — عروض الموردين لكل بند
══════════════════════════════════════ */
router.post("/items/:itemId/quotes", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const oppId = await oppIdOfItem(itemId);
    if (!oppId) return res.status(404).json({ error: "البند غير موجود" });
    if (!(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const body = { ...req.body, itemId };
    for (const f of ["price"]) {
      if (typeof body[f] === "number") body[f] = String(body[f]);
      if (body[f] === "" || body[f] == null) body[f] = "0";
    }
    for (const f of ["deliveryDays", "qualityRating", "supplierId"]) {
      if (body[f] === "" || body[f] == null) body[f] = null;
      else if (typeof body[f] === "string") body[f] = Number(body[f]);
    }
    const data = insertOpportunityQuoteSchema.parse(body);
    const [row] = await db.insert(opportunityItemQuotesTable)
      .values({ ...data, createdByUserId: req.session.userId ?? null })
      .returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في إضافة عرض المورد" });
  }
});

router.patch("/quotes/:quoteId", async (req: Request, res: Response) => {
  const quoteId = parseId(req.params.quoteId);
  if (!quoteId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const oppId = await oppIdOfQuote(quoteId);
    if (oppId && !(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const body = { ...req.body };
    if (typeof body.price === "number") body.price = String(body.price);
    if (body.price === "") body.price = "0";
    for (const f of ["deliveryDays", "qualityRating", "supplierId"]) {
      if (body[f] === "") body[f] = null;
      else if (typeof body[f] === "string" && body[f] != null) body[f] = Number(body[f]);
    }
    const data = updateOpportunityQuoteSchema.parse(body);
    const [row] = await db.update(opportunityItemQuotesTable).set(data).where(eq(opportunityItemQuotesTable.id, quoteId)).returning();
    if (!row) return res.status(404).json({ error: "العرض غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث العرض" });
  }
});

/** اختيار عرض كأفضل عرض للبند — حصري (يلغي اختيار البقية) */
router.post("/quotes/:quoteId/choose", async (req: Request, res: Response) => {
  const quoteId = parseId(req.params.quoteId);
  if (!quoteId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [quote] = await db.select().from(opportunityItemQuotesTable).where(eq(opportunityItemQuotesTable.id, quoteId));
    if (!quote) return res.status(404).json({ error: "العرض غير موجود" });
    const oppId = await oppIdOfItem(quote.itemId);
    if (oppId && !(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    await db.update(opportunityItemQuotesTable).set({ isChosen: false }).where(eq(opportunityItemQuotesTable.itemId, quote.itemId));
    const [row] = await db.update(opportunityItemQuotesTable).set({ isChosen: true }).where(eq(opportunityItemQuotesTable.id, quoteId)).returning();
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في اختيار العرض" });
  }
});

router.delete("/quotes/:quoteId", async (req: Request, res: Response) => {
  const quoteId = parseId(req.params.quoteId);
  if (!quoteId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const oppId = await oppIdOfQuote(quoteId);
    if (oppId && !(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    await db.delete(opportunityItemQuotesTable).where(eq(opportunityItemQuotesTable.id, quoteId));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف العرض" });
  }
});

/* ══════════════════════════════════════
   FILES — مرفقات الأمر + استخراج نص PDF الرقمي
══════════════════════════════════════ */
router.post("/:id/files", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    if (!(await canWorkOn(req, id))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const { fileName, fileUrl } = req.body as { fileName?: string; fileUrl?: string };
    if (!fileName || !fileUrl) return res.status(400).json({ error: "اسم الملف ومساره مطلوبان" });

    // استخراج النص تلقائيًا من PDF الرقمي (أفضل جهد — لا يوقف الرفع)
    let extractedText: string | null = null;
    if (fileName.toLowerCase().endsWith(".pdf")) {
      try {
        const absolutePath = await objectStorage.getPrivateObjectPath(fileUrl);
        const { PDFParse } = await import("pdf-parse");
        const fs = await import("fs");
        const buf = fs.readFileSync(absolutePath);
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        try {
          const result = await parser.getText();
          extractedText = (result?.text ?? "").trim().slice(0, 50_000) || null;
        } finally {
          await parser.destroy().catch(() => {});
        }
      } catch (err) {
        console.error("pdf text extraction failed", err);
      }
    }

    const [row] = await db.insert(opportunityFilesTable).values({
      opportunityId: id, fileName, fileUrl, extractedText,
      uploadedByUserId: req.session.userId ?? null,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في حفظ الملف" });
  }
});

router.patch("/files/:fileId", async (req: Request, res: Response) => {
  const fileId = parseId(req.params.fileId);
  if (!fileId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const oppId = await oppIdOfFile(fileId);
    if (oppId && !(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const { extractedText } = req.body as { extractedText?: string };
    const [row] = await db.update(opportunityFilesTable)
      .set({ extractedText: extractedText ?? null })
      .where(eq(opportunityFilesTable.id, fileId)).returning();
    if (!row) return res.status(404).json({ error: "الملف غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في تحديث النص" });
  }
});

router.delete("/files/:fileId", async (req: Request, res: Response) => {
  const fileId = parseId(req.params.fileId);
  if (!fileId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const oppId = await oppIdOfFile(fileId);
    if (oppId && !(await canWorkOn(req, oppId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    await db.delete(opportunityFilesTable).where(eq(opportunityFilesTable.id, fileId));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الملف" });
  }
});

/* ══════════════════════════════════════
   إنشاء ورقة تسعير مبسّطة من الفرصة
   (البنود تُنسخ + سعر المورد المختار = تكلفة الوحدة)
══════════════════════════════════════ */
router.post("/:id/create-pricing-sheet", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [opp] = await db.select().from(procurementOpportunitiesTable).where(eq(procurementOpportunitiesTable.id, id));
    if (!opp) return res.status(404).json({ error: "الفرصة غير موجودة" });
    if (opp.pricingSheetId) return res.status(400).json({ error: "توجد ورقة تسعير مرتبطة بالفعل بهذه الفرصة" });
    const isClaimerSheet = opp.claimedByUserId != null && opp.claimedByUserId === req.session.userId;
    if (!isClaimerSheet && !hasMatrixWrite(req) && !canPrice(req)) {
      return res.status(403).json({ error: OWNER_ONLY_MSG });
    }

    const { rows: items } = await pool.query(
      `SELECT i.id, i.item_name AS "itemName", i.quantity,
              (SELECT q.price FROM opportunity_item_quotes q WHERE q.item_id = i.id AND q.is_chosen = true LIMIT 1) AS "chosenPrice"
       FROM opportunity_items i WHERE i.opportunity_id = $1 ORDER BY i.sort_order, i.id`,
      [id]
    );

    const { rows: sheetRows } = await pool.query(
      `INSERT INTO pricing_sheets (sheet_number, title, pricing_mode, status, created_by_user_id)
       VALUES ($1, $2, 'simple', 'draft', $3)
       RETURNING id, sheet_number AS "sheetNumber"`,
      [`OPP-${opp.orderNumber}`, `تسعير فرصة: ${opp.title}`, req.session.userId ?? null]
    );
    const sheet = sheetRows[0];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await pool.query(
        `INSERT INTO pricing_items (sheet_id, item_number, item_name, quantity, unit_cost_usd, sell_price_unit, sort_order)
         VALUES ($1, $2, $3, $4, $5, 0, $6)`,
        [sheet.id, String(i + 1), it.itemName, it.quantity, it.chosenPrice ?? 0, i]
      );
    }

    await db.update(procurementOpportunitiesTable)
      .set({ pricingSheetId: sheet.id, updatedAt: new Date() })
      .where(eq(procurementOpportunitiesTable.id, id));

    return res.status(201).json(sheet);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في إنشاء ورقة التسعير" });
  }
});

/* ══════════════════════════════════════
   إصدار كتاب عرض السعر — جدول (المنتج/الكمية/الفردي/الإجمالي)
══════════════════════════════════════ */
function tCell(text: string, header = false) {
  return {
    type: header ? "tableHeader" : "tableCell",
    content: [{ type: "paragraph", content: text ? [{ type: "text", text, ...(header ? { marks: [{ type: "bold" }] } : {}) }] : [] }],
  };
}

router.post("/:id/build-quotation", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [opp] = await db.select().from(procurementOpportunitiesTable).where(eq(procurementOpportunitiesTable.id, id));
    if (!opp) return res.status(404).json({ error: "الفرصة غير موجودة" });
    if (opp.quotationLetterId) return res.status(400).json({ error: "يوجد كتاب عرض سعر مرتبط بالفعل" });
    if (!opp.pricingSheetId) return res.status(400).json({ error: "أنشئ ورقة التسعير أولًا واعتمد أسعار البيع" });
    const isClaimerQuot = opp.claimedByUserId != null && opp.claimedByUserId === req.session.userId;
    if (!isClaimerQuot && !hasMatrixWrite(req) && !canPrice(req) && !canApprove(req)) {
      return res.status(403).json({ error: OWNER_ONLY_MSG });
    }

    // بنود الفرصة + سعر البيع من ورقة التسعير (مطابقة بالاسم والترتيب)
    const { rows: priced } = await pool.query(
      `SELECT oi.item_name AS "itemName", oi.quantity, oi.unit,
              COALESCE(pi.sell_price_unit, 0) AS "sellPriceUnit"
       FROM opportunity_items oi
       LEFT JOIN pricing_items pi ON pi.sheet_id = $2 AND pi.item_name = oi.item_name
       WHERE oi.opportunity_id = $1
       ORDER BY oi.sort_order, oi.id`,
      [id, opp.pricingSheetId]
    );
    if (!priced.length) return res.status(400).json({ error: "لا توجد بنود في الفرصة" });

    const fmt = (v: number) => Number(v || 0).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    let grandTotal = 0;
    const bodyRows = priced.map((r: any) => {
      const qty = Number(r.quantity) || 0;
      const unitPrice = Number(r.sellPriceUnit) || 0;
      const total = qty * unitPrice;
      grandTotal += total;
      return {
        type: "tableRow",
        content: [tCell(r.itemName), tCell(`${qty}${r.unit ? ` ${r.unit}` : ""}`), tCell(fmt(unitPrice)), tCell(fmt(total))],
      };
    });

    const bodyJson = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: `بالإشارة إلى أمر الشراء رقم (${opp.orderNumber}) الخاص بـ${opp.title}، يسرنا تقديم عرض أسعارنا وفق الجدول التالي:` }] },
        {
          type: "table",
          content: [
            { type: "tableRow", content: [tCell("اسم المنتج", true), tCell("الكمية", true), tCell("السعر الفردي (د.ك)", true), tCell("السعر الإجمالي (د.ك)", true)] },
            ...bodyRows,
            { type: "tableRow", content: [tCell("الإجمالي العام", true), tCell(""), tCell(""), tCell(fmt(grandTotal), true)] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "الأسعار شاملة التوصيل. العرض ساري لمدة 90 يومًا من تاريخه." }] },
      ],
    });

    const letter = await db.transaction(async (tx) => {
      const letterNumber = await generateLetterNumber(tx, {
        governmentEntityId: opp.governmentEntityId ?? undefined,
        sourceType: undefined,
      });
      const [entity] = opp.governmentEntityId
        ? (await pool.query(`SELECT name FROM government_entities WHERE id = $1`, [opp.governmentEntityId])).rows
        : [null];
      const [row] = await tx.insert(correspondenceLettersTable).values({
        letterNumber,
        direction: "outgoing",
        status: "draft",
        subject: `عرض سعر — أمر شراء رقم ${opp.orderNumber}`,
        letterType: "quotation",
        bodyJson,
        letterDate: new Date().toISOString().slice(0, 10),
        recipientName: entity?.name ?? null,
        governmentEntityId: opp.governmentEntityId,
        departmentId: opp.departmentId,
        contactId: opp.contactId,
        createdByUserId: req.session.userId ?? null,
      }).returning();
      return row;
    });

    await db.update(procurementOpportunitiesTable)
      .set({ quotationLetterId: letter.id, ourPrice: String(grandTotal.toFixed(3)), updatedAt: new Date() })
      .where(eq(procurementOpportunitiesTable.id, id));

    return res.status(201).json({ id: letter.id, letterNumber: letter.letterNumber, grandTotal });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في إصدار كتاب عرض السعر" });
  }
});

export default router;
