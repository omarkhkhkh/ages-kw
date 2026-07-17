import { pgTable, serial, text, numeric, timestamp, date, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { suppliersTable } from "./suppliers";
import { projectsTable } from "./projects";
import { contractsTable } from "./contracts";
import { governmentEntitiesTable } from "./government-entities";
import { departmentsTable, governmentContactsTable } from "./entity-directory";

/* ── سجل المعدات ── */
export const maintenanceEquipmentTable = pgTable("maintenance_equipment", {
  id: serial("id").primaryKey(),
  assetNumber: text("asset_number").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  yearOfManufacture: integer("year_of_manufacture"),
  purchaseDate: date("purchase_date"),
  purchaseValue: numeric("purchase_value", { precision: 15, scale: 3 }),
  usefulLifeYears: integer("useful_life_years"),
  warrantyExpiry: date("warranty_expiry"),
  location: text("location"),
  department: text("department"),
  branch: text("branch"),
  responsibleUserId: integer("responsible_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("operational"),
  // operational | needs_maintenance | stopped | out_of_service | under_repair
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── أوامر الصيانة ── */
export const maintenanceWorkOrdersTable = pgTable("maintenance_work_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  equipmentId: integer("equipment_id").notNull().references(() => maintenanceEquipmentTable.id),
  maintenanceType: text("maintenance_type").notNull().default("corrective"),
  // preventive | corrective | emergency | periodic
  reportReason: text("report_reason"),
  priority: text("priority").notNull().default("medium"), // low | medium | high | critical
  reportDate: timestamp("report_date").notNull().defaultNow(),
  location: text("location"),
  stage: text("stage").notNull().default("reported"),
  // reported | manager_approval | technician_assigned | in_progress | parts_requested | completed | manager_review | closed
  assignedTechnicianId: integer("assigned_technician_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedByUserId: integer("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  billedAmount: numeric("billed_amount", { precision: 15, scale: 3 }), // قيمة الفاتورة/الإيراد المرتبط (فقط لأوامر الصيانة المدفوعة من عميل)
  governmentEntityId: integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }), // الجهة الحكومية (للزيارة)
  departmentId: integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }), // الاختصاص
  contactId: integer("contact_id").references(() => governmentContactsTable.id, { onDelete: "set null" }), // المسؤول
  cause: text("cause"),
  downtimeMinutes: integer("downtime_minutes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  beforePhotoUrl: text("before_photo_url"),
  afterPhotoUrl: text("after_photo_url"),
  attachmentUrl: text("attachment_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── سجل مراحل أمر الصيانة ── */
export const maintenanceStageHistoryTable = pgTable("maintenance_stage_history", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().references(() => maintenanceWorkOrdersTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  changedByUserId: integer("changed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
});

/* ── مستودع قطع الغيار ── */
export const maintenanceInventoryTable = pgTable("maintenance_inventory", {
  id: serial("id").primaryKey(),
  partNumber: text("part_number").notNull().unique(),
  partName: text("part_name").notNull(),
  category: text("category"),
  unit: text("unit"),
  quantityOnHand: numeric("quantity_on_hand", { precision: 12, scale: 3 }).notNull().default("0"),
  reorderLevel: numeric("reorder_level", { precision: 12, scale: 3 }),
  unitCost: numeric("unit_cost", { precision: 15, scale: 3 }),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── طلبات قطع غيار لأمر صيانة ── */
export const maintenanceWorkOrderPartsTable = pgTable("maintenance_work_order_parts", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().references(() => maintenanceWorkOrdersTable.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id").references(() => maintenanceInventoryTable.id, { onDelete: "set null" }),
  partName: text("part_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 3 }),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  requestDate: date("request_date"),
  receivedDate: date("received_date"),
  status: text("status").notNull().default("requested"), // requested | ordered | received | issued
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── خطط الصيانة الوقائية ── */
export const maintenancePreventivePlansTable = pgTable("maintenance_preventive_plans", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull().references(() => maintenanceEquipmentTable.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull(),
  frequencyType: text("frequency_type").notNull().default("monthly"),
  // daily | weekly | monthly | quarterly | semi_annual | annual | meter_based
  intervalValue: integer("interval_value").notNull().default(1),
  meterIntervalValue: numeric("meter_interval_value", { precision: 12, scale: 2 }),
  checklistItems: text("checklist_items"), // JSON-stringified string[]
  active: boolean("active").notNull().default(true),
  nextDueDate: date("next_due_date"),
  lastGeneratedDate: date("last_generated_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── ميزانية الصيانة ── */
export const maintenanceBudgetsTable = pgTable("maintenance_budgets", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  amount: numeric("amount", { precision: 15, scale: 3 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uqYearMonth: unique("uq_maintenance_budget_year_month").on(t.year, t.month),
}));

/* ── قوالب تقارير الصيانة ── */
export const maintenanceReportTemplatesTable = pgTable("maintenance_report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  reportType: text("report_type").notNull().default("visit_report"),
  fileUrl: text("file_url"), // مسار 1: ملف Word مرفوع — أحد المسارين مطلوب
  bodyJson: text("body_json"), // مسار 2: قالب مُصمَّم داخل الموقع (Tiptap JSON بحقول دمج ذرّية)
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMaintenanceEquipmentSchema = createInsertSchema(maintenanceEquipmentTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMaintenanceEquipmentSchema = insertMaintenanceEquipmentSchema.partial();

export const insertMaintenanceWorkOrderSchema = createInsertSchema(maintenanceWorkOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMaintenanceWorkOrderSchema = insertMaintenanceWorkOrderSchema.partial();

export const insertMaintenanceInventorySchema = createInsertSchema(maintenanceInventoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMaintenanceInventorySchema = insertMaintenanceInventorySchema.partial();

export const insertMaintenanceWorkOrderPartSchema = createInsertSchema(maintenanceWorkOrderPartsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMaintenanceWorkOrderPartSchema = insertMaintenanceWorkOrderPartSchema.partial();

export const insertMaintenancePreventivePlanSchema = createInsertSchema(maintenancePreventivePlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMaintenancePreventivePlanSchema = insertMaintenancePreventivePlanSchema.partial();

export const insertMaintenanceBudgetSchema = createInsertSchema(maintenanceBudgetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMaintenanceBudgetSchema = insertMaintenanceBudgetSchema.partial();

/* ── سجل تقارير الصيانة الصادرة ── */
export const maintenanceGeneratedReportsTable = pgTable("maintenance_generated_reports", {
  id: serial("id").primaryKey(),
  reportNumber: text("report_number").notNull().unique(),
  workOrderId: integer("work_order_id").references(() => maintenanceWorkOrdersTable.id, { onDelete: "set null" }),
  templateId: integer("template_id").references(() => maintenanceReportTemplatesTable.id, { onDelete: "set null" }),
  // لقطة (Snapshot) وقت الإصدار — تبقى صحيحة حتى لو تغيّر/حُذف الجهاز أو العقد لاحقًا
  equipmentName: text("equipment_name").notNull(),
  equipmentCategory: text("equipment_category"),
  equipmentLocation: text("equipment_location"),
  contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  contractNumber: text("contract_number"),
  workOrderNumber: text("work_order_number"),
  fileUrl: text("file_url").notNull(),
  generatedByUserId: integer("generated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const insertMaintenanceReportTemplateSchema = createInsertSchema(maintenanceReportTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertMaintenanceEquipment = z.infer<typeof insertMaintenanceEquipmentSchema>;
export type UpdateMaintenanceEquipment = z.infer<typeof updateMaintenanceEquipmentSchema>;
export type MaintenanceEquipment = typeof maintenanceEquipmentTable.$inferSelect;

export type InsertMaintenanceWorkOrder = z.infer<typeof insertMaintenanceWorkOrderSchema>;
export type UpdateMaintenanceWorkOrder = z.infer<typeof updateMaintenanceWorkOrderSchema>;
export type MaintenanceWorkOrder = typeof maintenanceWorkOrdersTable.$inferSelect;

export type MaintenanceStageHistory = typeof maintenanceStageHistoryTable.$inferSelect;

export type InsertMaintenanceInventory = z.infer<typeof insertMaintenanceInventorySchema>;
export type UpdateMaintenanceInventory = z.infer<typeof updateMaintenanceInventorySchema>;
export type MaintenanceInventory = typeof maintenanceInventoryTable.$inferSelect;

export type InsertMaintenanceWorkOrderPart = z.infer<typeof insertMaintenanceWorkOrderPartSchema>;
export type UpdateMaintenanceWorkOrderPart = z.infer<typeof updateMaintenanceWorkOrderPartSchema>;
export type MaintenanceWorkOrderPart = typeof maintenanceWorkOrderPartsTable.$inferSelect;

export type InsertMaintenancePreventivePlan = z.infer<typeof insertMaintenancePreventivePlanSchema>;
export type UpdateMaintenancePreventivePlan = z.infer<typeof updateMaintenancePreventivePlanSchema>;
export type MaintenancePreventivePlan = typeof maintenancePreventivePlansTable.$inferSelect;

export type InsertMaintenanceBudget = z.infer<typeof insertMaintenanceBudgetSchema>;
export type UpdateMaintenanceBudget = z.infer<typeof updateMaintenanceBudgetSchema>;
export type MaintenanceBudget = typeof maintenanceBudgetsTable.$inferSelect;

export type InsertMaintenanceReportTemplate = z.infer<typeof insertMaintenanceReportTemplateSchema>;
export type MaintenanceReportTemplate = typeof maintenanceReportTemplatesTable.$inferSelect;

export type MaintenanceGeneratedReport = typeof maintenanceGeneratedReportsTable.$inferSelect;
