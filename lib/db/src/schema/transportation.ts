import { pgTable, serial, text, numeric, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";

export const transportationTable = pgTable("transportation_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number"),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  origin: text("origin"),
  destination: text("destination"),
  orderDate: date("order_date"),
  deliveryDate: date("delivery_date"),
  value: numeric("value", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("pending"), // pending | in_transit | delivered | cancelled
  vehicleInfo: text("vehicle_info"),
  notes: text("notes"),
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
