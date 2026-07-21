import { pgTable, serial, text, numeric, timestamp, date, integer, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";
import { governmentEntitiesTable } from "./government-entities";
import { contractsTable } from "./contracts";
import { projectsTable } from "./projects";
import { tendersTable } from "./tenders";
import { practicesTable } from "./practices";
import { usersTable } from "./users";
import { companiesTable } from "./company-documents";
import { departmentsTable, governmentContactsTable } from "./entity-directory";

export const directPurchaseOrdersTable = pgTable("direct_purchase_orders", {
  id: serial("id").primaryKey(),
  assignedUserId: integer("assigned_user_id"), // الموظف المسؤول (يُسنده المدير) — يقود الخصوصية
  orderNumber: text("order_number").notNull(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }), // الشركة المشاركة
  governmentEntityId: integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }),
  departmentId: integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }), // الاختصاص
  contactId: integer("contact_id").references(() => governmentContactsTable.id, { onDelete: "set null" }), // المسؤول
  contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  tenderId: integer("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  practiceId: integer("practice_id").references(() => practicesTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }),
  orderDate: date("order_date"),
  deliveryDate: date("delivery_date"),
  status: text("status").notNull().default("new"), // new, in_progress, delivered, completed
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  followUpManagerId: integer("follow_up_manager_id").references(() => usersTable.id, { onDelete: "set null" }),
  executionStage: text("execution_stage").notNull().default("supplier_approval"),
  // supplier_approval | po_issued | materials_received | materials_inspected | delivered_to_entity | closed
  poFileUrl: text("po_file_url"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }), // منشئ السجل — لخصوصية العرض
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── بنود أمر الشراء ── */
export const poItemsTable = pgTable("po_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => directPurchaseOrdersTable.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 12, scale: 3 }),
  unit: text("unit"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 3 }),
  executionStatus: text("execution_status").notNull().default("pending"), // pending | in_progress | done
  sortOrder: smallint("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── فريق عمل الطلب ── */
export const poTeamMembersTable = pgTable("po_team_members", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => directPurchaseOrdersTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

/* ── سجل مراحل التنفيذ ── */
export const poStageHistoryTable = pgTable("po_stage_history", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => directPurchaseOrdersTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  changedByUserId: integer("changed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertDirectPurchaseOrderSchema = createInsertSchema(directPurchaseOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDirectPurchaseOrderSchema = insertDirectPurchaseOrderSchema.partial();

export const insertPoItemSchema = createInsertSchema(poItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updatePoItemSchema = insertPoItemSchema.partial();

export type InsertDirectPurchaseOrder = z.infer<typeof insertDirectPurchaseOrderSchema>;
export type UpdateDirectPurchaseOrder = z.infer<typeof updateDirectPurchaseOrderSchema>;
export type DirectPurchaseOrder = typeof directPurchaseOrdersTable.$inferSelect;

export type InsertPoItem = z.infer<typeof insertPoItemSchema>;
export type UpdatePoItem = z.infer<typeof updatePoItemSchema>;
export type PoItem = typeof poItemsTable.$inferSelect;

export type PoTeamMember = typeof poTeamMembersTable.$inferSelect;
export type PoStageHistory = typeof poStageHistoryTable.$inferSelect;
