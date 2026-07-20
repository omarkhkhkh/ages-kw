import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  pricingSheetsTable,
  insertPricingSheetSchema,
  updatePricingSheetSchema,
  pricingItemsTable,
  insertPricingItemSchema,
  updatePricingItemSchema,
} from "@workspace/db";
import { hasModuleAction } from "../middleware/auth";

const router = Router();

/* استثناء الملكية: مُنشئ ورقة التسعير يعمل عليها كاملة (أصناف/أسعار/اعتماد)
   حتى لو كانت صلاحيته على الوحدة "عرض" فقط — نفس نمط مستلم الفرصة والفني
   المكلّف. أصحاب صلاحية الإضافة/التعديل بالمصفوفة يعملون على أي ورقة. */
const OWNER_ONLY_MSG = "هذه الورقة يعمل عليها مُنشئها فقط — أنشئ ورقة جديدة خاصة بك أو اطلب صلاحية التعديل في قسم التسعير";
function hasMatrixWrite(req: Request): boolean {
  return hasModuleAction(req, "accessPricing", "add") || hasModuleAction(req, "accessPricing", "edit");
}
async function canWorkOnSheet(req: Request, sheetId: number): Promise<boolean> {
  if (req.session.role === "admin" || hasMatrixWrite(req)) return true;
  const [s] = await db.select({ createdByUserId: pricingSheetsTable.createdByUserId })
    .from(pricingSheetsTable).where(eq(pricingSheetsTable.id, sheetId));
  return !!s?.createdByUserId && s.createdByUserId === req.session.userId;
}
async function sheetIdOfItem(itemId: number): Promise<number | null> {
  const [i] = await db.select({ sheetId: pricingItemsTable.sheetId })
    .from(pricingItemsTable).where(eq(pricingItemsTable.id, itemId));
  return i?.sheetId ?? null;
}

const NUMERIC_SHEET_FIELDS = [
  "containerShippingCost", "unloadingCost", "clearanceCost", "maintenanceCost",
  "bankFees", "exchangeRate", "customsPercent", "minProfitPercent", "goodProfitPercent",
];
const FK_SHEET_FIELDS = ["tenderId", "practiceId", "purchaseOrderId", "supplierId", "contractId"];

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeSheetBody(data: Record<string, any>) {
  for (const f of NUMERIC_SHEET_FIELDS) if (data[f] === "") data[f] = null;
  for (const f of FK_SHEET_FIELDS) if (data[f] === "") data[f] = null;
  return data;
}

/* ══════════════════════════════════════
   SHEETS — static routes before /:id
══════════════════════════════════════ */
router.get("/sheets", async (req: Request, res: Response) => {
  try {
    const { tenderId, practiceId, purchaseOrderId, supplierId, contractId, status, search } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (tenderId)        { params.push(Number(tenderId));        conditions.push(`ps.tender_id = $${params.length}`); }
    if (practiceId)       { params.push(Number(practiceId));       conditions.push(`ps.practice_id = $${params.length}`); }
    if (purchaseOrderId) { params.push(Number(purchaseOrderId)); conditions.push(`ps.purchase_order_id = $${params.length}`); }
    if (supplierId)        { params.push(Number(supplierId));        conditions.push(`ps.supplier_id = $${params.length}`); }
    if (contractId)        { params.push(Number(contractId));        conditions.push(`ps.contract_id = $${params.length}`); }
    if (status)             { params.push(status);                     conditions.push(`ps.status = $${params.length}`); }
    if (search)            { params.push(`%${search}%`);              conditions.push(`(ps.sheet_number ILIKE $${params.length} OR ps.title ILIKE $${params.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT ps.id, ps.sheet_number AS "sheetNumber", ps.title, ps.status, ps.version,
              ps.parent_sheet_id AS "parentSheetId",
              ps.tender_id AS "tenderId", ps.practice_id AS "practiceId",
              ps.purchase_order_id AS "purchaseOrderId", ps.supplier_id AS "supplierId", ps.contract_id AS "contractId",
              ps.created_at AS "createdAt", ps.updated_at AS "updatedAt", ps.approved_at AS "approvedAt",
              t.tender_number AS "tenderNumber", pr.practice_number AS "practiceNumber",
              po.order_number AS "purchaseOrderNumber", s.name AS "supplierName", c.contract_number AS "contractNumber",
              (SELECT COUNT(*)::int FROM pricing_items pi WHERE pi.sheet_id = ps.id) AS "itemCount"
       FROM pricing_sheets ps
       LEFT JOIN tenders t ON t.id = ps.tender_id
       LEFT JOIN practices pr ON pr.id = ps.practice_id
       LEFT JOIN direct_purchase_orders po ON po.id = ps.purchase_order_id
       LEFT JOIN suppliers s ON s.id = ps.supplier_id
       LEFT JOIN contracts c ON c.id = ps.contract_id
       ${where}
       ORDER BY ps.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب أوراق التسعير" });
  }
});

router.get("/sheets/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [sheet] = await db.select().from(pricingSheetsTable).where(eq(pricingSheetsTable.id, id));
    if (!sheet) return res.status(404).json({ error: "ورقة التسعير غير موجودة" });
    const items = await db.select().from(pricingItemsTable).where(eq(pricingItemsTable.sheetId, id)).orderBy(pricingItemsTable.sortOrder);
    return res.json({ ...sheet, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب ورقة التسعير" });
  }
});

router.post("/sheets", async (req: Request, res: Response) => {
  try {
    const data = insertPricingSheetSchema.parse(normalizeSheetBody({ ...req.body }));
    const [sheet] = await db.insert(pricingSheetsTable).values({ ...data, createdByUserId: req.session.userId! }).returning();
    return res.status(201).json(sheet);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في إنشاء ورقة التسعير" });
  }
});

router.patch("/sheets/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(pricingSheetsTable).where(eq(pricingSheetsTable.id, id));
    if (!existing) return res.status(404).json({ error: "ورقة التسعير غير موجودة" });
    if (!(await canWorkOnSheet(req, id))) return res.status(403).json({ error: OWNER_ONLY_MSG });

    const data = updatePricingSheetSchema.parse(normalizeSheetBody({ ...req.body })) as Record<string, any>;
    const patch: Record<string, any> = { ...data, updatedAt: new Date() };

    if (data.status !== undefined && data.status !== existing.status) {
      if (data.status === "approved") {
        patch.approvedByUserId = req.session.userId!;
        patch.approvedAt = new Date();
      } else {
        patch.approvedByUserId = null;
        patch.approvedAt = null;
      }
    }

    const [sheet] = await db.update(pricingSheetsTable).set(patch).where(eq(pricingSheetsTable.id, id)).returning();
    return res.json(sheet);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث ورقة التسعير" });
  }
});

router.delete("/sheets/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    if (!(await canWorkOnSheet(req, id))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    await db.delete(pricingSheetsTable).where(eq(pricingSheetsTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف ورقة التسعير" });
  }
});

router.post("/sheets/:id/duplicate", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [original] = await db.select().from(pricingSheetsTable).where(eq(pricingSheetsTable.id, id));
    if (!original) return res.status(404).json({ error: "ورقة التسعير غير موجودة" });
    if (!(await canWorkOnSheet(req, id))) return res.status(403).json({ error: OWNER_ONLY_MSG });

    const { id: _id, createdAt: _c, updatedAt: _u, approvedByUserId: _a, approvedAt: _ap, ...rest } = original as any;
    const [copy] = await db.insert(pricingSheetsTable).values({
      ...rest,
      sheetNumber: `${original.sheetNumber}-v${original.version + 1}`,
      status: "draft",
      version: original.version + 1,
      parentSheetId: original.id,
      createdByUserId: req.session.userId!,
    }).returning();

    const items = await db.select().from(pricingItemsTable).where(eq(pricingItemsTable.sheetId, id));
    if (items.length) {
      await db.insert(pricingItemsTable).values(
        items.map(({ id: _iid, sheetId: _sid, createdAt: _ic, updatedAt: _iu, ...item }: any) => ({
          ...item,
          sheetId: copy.id,
        }))
      );
    }

    return res.status(201).json(copy);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في إنشاء نسخة جديدة من ورقة التسعير" });
  }
});

/* ══════════════════════════════════════
   ITEMS
══════════════════════════════════════ */
router.post("/sheets/:id/items", async (req: Request, res: Response) => {
  const sheetId = parseId(req.params.id);
  if (!sheetId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    if (!(await canWorkOnSheet(req, sheetId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const data = insertPricingItemSchema.parse({ ...req.body, sheetId });
    const [row] = await db.insert(pricingItemsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة الصنف" });
  }
});

router.post("/sheets/:id/items/bulk", async (req: Request, res: Response) => {
  const sheetId = parseId(req.params.id);
  if (!sheetId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    if (!(await canWorkOnSheet(req, sheetId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const rows = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!rows.length) return res.status(400).json({ error: "لا توجد أصناف للاستيراد" });
    const parsed = rows.map((r: any) => insertPricingItemSchema.parse({ ...r, sheetId }));
    const inserted = await db.insert(pricingItemsTable).values(parsed).returning();
    return res.status(201).json(inserted);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في استيراد الأصناف" });
  }
});

router.patch("/items/:itemId", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const sid = await sheetIdOfItem(itemId);
    if (!sid) return res.status(404).json({ error: "الصنف غير موجود" });
    if (!(await canWorkOnSheet(req, sid))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const data = updatePricingItemSchema.parse(req.body) as Record<string, any>;
    for (const f of ["quantity", "unitCostUsd", "sellPriceUnit", "containers"]) if (data[f] === "") data[f] = "0";
    const [row] = await db.update(pricingItemsTable).set({ ...data, updatedAt: new Date() }).where(eq(pricingItemsTable.id, itemId)).returning();
    if (!row) return res.status(404).json({ error: "الصنف غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الصنف" });
  }
});

router.post("/items/:itemId/duplicate", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [original] = await db.select().from(pricingItemsTable).where(eq(pricingItemsTable.id, itemId));
    if (!original) return res.status(404).json({ error: "الصنف غير موجود" });
    if (!(await canWorkOnSheet(req, original.sheetId))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original as any;
    const [copy] = await db.insert(pricingItemsTable).values(rest).returning();
    return res.status(201).json(copy);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في نسخ الصنف" });
  }
});

router.delete("/items/:itemId", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const sid = await sheetIdOfItem(itemId);
    if (sid && !(await canWorkOnSheet(req, sid))) return res.status(403).json({ error: OWNER_ONLY_MSG });
    await db.delete(pricingItemsTable).where(eq(pricingItemsTable.id, itemId));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الصنف" });
  }
});

export default router;
