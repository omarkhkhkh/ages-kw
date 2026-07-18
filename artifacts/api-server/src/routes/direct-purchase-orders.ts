import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { ownRecordsOnly } from "../middleware/auth";
import {
  db,
  pool,
  directPurchaseOrdersTable,
  insertDirectPurchaseOrderSchema,
  updateDirectPurchaseOrderSchema,
  poItemsTable,
  insertPoItemSchema,
  updatePoItemSchema,
  poTeamMembersTable,
  poStageHistoryTable,
} from "@workspace/db";
import { insertAutomationTask } from "./task-automation";

const router = Router();

const EXECUTION_STAGES = [
  "supplier_approval", "po_issued", "materials_received",
  "materials_inspected", "delivered_to_entity", "closed",
];

const PO_COLUMNS = `
  po.id, po.order_number AS "orderNumber", po.supplier_id AS "supplierId", po.company_id AS "companyId",
  po.government_entity_id AS "governmentEntityId", po.department_id AS "departmentId", po.contact_id AS "contactId",
  po.contract_id AS "contractId",
  po.project_id AS "projectId", po.tender_id AS "tenderId", po.practice_id AS "practiceId",
  po.description, po.amount, po.order_date AS "orderDate", po.delivery_date AS "deliveryDate",
  po.status, po.priority, po.assigned_to_user_id AS "assignedToUserId",
  po.follow_up_manager_id AS "followUpManagerId", po.execution_stage AS "executionStage",
  po.po_file_url AS "poFileUrl", po.notes, po.created_at AS "createdAt", po.updated_at AS "updatedAt"
`;

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ══════════════════════════════════════
   ORDERS — static routes first
══════════════════════════════════════ */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, contractId } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    // خصوصية السجلات: الموظف بنطاق 'own' يرى سجلاته فقط (والقديمة بلا منشئ)
    if (ownRecordsOnly(req)) {
      params.push(req.session.userId);
      conditions.push(`(po.created_by_user_id IS NULL OR po.created_by_user_id = $${params.length})`);
    }
    if (status) { params.push(status); conditions.push(`po.status = $${params.length}`); }
    if (contractId) { params.push(Number(contractId)); conditions.push(`po.contract_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT ${PO_COLUMNS},
              s.name AS "supplierName", ge.name AS "entityName", c.contract_number AS "contractNumber",
              p.name AS "projectName", t.tender_number AS "tenderNumber", pr.practice_number AS "practiceNumber",
              au.full_name AS "assignedToName", fu.full_name AS "followUpManagerName", co.name AS "companyName",
              dep.name AS "departmentName", gc.name AS "contactName"
       FROM direct_purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN government_entities ge ON ge.id = po.government_entity_id
       LEFT JOIN contracts c ON c.id = po.contract_id
       LEFT JOIN projects p ON p.id = po.project_id
       LEFT JOIN tenders t ON t.id = po.tender_id
       LEFT JOIN practices pr ON pr.id = po.practice_id
       LEFT JOIN users au ON au.id = po.assigned_to_user_id
       LEFT JOIN users fu ON fu.id = po.follow_up_manager_id
       LEFT JOIN companies co ON co.id = po.company_id
       LEFT JOIN departments dep ON dep.id = po.department_id
       LEFT JOIN government_contacts gc ON gc.id = po.contact_id
       ${where}
       ORDER BY po.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب أوامر الشراء المباشر" });
  }
});

/* ══════════════════════════════════════
   AGGREGATE STATS — before /:id
══════════════════════════════════════ */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      WITH po_revenue AS (
        SELECT po.id, po.status,
               COALESCE(NULLIF(SUM(i.quantity * i.unit_price), 0), po.amount, 0) AS revenue
        FROM direct_purchase_orders po
        LEFT JOIN po_items i ON i.purchase_order_id = po.id
        GROUP BY po.id, po.amount, po.status
      ),
      po_cost AS (
        SELECT purchase_order_id, COALESCE(SUM(amount), 0) AS cost
        FROM finance_expenses
        WHERE purchase_order_id IS NOT NULL
        GROUP BY purchase_order_id
      )
      SELECT
        COUNT(*)::int AS "totalOrders",
        COUNT(*) FILTER (WHERE pr.status != 'completed')::int AS "activeOrders",
        COALESCE(SUM(pr.revenue), 0)::numeric AS "totalValue",
        COALESCE(SUM(pr.revenue - COALESCE(pc.cost, 0)), 0)::numeric AS "totalProfit",
        CASE WHEN SUM(pr.revenue) > 0
          THEN ROUND((SUM(pr.revenue - COALESCE(pc.cost, 0)) / SUM(pr.revenue) * 100)::numeric, 2)
          ELSE 0 END AS "avgMarginPct"
      FROM po_revenue pr
      LEFT JOIN po_cost pc ON pc.purchase_order_id = pr.id
    `);
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب مؤشرات أوامر الشراء" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT ${PO_COLUMNS},
              s.name AS "supplierName", ge.name AS "entityName", c.contract_number AS "contractNumber",
              p.name AS "projectName", t.tender_number AS "tenderNumber", pr.practice_number AS "practiceNumber",
              au.full_name AS "assignedToName", fu.full_name AS "followUpManagerName", co.name AS "companyName",
              dep.name AS "departmentName", gc.name AS "contactName"
       FROM direct_purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN government_entities ge ON ge.id = po.government_entity_id
       LEFT JOIN contracts c ON c.id = po.contract_id
       LEFT JOIN projects p ON p.id = po.project_id
       LEFT JOIN tenders t ON t.id = po.tender_id
       LEFT JOIN practices pr ON pr.id = po.practice_id
       LEFT JOIN users au ON au.id = po.assigned_to_user_id
       LEFT JOIN users fu ON fu.id = po.follow_up_manager_id
       LEFT JOIN companies co ON co.id = po.company_id
       LEFT JOIN departments dep ON dep.id = po.department_id
       LEFT JOIN government_contacts gc ON gc.id = po.contact_id
       WHERE po.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "أمر الشراء غير موجود" });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب أمر الشراء" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    // عمود numeric يتوقع نصًا في Zod — بعض النماذج ترسل رقمًا
    if (typeof req.body?.amount === "number") req.body.amount = String(req.body.amount);
    const data = insertDirectPurchaseOrderSchema.parse(req.body) as Record<string, any>;
    // أعمدة date/numeric ترفض "" على مستوى الدرايفر — تطبيع الفارغ إلى null (كما في PATCH)
    for (const f of ["orderDate", "deliveryDate", "amount"]) {
      if (data[f] === "") data[f] = null;
    }
    const [order] = await db.insert(directPurchaseOrdersTable).values({ ...data, createdByUserId: req.session.userId ?? null } as any).returning();
    return res.status(201).json(order);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء أمر الشراء" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(directPurchaseOrdersTable).where(eq(directPurchaseOrdersTable.id, id));
    if (!existing) return res.status(404).json({ error: "أمر الشراء غير موجود" });

    // عمود numeric يتوقع نصًا في Zod — بعض النماذج ترسل رقمًا
    if (typeof req.body?.amount === "number") req.body.amount = String(req.body.amount);
    const data = updateDirectPurchaseOrderSchema.parse(req.body) as Record<string, any>;
    if (data.executionStage !== undefined && !EXECUTION_STAGES.includes(data.executionStage)) {
      return res.status(400).json({ error: "مرحلة تنفيذ غير صالحة" });
    }
    // date/numeric columns reject "" at the driver level — normalize blank strings to null
    for (const f of ["orderDate", "deliveryDate", "amount"]) {
      if (data[f] === "") data[f] = null;
    }
    const [order] = await db
      .update(directPurchaseOrdersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(directPurchaseOrdersTable.id, id))
      .returning();

    if (data.executionStage !== undefined && data.executionStage !== existing.executionStage) {
      await db.insert(poStageHistoryTable).values({
        purchaseOrderId: id,
        stage: data.executionStage,
        changedByUserId: req.session.userId!,
      });
      if (data.executionStage === "po_issued") {
        insertAutomationTask({
          title: `متابعة أمر شراء صادر: ${order.orderNumber}`,
          sourceType: "po_issued", sourceId: id, triggerKey: "po_issued",
          linkedEntityType: "purchaseOrder", linkedEntityId: id, dueDate: order.deliveryDate,
        }).catch(() => {});
      }
    }

    return res.json(order);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث أمر الشراء" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(directPurchaseOrdersTable).where(eq(directPurchaseOrdersTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف أمر الشراء" });
  }
});

/* ══════════════════════════════════════
   ITEMS (بنود أمر الشراء)
══════════════════════════════════════ */
router.get("/:id/items", async (req: Request, res: Response) => {
  const poId = parseId(req.params.id);
  if (!poId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const rows = await db.select().from(poItemsTable).where(eq(poItemsTable.purchaseOrderId, poId)).orderBy(poItemsTable.sortOrder);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب بنود أمر الشراء" });
  }
});

router.post("/:id/items", async (req: Request, res: Response) => {
  const poId = parseId(req.params.id);
  if (!poId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = insertPoItemSchema.parse({ ...req.body, purchaseOrderId: poId });
    const [row] = await db.insert(poItemsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة البند" });
  }
});

router.patch("/:id/items/:itemId", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updatePoItemSchema.parse(req.body) as Record<string, any>;
    if (data.quantity === "") data.quantity = null;
    if (data.unitPrice === "") data.unitPrice = null;
    const [row] = await db.update(poItemsTable).set({ ...data, updatedAt: new Date() }).where(eq(poItemsTable.id, itemId)).returning();
    if (!row) return res.status(404).json({ error: "البند غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث البند" });
  }
});

router.delete("/:id/items/:itemId", async (req: Request, res: Response) => {
  const itemId = parseId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(poItemsTable).where(eq(poItemsTable.id, itemId));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف البند" });
  }
});

/* ══════════════════════════════════════
   TEAM (فريق عمل الطلب)
══════════════════════════════════════ */
router.get("/:id/team", async (req: Request, res: Response) => {
  const poId = parseId(req.params.id);
  if (!poId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT tm.id, tm.user_id AS "userId", tm.added_at AS "addedAt", u.full_name AS "fullName", u.username
       FROM po_team_members tm
       LEFT JOIN users u ON u.id = tm.user_id
       WHERE tm.purchase_order_id = $1
       ORDER BY tm.added_at`,
      [poId]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب فريق العمل" });
  }
});

router.post("/:id/team", async (req: Request, res: Response) => {
  const poId = parseId(req.params.id);
  if (!poId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { userId } = req.body as any;
    if (!userId) return res.status(400).json({ error: "الموظف مطلوب" });
    const [row] = await db.insert(poTeamMembersTable).values({ purchaseOrderId: poId, userId: Number(userId) }).returning();
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "فشل في إضافة عضو الفريق" });
  }
});

router.delete("/:id/team/:userId", async (req: Request, res: Response) => {
  const poId = parseId(req.params.id);
  const userId = parseId(req.params.userId);
  if (!poId || !userId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(poTeamMembersTable).where(
      and(eq(poTeamMembersTable.purchaseOrderId, poId), eq(poTeamMembersTable.userId, userId))
    );
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في إزالة عضو الفريق" });
  }
});

/* ══════════════════════════════════════
   STAGE HISTORY
══════════════════════════════════════ */
router.get("/:id/stage-history", async (req: Request, res: Response) => {
  const poId = parseId(req.params.id);
  if (!poId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT h.id, h.stage, h.changed_at AS "changedAt", u.full_name AS "changedByName"
       FROM po_stage_history h
       LEFT JOIN users u ON u.id = h.changed_by_user_id
       WHERE h.purchase_order_id = $1
       ORDER BY h.changed_at DESC`,
      [poId]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب سجل مراحل التنفيذ" });
  }
});

/* ══════════════════════════════════════
   PROFITABILITY
══════════════════════════════════════ */
router.get("/:id/profitability", async (req: Request, res: Response) => {
  const poId = parseId(req.params.id);
  if (!poId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [poRows, itemRows, expenseRows] = await Promise.all([
      pool.query(`SELECT amount FROM direct_purchase_orders WHERE id = $1`, [poId]),
      pool.query(`SELECT id, item_name AS "itemName", quantity, unit_price AS "unitPrice" FROM po_items WHERE purchase_order_id = $1`, [poId]),
      pool.query(`SELECT id, description, amount, category FROM finance_expenses WHERE purchase_order_id = $1`, [poId]),
    ]);
    if (!poRows.rows.length) return res.status(404).json({ error: "أمر الشراء غير موجود" });

    const items = itemRows.rows;
    const itemsTotal = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    const revenue = itemsTotal > 0 ? itemsTotal : Number(poRows.rows[0].amount) || 0;

    const expenses = expenseRows.rows;
    const expensesTotal = expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    const byCategoryMap: Record<string, number> = {};
    for (const e of expenses) byCategoryMap[e.category || "أخرى"] = (byCategoryMap[e.category || "أخرى"] || 0) + (Number(e.amount) || 0);
    const byCategory = Object.entries(byCategoryMap).map(([category, total]) => ({ category, total }));

    const profit = revenue - expensesTotal;
    const profitPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    return res.json({
      revenue, itemsTotal,
      expenses: { total: expensesTotal, byCategory, rows: expenses },
      totalCost: expensesTotal, profit, profitPct,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في حساب ربحية أمر الشراء" });
  }
});

export default router;
