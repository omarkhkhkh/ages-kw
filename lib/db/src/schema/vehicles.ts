import { pgTable, serial, text, integer, date, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { maintenanceInventoryTable } from "./maintenance";

export const vehiclesTable = pgTable("fleet_vehicles", {
  id: serial("id").primaryKey(),
  plateNumber: text("plate_number").notNull(),
  vehicleType: text("vehicle_type"), // سيارة صغيرة | شاحنة | باص | معدة ثقيلة | أخرى
  makeModel: text("make_model"),
  year: integer("year"),
  color: text("color"),
  ownership: text("ownership").notNull().default("owned"), // owned | rented
  status: text("status").notNull().default("active"), // active | maintenance | out_of_service
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  registrationExpiry: date("registration_expiry"),
  insuranceExpiry: date("insurance_expiry"),
  purchaseDate: date("purchase_date"),
  purchaseValue: numeric("purchase_value", { precision: 15, scale: 3 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVehicleSchema = insertVehicleSchema.partial();

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type UpdateVehicle = z.infer<typeof updateVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;

/* ── سجل تعبئة الوقود ── */
export const vehicleFuelLogsTable = pgTable("vehicle_fuel_logs", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  liters: numeric("liters", { precision: 10, scale: 2 }).notNull(),
  pricePerLiter: numeric("price_per_liter", { precision: 10, scale: 3 }).notNull(),
  totalCost: numeric("total_cost", { precision: 12, scale: 3 }).notNull(),
  odometerReading: integer("odometer_reading"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVehicleFuelLogSchema = createInsertSchema(vehicleFuelLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertVehicleFuelLog = z.infer<typeof insertVehicleFuelLogSchema>;
export type VehicleFuelLog = typeof vehicleFuelLogsTable.$inferSelect;

/* ── سجل سيرفس المركبة ── */
export const vehicleServiceLogsTable = pgTable("vehicle_service_logs", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id, { onDelete: "cascade" }),
  serviceDate: date("service_date").notNull(),
  serviceType: text("service_type").notNull().default("general"), // oil_change | tires | brakes | general | other
  workshopName: text("workshop_name"),
  description: text("description"),
  cost: numeric("cost", { precision: 12, scale: 3 }).notNull(),
  odometerReading: integer("odometer_reading"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVehicleServiceLogSchema = createInsertSchema(vehicleServiceLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertVehicleServiceLog = z.infer<typeof insertVehicleServiceLogSchema>;
export type VehicleServiceLog = typeof vehicleServiceLogsTable.$inferSelect;

/* ── قطع الغيار المستخدمة في السيرفس (مرتبطة بمخزون الصيانة) ── */
export const vehicleServicePartsTable = pgTable("vehicle_service_parts", {
  id: serial("id").primaryKey(),
  serviceLogId: integer("service_log_id").notNull().references(() => vehicleServiceLogsTable.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id").references(() => maintenanceInventoryTable.id, { onDelete: "set null" }),
  partName: text("part_name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 3 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVehicleServicePartSchema = createInsertSchema(vehicleServicePartsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertVehicleServicePart = z.infer<typeof insertVehicleServicePartSchema>;
export type VehicleServicePart = typeof vehicleServicePartsTable.$inferSelect;
