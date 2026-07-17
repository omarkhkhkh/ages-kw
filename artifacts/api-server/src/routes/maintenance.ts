import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import {
  db,
  pool,
  maintenanceEquipmentTable,
  insertMaintenanceEquipmentSchema,
  updateMaintenanceEquipmentSchema,
  maintenanceWorkOrdersTable,
  insertMaintenanceWorkOrderSchema,
  updateMaintenanceWorkOrderSchema,
  maintenanceStageHistoryTable,
  maintenanceInventoryTable,
  insertMaintenanceInventorySchema,
  updateMaintenanceInventorySchema,
  maintenanceWorkOrderPartsTable,
  insertMaintenanceWorkOrderPartSchema,
  updateMaintenanceWorkOrderPartSchema,
  maintenancePreventivePlansTable,
  insertMaintenancePreventivePlanSchema,
  updateMaintenancePreventivePlanSchema,
  maintenanceBudgetsTable,
  insertMaintenanceBudgetSchema,
  maintenanceReportTemplatesTable,
} from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { buildTemplateDocx } from "../lib/docxFromTiptap";

const router = Router();
const objectStorageService = new ObjectStorageService();

const WORK_ORDER_STAGES = [
  "reported", "manager_approval", "technician_assigned", "in_progress",
  "parts_requested", "completed", "manager_review", "closed",
];

const EQ_COLUMNS = `
  eq.id, eq.asset_number AS "assetNumber", eq.name, eq.category, eq.manufacturer, eq.model,
  eq.serial_number AS "serialNumber", eq.year_of_manufacture AS "yearOfManufacture",
  eq.purchase_date::text AS "purchaseDate", eq.purchase_value AS "purchaseValue",
  eq.useful_life_years AS "usefulLifeYears", eq.warranty_expiry::text AS "warrantyExpiry",
  eq.location, eq.department, eq.branch, eq.responsible_user_id AS "responsibleUserId",
  eq.status, eq.photo_url AS "photoUrl", eq.notes, eq.created_at AS "createdAt", eq.updated_at AS "updatedAt"
`;

const WO_COLUMNS = `
  wo.id, wo.order_number AS "orderNumber", wo.equipment_id AS "equipmentId", wo.maintenance_type AS "maintenanceType",
  wo.report_reason AS "reportReason", wo.priority, wo.report_date AS "reportDate", wo.location, wo.stage,
  wo.assigned_technician_id AS "assignedTechnicianId", wo.approved_by_user_id AS "approvedByUserId",
  wo.project_id AS "projectId", wo.contract_id AS "contractId", wo.billed_amount AS "billedAmount",
  wo.government_entity_id AS "governmentEntityId", wo.department_id AS "departmentId", wo.contact_id AS "contactId",
  wo.cause, wo.downtime_minutes AS "downtimeMinutes",
  wo.started_at AS "startedAt", wo.completed_at AS "completedAt", wo.before_photo_url AS "beforePhotoUrl",
  wo.after_photo_url AS "afterPhotoUrl", wo.attachment_url AS "attachmentUrl", wo.notes,
  wo.created_at AS "createdAt", wo.updated_at AS "updatedAt"
`;

function parseId(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM maintenance_work_orders WHERE order_number LIKE $1`,
    [`WO-${year}-%`]
  );
  const seq = (Number(rows[0]?.count) || 0) + 1;
  return `WO-${year}-${String(seq).padStart(4, "0")}`;
}

async function generateReportNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM maintenance_generated_reports WHERE report_number LIKE $1`,
    [`RPT-${year}-%`]
  );
  const seq = (Number(rows[0]?.count) || 0) + 1;
  return `RPT-${year}-${String(seq).padStart(4, "0")}`;
}

function computeNextDueDate(from: Date, frequencyType: string, intervalValue: number): Date | null {
  const d = new Date(from);
  switch (frequencyType) {
    case "daily": d.setDate(d.getDate() + intervalValue); break;
    case "weekly": d.setDate(d.getDate() + 7 * intervalValue); break;
    case "monthly": d.setMonth(d.getMonth() + intervalValue); break;
    case "quarterly": d.setMonth(d.getMonth() + 3 * intervalValue); break;
    case "semi_annual": d.setMonth(d.getMonth() + 6 * intervalValue); break;
    case "annual": d.setFullYear(d.getFullYear() + intervalValue); break;
    case "meter_based": return null; // managed manually via meter readings
    default: d.setMonth(d.getMonth() + intervalValue);
  }
  return d;
}

/* ══════════════════════════════════════
   EQUIPMENT (سجل المعدات)
══════════════════════════════════════ */
router.get("/equipment", async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { params.push(status); conditions.push(`eq.status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(eq.name ILIKE $${params.length} OR eq.asset_number ILIKE $${params.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT ${EQ_COLUMNS}, u.full_name AS "responsibleName"
       FROM maintenance_equipment eq
       LEFT JOIN users u ON u.id = eq.responsible_user_id
       ${where}
       ORDER BY eq.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب سجل المعدات" });
  }
});

router.get("/equipment/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT ${EQ_COLUMNS}, u.full_name AS "responsibleName"
       FROM maintenance_equipment eq
       LEFT JOIN users u ON u.id = eq.responsible_user_id
       WHERE eq.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "المعدة غير موجودة" });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب بيانات المعدة" });
  }
});

router.get("/equipment/:id/history", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT ${WO_COLUMNS}, u.full_name AS "technicianName"
       FROM maintenance_work_orders wo
       LEFT JOIN users u ON u.id = wo.assigned_technician_id
       WHERE wo.equipment_id = $1
       ORDER BY wo.report_date DESC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب سجل صيانة المعدة" });
  }
});

router.post("/equipment", async (req: Request, res: Response) => {
  try {
    const data = insertMaintenanceEquipmentSchema.parse(req.body);
    const [row] = await db.insert(maintenanceEquipmentTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(400).json({ error: "رقم الأصل مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في إضافة المعدة" });
  }
});

router.patch("/equipment/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updateMaintenanceEquipmentSchema.parse(req.body) as Record<string, any>;
    for (const f of ["purchaseDate", "warrantyExpiry", "purchaseValue", "yearOfManufacture", "usefulLifeYears", "responsibleUserId"]) {
      if (data[f] === "") data[f] = null;
    }
    const [row] = await db.update(maintenanceEquipmentTable).set({ ...data, updatedAt: new Date() }).where(eq(maintenanceEquipmentTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "المعدة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث المعدة" });
  }
});

router.delete("/equipment/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(maintenanceEquipmentTable).where(eq(maintenanceEquipmentTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف المعدة" });
  }
});

/* ══════════════════════════════════════
   WORK ORDERS (أوامر الصيانة)
══════════════════════════════════════ */
router.get("/work-orders", async (req: Request, res: Response) => {
  try {
    const { stage, equipmentId, assignedTechnicianId, priority } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (stage) { params.push(stage); conditions.push(`wo.stage = $${params.length}`); }
    if (equipmentId) { params.push(Number(equipmentId)); conditions.push(`wo.equipment_id = $${params.length}`); }
    if (assignedTechnicianId) { params.push(Number(assignedTechnicianId)); conditions.push(`wo.assigned_technician_id = $${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`wo.priority = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT ${WO_COLUMNS}, eq.name AS "equipmentName", eq.asset_number AS "assetNumber",
              u.full_name AS "technicianName", p.name AS "projectName", c.contract_number AS "contractNumber"
       FROM maintenance_work_orders wo
       LEFT JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
       LEFT JOIN users u ON u.id = wo.assigned_technician_id
       LEFT JOIN projects p ON p.id = wo.project_id
       LEFT JOIN contracts c ON c.id = wo.contract_id
       ${where}
       ORDER BY wo.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب أوامر الصيانة" });
  }
});

router.get("/work-orders/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT ${WO_COLUMNS}, eq.name AS "equipmentName", eq.asset_number AS "assetNumber", eq.location AS "equipmentLocation",
              u.full_name AS "technicianName", a.full_name AS "approvedByName",
              p.name AS "projectName", c.contract_number AS "contractNumber"
       FROM maintenance_work_orders wo
       LEFT JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
       LEFT JOIN users u ON u.id = wo.assigned_technician_id
       LEFT JOIN users a ON a.id = wo.approved_by_user_id
       LEFT JOIN projects p ON p.id = wo.project_id
       LEFT JOIN contracts c ON c.id = wo.contract_id
       WHERE wo.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "أمر الصيانة غير موجود" });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب أمر الصيانة" });
  }
});

router.post("/work-orders", async (req: Request, res: Response) => {
  try {
    const orderNumber = req.body.orderNumber?.trim() || await generateOrderNumber();
    const data = insertMaintenanceWorkOrderSchema.parse({ ...req.body, orderNumber });
    const [row] = await db.insert(maintenanceWorkOrdersTable).values(data).returning();
    await db.insert(maintenanceStageHistoryTable).values({
      workOrderId: row.id,
      stage: row.stage,
      changedByUserId: req.session.userId!,
    });
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في إنشاء أمر الصيانة" });
  }
});

router.patch("/work-orders/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(maintenanceWorkOrdersTable).where(eq(maintenanceWorkOrdersTable.id, id));
    if (!existing) return res.status(404).json({ error: "أمر الصيانة غير موجود" });

    const data = updateMaintenanceWorkOrderSchema.parse(req.body) as Record<string, any>;
    if (data.stage !== undefined && !WORK_ORDER_STAGES.includes(data.stage)) {
      return res.status(400).json({ error: "مرحلة غير صالحة" });
    }
    for (const f of ["reportDate", "startedAt", "completedAt", "downtimeMinutes", "projectId", "contractId", "assignedTechnicianId", "approvedByUserId", "billedAmount"]) {
      if (data[f] === "") data[f] = null;
    }
    // auto-timestamp stage transitions for MTTR/response-time computation
    if (data.stage === "in_progress" && !existing.startedAt && data.startedAt === undefined) data.startedAt = new Date();
    if (data.stage === "completed" && !existing.completedAt && data.completedAt === undefined) data.completedAt = new Date();

    const [row] = await db
      .update(maintenanceWorkOrdersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(maintenanceWorkOrdersTable.id, id))
      .returning();

    if (data.stage !== undefined && data.stage !== existing.stage) {
      await db.insert(maintenanceStageHistoryTable).values({
        workOrderId: id,
        stage: data.stage,
        changedByUserId: req.session.userId!,
      });
    }

    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "فشل في تحديث أمر الصيانة" });
  }
});

// POST /work-orders/:id/log-income — copy the order's billedAmount into finance_income as an actual recorded income entry
router.post("/work-orders/:id/log-income", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [wo] = await db.select().from(maintenanceWorkOrdersTable).where(eq(maintenanceWorkOrdersTable.id, id));
    if (!wo) return res.status(404).json({ error: "أمر الصيانة غير موجود" });
    if (!wo.billedAmount) return res.status(400).json({ error: "لا توجد قيمة فاتورة مسجّلة على هذا الأمر" });

    const { rows } = await pool.query(
      `INSERT INTO finance_income (contract_id, maintenance_work_order_id, description, amount, date, category, created_by)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, 'contract', $5)
       RETURNING id, amount, date`,
      [wo.contractId ?? null, id, `فاتورة أمر صيانة رقم ${wo.orderNumber}`, wo.billedAmount, req.session.userId!]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تسجيل الإيراد" });
  }
});

router.delete("/work-orders/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(maintenanceWorkOrdersTable).where(eq(maintenanceWorkOrdersTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف أمر الصيانة" });
  }
});

router.get("/work-orders/:id/stage-history", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT h.id, h.stage, h.changed_at AS "changedAt", u.full_name AS "changedByName"
       FROM maintenance_stage_history h
       LEFT JOIN users u ON u.id = h.changed_by_user_id
       WHERE h.work_order_id = $1
       ORDER BY h.changed_at DESC`,
      [id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب سجل مراحل أمر الصيانة" });
  }
});

/* ══════════════════════════════════════
   PARTS (طلبات قطع الغيار لأمر الصيانة)
══════════════════════════════════════ */
router.get("/work-orders/:id/parts", async (req: Request, res: Response) => {
  const woId = parseId(req.params.id);
  if (!woId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.work_order_id AS "workOrderId", p.inventory_item_id AS "inventoryItemId",
              p.part_name AS "partName", p.quantity, p.unit_price AS "unitPrice", p.supplier_id AS "supplierId",
              p.request_date::text AS "requestDate", p.received_date::text AS "receivedDate", p.status,
              s.name AS "supplierName", inv.part_number AS "partNumber"
       FROM maintenance_work_order_parts p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN maintenance_inventory inv ON inv.id = p.inventory_item_id
       WHERE p.work_order_id = $1
       ORDER BY p.created_at`,
      [woId]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب طلبات قطع الغيار" });
  }
});

router.post("/work-orders/:id/parts", async (req: Request, res: Response) => {
  const woId = parseId(req.params.id);
  if (!woId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = insertMaintenanceWorkOrderPartSchema.parse({ ...req.body, workOrderId: woId });
    const [row] = await db.insert(maintenanceWorkOrderPartsTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إضافة طلب القطعة" });
  }
});

router.patch("/work-orders/:id/parts/:partId", async (req: Request, res: Response) => {
  const partId = parseId(req.params.partId);
  if (!partId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [existing] = await db.select().from(maintenanceWorkOrderPartsTable).where(eq(maintenanceWorkOrderPartsTable.id, partId));
    if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });

    const data = updateMaintenanceWorkOrderPartSchema.parse(req.body) as Record<string, any>;
    for (const f of ["requestDate", "receivedDate", "unitPrice"]) {
      if (data[f] === "") data[f] = null;
    }
    const [row] = await db.update(maintenanceWorkOrderPartsTable).set({ ...data, updatedAt: new Date() }).where(eq(maintenanceWorkOrderPartsTable.id, partId)).returning();

    // issuing a part physically consumes it from stock — decrement once, on the transition into "issued"
    if (data.status === "issued" && existing.status !== "issued" && existing.inventoryItemId) {
      await pool.query(
        `UPDATE maintenance_inventory SET quantity_on_hand = quantity_on_hand - $1, updated_at = now() WHERE id = $2`,
        [existing.quantity, existing.inventoryItemId]
      );
    }

    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث طلب القطعة" });
  }
});

router.delete("/work-orders/:id/parts/:partId", async (req: Request, res: Response) => {
  const partId = parseId(req.params.partId);
  if (!partId) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(maintenanceWorkOrderPartsTable).where(eq(maintenanceWorkOrderPartsTable.id, partId));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف طلب القطعة" });
  }
});

/* ══════════════════════════════════════
   INVENTORY (مستودع قطع الغيار)
══════════════════════════════════════ */
router.get("/inventory", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(maintenanceInventoryTable).orderBy(maintenanceInventoryTable.partName);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب المستودع" });
  }
});

router.get("/inventory/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [row] = await db.select().from(maintenanceInventoryTable).where(eq(maintenanceInventoryTable.id, id));
    if (!row) return res.status(404).json({ error: "الصنف غير موجود" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "فشل في جلب بيانات الصنف" });
  }
});

router.post("/inventory", async (req: Request, res: Response) => {
  try {
    const data = insertMaintenanceInventorySchema.parse(req.body);
    const [row] = await db.insert(maintenanceInventoryTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    if (err?.code === "23505") return res.status(400).json({ error: "رقم القطعة مستخدم بالفعل" });
    return res.status(500).json({ error: "فشل في إضافة الصنف" });
  }
});

router.patch("/inventory/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const data = updateMaintenanceInventorySchema.parse(req.body) as Record<string, any>;
    for (const f of ["reorderLevel", "unitCost"]) {
      if (data[f] === "") data[f] = null;
    }
    const [row] = await db.update(maintenanceInventoryTable).set({ ...data, updatedAt: new Date() }).where(eq(maintenanceInventoryTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "الصنف غير موجود" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الصنف" });
  }
});

router.delete("/inventory/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(maintenanceInventoryTable).where(eq(maintenanceInventoryTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الصنف" });
  }
});

router.post("/inventory/:id/receive", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { quantity, unitCost } = req.body as { quantity?: number; unitCost?: number };
    if (!quantity || quantity <= 0) return res.status(400).json({ error: "الكمية مطلوبة" });
    const { rows } = await pool.query(
      `UPDATE maintenance_inventory
       SET quantity_on_hand = quantity_on_hand + $1,
           unit_cost = COALESCE($2, unit_cost),
           updated_at = now()
       WHERE id = $3
       RETURNING id, part_number AS "partNumber", part_name AS "partName", quantity_on_hand AS "quantityOnHand", unit_cost AS "unitCost"`,
      [quantity, unitCost ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: "الصنف غير موجود" });
    return res.json(rows[0]);
  } catch {
    return res.status(500).json({ error: "فشل في استلام الكمية" });
  }
});

/* ══════════════════════════════════════
   PREVENTIVE PLANS (خطط الصيانة الوقائية)
══════════════════════════════════════ */
router.get("/preventive-plans", async (req: Request, res: Response) => {
  try {
    const { equipmentId } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (equipmentId) { params.push(Number(equipmentId)); conditions.push(`pp.equipment_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT pp.id, pp.equipment_id AS "equipmentId", pp.plan_name AS "planName",
              pp.frequency_type AS "frequencyType", pp.interval_value AS "intervalValue",
              pp.meter_interval_value AS "meterIntervalValue", pp.checklist_items AS "checklistItems",
              pp.active, pp.next_due_date::text AS "nextDueDate", pp.last_generated_date::text AS "lastGeneratedDate",
              pp.notes, pp.created_at AS "createdAt", pp.updated_at AS "updatedAt",
              eq.name AS "equipmentName", eq.asset_number AS "assetNumber"
       FROM maintenance_preventive_plans pp
       LEFT JOIN maintenance_equipment eq ON eq.id = pp.equipment_id
       ${where}
       ORDER BY pp.next_due_date ASC NULLS LAST`,
      params
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب خطط الصيانة الوقائية" });
  }
});

router.post("/preventive-plans", async (req: Request, res: Response) => {
  try {
    const body = { ...req.body };
    if (Array.isArray(body.checklistItems)) body.checklistItems = JSON.stringify(body.checklistItems);
    const data = insertMaintenancePreventivePlanSchema.parse(body);
    const [row] = await db.insert(maintenancePreventivePlansTable).values(data).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في إنشاء خطة الصيانة" });
  }
});

router.patch("/preventive-plans/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const body = { ...req.body };
    if (Array.isArray(body.checklistItems)) body.checklistItems = JSON.stringify(body.checklistItems);
    const data = updateMaintenancePreventivePlanSchema.parse(body) as Record<string, any>;
    for (const f of ["nextDueDate", "lastGeneratedDate", "meterIntervalValue"]) {
      if (data[f] === "") data[f] = null;
    }
    const [row] = await db.update(maintenancePreventivePlansTable).set({ ...data, updatedAt: new Date() }).where(eq(maintenancePreventivePlansTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "الخطة غير موجودة" });
    return res.json(row);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في تحديث الخطة" });
  }
});

router.delete("/preventive-plans/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(maintenancePreventivePlansTable).where(eq(maintenancePreventivePlansTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف الخطة" });
  }
});

router.post("/preventive-plans/:id/generate-order", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const [plan] = await db.select().from(maintenancePreventivePlansTable).where(eq(maintenancePreventivePlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "الخطة غير موجودة" });

    const orderNumber = await generateOrderNumber();
    let checklist: string[] = [];
    try { checklist = plan.checklistItems ? JSON.parse(plan.checklistItems) : []; } catch { checklist = []; }
    const notes = checklist.length ? `خطوات الخطة:\n- ${checklist.join("\n- ")}` : null;

    const [order] = await db.insert(maintenanceWorkOrdersTable).values({
      orderNumber,
      equipmentId: plan.equipmentId,
      maintenanceType: "preventive",
      reportReason: plan.planName,
      priority: "medium",
      stage: "reported",
      notes,
    }).returning();
    await db.insert(maintenanceStageHistoryTable).values({
      workOrderId: order.id,
      stage: "reported",
      changedByUserId: req.session.userId!,
    });

    const today = new Date();
    const nextDue = computeNextDueDate(today, plan.frequencyType, plan.intervalValue);
    await db.update(maintenancePreventivePlansTable).set({
      lastGeneratedDate: today.toISOString().slice(0, 10),
      nextDueDate: nextDue ? nextDue.toISOString().slice(0, 10) : plan.nextDueDate,
      updatedAt: new Date(),
    }).where(eq(maintenancePreventivePlansTable.id, id));

    return res.status(201).json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في توليد أمر الصيانة" });
  }
});

/* ══════════════════════════════════════
   BUDGETS (الميزانية)
══════════════════════════════════════ */
router.get("/budgets", async (req: Request, res: Response) => {
  try {
    const { year } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (year) { params.push(Number(year)); conditions.push(`year = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, year, month, amount, notes FROM maintenance_budgets ${where} ORDER BY year DESC, month ASC`,
      params
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب الميزانية" });
  }
});

router.post("/budgets", async (req: Request, res: Response) => {
  try {
    const data = insertMaintenanceBudgetSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO maintenance_budgets (year, month, amount, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (year, month) DO UPDATE SET amount = EXCLUDED.amount, notes = EXCLUDED.notes, updated_at = now()
       RETURNING id, year, month, amount, notes`,
      [data.year, data.month, data.amount, data.notes ?? null]
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "فشل في حفظ الميزانية" });
  }
});

router.get("/budgets/summary", async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const [monthly, income, capex, capexList, byEquipment, byType, byProject, byContract, byBranch, byWorkerCost] = await Promise.all([
      pool.query(
        `SELECT gs.month, COALESCE(b.amount, 0)::numeric AS budget,
           COALESCE((
             SELECT SUM(fe.amount) FROM finance_expenses fe
             LEFT JOIN workers w ON w.id = fe.worker_id
             WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
               AND EXTRACT(MONTH FROM fe.created_at)::int = gs.month
               AND (fe.maintenance_work_order_id IS NOT NULL
                    OR (fe.worker_id IS NOT NULL AND w.assigned_module = 'maintenance'))
           ), 0)::numeric AS spent
         FROM generate_series(1, 12) AS gs(month)
         LEFT JOIN maintenance_budgets b ON b.year = $1 AND b.month = gs.month
         ORDER BY gs.month`,
        [year]
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM fi.date)::int AS month, COALESCE(SUM(fi.amount), 0)::numeric AS income
         FROM finance_income fi
         WHERE fi.maintenance_work_order_id IS NOT NULL AND EXTRACT(YEAR FROM fi.date)::int = $1
         GROUP BY month`,
        [year]
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM eq.purchase_date)::int AS month, COALESCE(SUM(eq.purchase_value), 0)::numeric AS capex
         FROM maintenance_equipment eq
         WHERE eq.purchase_date IS NOT NULL AND EXTRACT(YEAR FROM eq.purchase_date)::int = $1
         GROUP BY month`,
        [year]
      ),
      pool.query(
        `SELECT eq.id, eq.name, eq.purchase_date AS "purchaseDate", eq.purchase_value AS "purchaseValue"
         FROM maintenance_equipment eq
         WHERE eq.purchase_date IS NOT NULL AND EXTRACT(YEAR FROM eq.purchase_date)::int = $1
         ORDER BY eq.purchase_date DESC`,
        [year]
      ),
      pool.query(
        `SELECT eq.name AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN maintenance_work_orders wo ON wo.id = fe.maintenance_work_order_id
         JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
         WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY eq.name ORDER BY total DESC LIMIT 10`,
        [year]
      ),
      pool.query(
        `SELECT wo.maintenance_type AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN maintenance_work_orders wo ON wo.id = fe.maintenance_work_order_id
         WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY wo.maintenance_type ORDER BY total DESC`,
        [year]
      ),
      pool.query(
        `SELECT p.name AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN maintenance_work_orders wo ON wo.id = fe.maintenance_work_order_id
         JOIN projects p ON p.id = wo.project_id
         WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY p.name ORDER BY total DESC LIMIT 10`,
        [year]
      ),
      pool.query(
        `SELECT c.contract_number AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN maintenance_work_orders wo ON wo.id = fe.maintenance_work_order_id
         JOIN contracts c ON c.id = wo.contract_id
         WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY c.contract_number ORDER BY total DESC LIMIT 10`,
        [year]
      ),
      pool.query(
        `SELECT COALESCE(eq.branch, 'غير محدد') AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN maintenance_work_orders wo ON wo.id = fe.maintenance_work_order_id
         JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
         WHERE EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY eq.branch ORDER BY total DESC LIMIT 10`,
        [year]
      ),
      pool.query(
        `SELECT w.full_name AS label, COALESCE(SUM(fe.amount), 0)::numeric AS total
         FROM finance_expenses fe
         JOIN workers w ON w.id = fe.worker_id
         WHERE w.assigned_module = 'maintenance' AND EXTRACT(YEAR FROM fe.created_at)::int = $1
         GROUP BY w.full_name ORDER BY total DESC LIMIT 10`,
        [year]
      ),
    ]);

    const incomeByMonth: Record<number, number> = {};
    for (const r of income.rows) incomeByMonth[r.month] = Number(r.income);
    const capexByMonth: Record<number, number> = {};
    for (const r of capex.rows) capexByMonth[r.month] = Number(r.capex);

    const monthlyRows = monthly.rows.map((r: any) => {
      const monthIncome = incomeByMonth[r.month] ?? 0;
      const spent = Number(r.spent);
      return { ...r, income: monthIncome, net: monthIncome - spent, capex: capexByMonth[r.month] ?? 0 };
    });

    const annualBudget = monthlyRows.reduce((s: number, r: any) => s + Number(r.budget), 0);
    const annualSpent = monthlyRows.reduce((s: number, r: any) => s + Number(r.spent), 0);
    const annualIncome = monthlyRows.reduce((s: number, r: any) => s + Number(r.income), 0);
    const annualCapex = monthlyRows.reduce((s: number, r: any) => s + Number(r.capex), 0);

    return res.json({
      year,
      annualBudget, annualSpent, annualRemaining: annualBudget - annualSpent,
      annualIncome, annualCapex, annualNet: annualIncome - annualSpent,
      monthly: monthlyRows,
      capexList: capexList.rows,
      byEquipment: byEquipment.rows,
      byType: byType.rows,
      byProject: byProject.rows,
      byContract: byContract.rows,
      byBranch: byBranch.rows,
      byWorkerCost: byWorkerCost.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب ملخص الميزانية" });
  }
});

/* ══════════════════════════════════════
   DASHBOARD — STATS & CHARTS
══════════════════════════════════════ */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM maintenance_equipment) AS "totalEquipment",
        (SELECT COUNT(*)::int FROM maintenance_equipment WHERE status = 'operational') AS "workingEquipment",
        (SELECT COUNT(*)::int FROM maintenance_equipment WHERE status IN ('stopped', 'out_of_service')) AS "stoppedEquipment",
        (SELECT COUNT(*)::int FROM maintenance_preventive_plans WHERE active AND next_due_date = CURRENT_DATE) AS "scheduledToday",
        (SELECT COUNT(*)::int FROM maintenance_work_orders WHERE stage != 'closed' AND report_date < CURRENT_DATE - INTERVAL '3 days') AS "overdueOrders",
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM finance_expenses
          WHERE maintenance_work_order_id IS NOT NULL
            AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)) AS "monthlyCost",
        (SELECT COALESCE(amount, 0)::numeric FROM maintenance_budgets
          WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND month = EXTRACT(MONTH FROM CURRENT_DATE)::int) AS "monthlyBudget",
        (SELECT COUNT(*)::int FROM maintenance_work_orders WHERE stage != 'closed') AS "openTickets",
        (SELECT CASE WHEN COUNT(*) > 0
           THEN ROUND((COUNT(*) FILTER (WHERE stage = 'closed')::numeric / COUNT(*) * 100), 1)
           ELSE 0 END
         FROM maintenance_work_orders) AS "completionRatePct",
        (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600)::numeric, 1), 0)
         FROM maintenance_work_orders WHERE completed_at IS NOT NULL) AS "mttrHours"
    `);
    const s = rows[0];
    return res.json({ ...s, remainingBudget: Number(s.monthlyBudget) - Number(s.monthlyCost) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب مؤشرات لوحة التحكم" });
  }
});

router.get("/charts", async (_req: Request, res: Response) => {
  try {
    const [monthlyCosts, topFailing, technicianPerf, typeComparison] = await Promise.all([
      pool.query(`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, SUM(amount)::numeric AS total
        FROM finance_expenses
        WHERE maintenance_work_order_id IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT eq.name AS label, COUNT(wo.id)::int AS count
        FROM maintenance_work_orders wo
        JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
        WHERE wo.maintenance_type IN ('corrective', 'emergency')
        GROUP BY eq.name ORDER BY count DESC LIMIT 10
      `),
      pool.query(`
        SELECT u.full_name AS label, COUNT(wo.id)::int AS count
        FROM maintenance_work_orders wo
        JOIN users u ON u.id = wo.assigned_technician_id
        WHERE wo.stage = 'closed'
        GROUP BY u.full_name ORDER BY count DESC LIMIT 10
      `),
      pool.query(`
        SELECT maintenance_type AS label, COUNT(*)::int AS count
        FROM maintenance_work_orders GROUP BY maintenance_type
      `),
    ]);
    return res.json({
      monthlyCosts: monthlyCosts.rows,
      topFailingEquipment: topFailing.rows,
      technicianPerformance: technicianPerf.rows,
      typeComparison: typeComparison.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب بيانات الرسوم البيانية" });
  }
});

/* ══════════════════════════════════════
   ALERTS (تنبيهات ذكية)
══════════════════════════════════════ */
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 14;
    const [upcoming, overdue, lowStock, recurring, budgetRow] = await Promise.all([
      pool.query(
        `SELECT pp.id, pp.plan_name AS "planName", pp.next_due_date::text AS "nextDueDate",
                eq.id AS "equipmentId", eq.name AS "equipmentName", eq.asset_number AS "assetNumber"
         FROM maintenance_preventive_plans pp
         JOIN maintenance_equipment eq ON eq.id = pp.equipment_id
         WHERE pp.active AND pp.next_due_date IS NOT NULL
           AND pp.next_due_date <= CURRENT_DATE + ($1 || ' days')::interval
         ORDER BY pp.next_due_date`,
        [days]
      ),
      pool.query(
        `SELECT wo.id, wo.order_number AS "orderNumber", wo.stage, wo.report_date AS "reportDate",
                eq.name AS "equipmentName", eq.asset_number AS "assetNumber"
         FROM maintenance_work_orders wo
         JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
         WHERE wo.stage != 'closed' AND wo.report_date < CURRENT_DATE - INTERVAL '3 days'
         ORDER BY wo.report_date`
      ),
      pool.query(
        `SELECT id, part_number AS "partNumber", part_name AS "partName",
                quantity_on_hand AS "quantityOnHand", reorder_level AS "reorderLevel"
         FROM maintenance_inventory
         WHERE reorder_level IS NOT NULL AND quantity_on_hand <= reorder_level
         ORDER BY quantity_on_hand ASC`
      ),
      pool.query(
        `SELECT eq.id, eq.name AS "equipmentName", eq.asset_number AS "assetNumber", COUNT(wo.id)::int AS "failureCount"
         FROM maintenance_work_orders wo
         JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
         WHERE wo.maintenance_type IN ('corrective', 'emergency') AND wo.created_at >= CURRENT_DATE - INTERVAL '90 days'
         GROUP BY eq.id, eq.name, eq.asset_number
         HAVING COUNT(wo.id) >= 3
         ORDER BY "failureCount" DESC`
      ),
      pool.query(
        `SELECT
           (SELECT COALESCE(amount, 0)::numeric FROM maintenance_budgets
             WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND month = EXTRACT(MONTH FROM CURRENT_DATE)::int) AS budget,
           (SELECT COALESCE(SUM(amount), 0)::numeric FROM finance_expenses
             WHERE maintenance_work_order_id IS NOT NULL
               AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)) AS spent
        `
      ),
    ]);

    const budget = Number(budgetRow.rows[0]?.budget || 0);
    const spent = Number(budgetRow.rows[0]?.spent || 0);

    return res.json({
      upcomingPreventive: upcoming.rows,
      overdueOrders: overdue.rows,
      lowStock: lowStock.rows,
      recurringFailures: recurring.rows,
      budgetExceeded: budget > 0 && spent > budget ? { budget, spent, overBy: spent - budget } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب التنبيهات" });
  }
});

/* ══════════════════════════════════════
   REPORT TEMPLATES (قوالب تقارير الزيارة)
══════════════════════════════════════ */
router.get("/report-templates", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(maintenanceReportTemplatesTable).orderBy(maintenanceReportTemplatesTable.name);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "فشل في جلب قوالب التقارير" });
  }
});

router.post("/report-templates", async (req: Request, res: Response) => {
  try {
    const { name, reportType, fileUrl, bodyJson, isDefault } = req.body as any;
    if (!name?.trim()) return res.status(400).json({ error: "الاسم مطلوب" });
    if (!fileUrl && !bodyJson) return res.status(400).json({ error: "يجب رفع ملف Word أو تصميم القالب داخل الموقع" });
    if (isDefault) {
      await pool.query(`UPDATE maintenance_report_templates SET is_default = false`);
    }
    const [row] = await db.insert(maintenanceReportTemplatesTable).values({
      name: name.trim(),
      reportType: reportType || "visit_report",
      fileUrl: fileUrl || null,
      bodyJson: bodyJson || null,
      isDefault: !!isDefault,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في رفع القالب" });
  }
});

router.delete("/report-templates/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    await db.delete(maintenanceReportTemplatesTable).where(eq(maintenanceReportTemplatesTable.id, id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "فشل في حذف القالب" });
  }
});

/* ══════════════════════════════════════
   VISIT REPORT GENERATION (docxtemplater)
══════════════════════════════════════ */
router.post("/work-orders/:id/visit-report", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const templateId = req.query.templateId ? Number(req.query.templateId) : null;

    const { rows: woRows } = await pool.query(
      `SELECT ${WO_COLUMNS}, eq.name AS "equipmentName", eq.asset_number AS "assetNumber",
              eq.serial_number AS "serialNumber", eq.model, eq.category AS "equipmentCategory", eq.location AS "equipmentLocation",
              u.full_name AS "technicianName", a.full_name AS "approvedByName",
              p.name AS "projectName", c.contract_number AS "contractNumber"
       FROM maintenance_work_orders wo
       LEFT JOIN maintenance_equipment eq ON eq.id = wo.equipment_id
       LEFT JOIN users u ON u.id = wo.assigned_technician_id
       LEFT JOIN users a ON a.id = wo.approved_by_user_id
       LEFT JOIN projects p ON p.id = wo.project_id
       LEFT JOIN contracts c ON c.id = wo.contract_id
       WHERE wo.id = $1`,
      [id]
    );
    if (!woRows.length) return res.status(404).json({ error: "أمر الصيانة غير موجود" });
    const wo = woRows[0];

    const { rows: partRows } = await pool.query(
      `SELECT part_name AS "partName", quantity, unit_price AS "unitPrice" FROM maintenance_work_order_parts WHERE work_order_id = $1`,
      [id]
    );
    const { rows: costRows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM finance_expenses WHERE maintenance_work_order_id = $1`,
      [id]
    );

    const template = templateId
      ? (await db.select().from(maintenanceReportTemplatesTable).where(eq(maintenanceReportTemplatesTable.id, templateId)))[0]
      : (await db.select().from(maintenanceReportTemplatesTable).where(eq(maintenanceReportTemplatesTable.isDefault, true)))[0];
    if (!template) return res.status(400).json({ error: "لا يوجد قالب تقرير محدد. الرجاء رفع أو تصميم قالب من صفحة إدارة القوالب أولاً." });

    const partsText = partRows.length
      ? partRows.map((p: any) => `${p.partName} × ${p.quantity}`).join(", ")
      : "لا يوجد";

    const tokenValues = {
      ReportNumber: wo.orderNumber,
      Date: new Date().toLocaleDateString("ar-EG"),
      EquipmentName: wo.equipmentName || "",
      AssetNumber: wo.assetNumber || "",
      SerialNumber: wo.serialNumber || "",
      Model: wo.model || "",
      Location: wo.location || wo.equipmentLocation || "",
      Customer: wo.projectName || wo.contractNumber || "",
      Technician: wo.technicianName || "",
      Supervisor: wo.approvedByName || "",
      MaintenanceType: wo.maintenanceType,
      WorkDetails: wo.cause || wo.reportReason || "",
      Recommendations: wo.notes || "",
      PartsUsed: partsText,
      TotalCost: Number(costRows[0]?.total || 0).toFixed(3),
    };

    let outBuffer: Buffer;

    if (template.bodyJson) {
      // Template composed in-site — substitution happens while walking the
      // Tiptap JSON tree (each token is one atomic node, so it can never be
      // split across formatting runs); no docxtemplater needed for this path.
      outBuffer = await buildTemplateDocx(template.bodyJson, tokenValues);
    } else {
      const buffer = await objectStorageService.readPrivateObject(template.fileUrl!);

      const zip = new PizZip(buffer);
      // docxtemplater's default delimiters are single braces {tag}; our tokens are documented
      // and shown to users as {{Tag}} (matching the mail-merge convention from the spec), so
      // the double-brace delimiters must be set explicitly or every tag reads as "duplicate".
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: "{{", end: "}}" } });
      doc.render(tokenValues);
      outBuffer = doc.getZip().generate({ type: "nodebuffer" });
    }

    const reportNumber = await generateReportNumber();
    const fileUrl = await objectStorageService.savePrivateObject(
      outBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      `${reportNumber}.docx`
    );
    await pool.query(
      `INSERT INTO maintenance_generated_reports
         (report_number, work_order_id, template_id, equipment_name, equipment_category, equipment_location,
          contract_id, contract_number, work_order_number, file_url, generated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        reportNumber, id, template.id,
        wo.equipmentName || "—", wo.equipmentCategory || null, wo.location || wo.equipmentLocation || null,
        wo.contractId || null, wo.contractNumber || null, wo.orderNumber,
        fileUrl, req.session.userId || null,
      ]
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${reportNumber}.docx"`);
    return res.send(outBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في توليد تقرير الزيارة" });
  }
});

/* ══════════════════════════════════════
   REPORTS LOG (سجل التقارير الصادرة)
══════════════════════════════════════ */
router.get("/reports", async (req: Request, res: Response) => {
  try {
    const { search, contractId, equipmentType, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    const conditions: string[] = [];
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(r.report_number ILIKE $${params.length} OR r.equipment_name ILIKE $${params.length} OR r.work_order_number ILIKE $${params.length} OR r.contract_number ILIKE $${params.length})`);
    }
    if (contractId) { params.push(Number(contractId)); conditions.push(`r.contract_id = $${params.length}`); }
    if (equipmentType) { params.push(equipmentType); conditions.push(`r.equipment_category = $${params.length}`); }
    if (dateFrom) { params.push(dateFrom); conditions.push(`r.generated_at >= $${params.length}`); }
    if (dateTo) { params.push(dateTo); conditions.push(`r.generated_at <= $${params.length}::date + interval '1 day'`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT r.id, r.report_number AS "reportNumber", r.work_order_id AS "workOrderId",
              r.equipment_name AS "equipmentName", r.equipment_category AS "equipmentCategory",
              r.equipment_location AS "equipmentLocation", r.contract_id AS "contractId",
              r.contract_number AS "contractNumber", r.work_order_number AS "workOrderNumber",
              r.file_url AS "fileUrl", r.generated_at AS "generatedAt",
              u.full_name AS "generatedByName"
       FROM maintenance_generated_reports r
       LEFT JOIN users u ON u.id = r.generated_by_user_id
       ${where}
       ORDER BY r.generated_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في جلب سجل التقارير" });
  }
});

router.get("/reports/:id/download", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "معرّف غير صالح" });
  try {
    const { rows } = await pool.query(
      `SELECT report_number AS "reportNumber", file_url AS "fileUrl" FROM maintenance_generated_reports WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "التقرير غير موجود" });
    const buffer = await objectStorageService.readPrivateObject(rows[0].fileUrl);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].reportNumber}.docx"`);
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "فشل في تنزيل التقرير" });
  }
});

export default router;
