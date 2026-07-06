import { pgTable, serial, text, numeric, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";
import { governmentEntitiesTable } from "./government-entities";

export const directPurchaseOrdersTable = pgTable("direct_purchase_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  governmentEntityId: integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }),
  orderDate: date("order_date"),
  deliveryDate: date("delivery_date"),
  status: text("status").notNull().default("new"), // new, in_progress, delivered, completed
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDirectPurchaseOrderSchema = createInsertSchema(directPurchaseOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDirectPurchaseOrderSchema = insertDirectPurchaseOrderSchema.partial();

export type InsertDirectPurchaseOrder = z.infer<typeof insertDirectPurchaseOrderSchema>;
export type UpdateDirectPurchaseOrder = z.infer<typeof updateDirectPurchaseOrderSchema>;
export type DirectPurchaseOrder = typeof directPurchaseOrdersTable.$inferSelect;
