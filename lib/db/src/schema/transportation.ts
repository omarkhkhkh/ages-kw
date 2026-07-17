import { pgTable, serial, text, numeric, timestamp, date, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";
import { contractsTable } from "./contracts";

export const transportationTable = pgTable("transportation_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number"),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  origin: text("origin"),
  destination: text("destination"),
  orderDate: date("order_date"),
  deliveryDate: date("delivery_date"),
  value: numeric("value", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("pending"), // pending | in_transit | delivered | cancelled
  vehicleInfo: text("vehicle_info"),
  notes: text("notes"),
  actualDeliveryDate: date("actual_delivery_date"),
  completionNotes: text("completion_notes"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  locationUpdatedAt: timestamp("location_updated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTransportationSchema = createInsertSchema(transportationTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTransportationSchema = insertTransportationSchema.partial();

export type InsertTransportation = z.infer<typeof insertTransportationSchema>;
export type UpdateTransportation = z.infer<typeof updateTransportationSchema>;
export type Transportation = typeof transportationTable.$inferSelect;

export const transportationBudgetsTable = pgTable("transportation_budgets", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  amount: numeric("amount", { precision: 15, scale: 3 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uqYearMonth: unique("uq_transportation_budget_year_month").on(t.year, t.month),
}));

export const insertTransportationBudgetSchema = createInsertSchema(transportationBudgetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTransportationBudgetSchema = insertTransportationBudgetSchema.partial();

export type InsertTransportationBudget = z.infer<typeof insertTransportationBudgetSchema>;
export type UpdateTransportationBudget = z.infer<typeof updateTransportationBudgetSchema>;
export type TransportationBudget = typeof transportationBudgetsTable.$inferSelect;
