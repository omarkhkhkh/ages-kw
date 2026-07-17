import { pgTable, serial, text, numeric, timestamp, integer, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";
import { practicesTable } from "./practices";
import { directPurchaseOrdersTable } from "./direct-purchase-orders";
import { suppliersTable } from "./suppliers";
import { contractsTable } from "./contracts";
import { usersTable } from "./users";

export const pricingSheetsTable = pgTable("pricing_sheets", {
  id: serial("id").primaryKey(),
  sheetNumber: text("sheet_number").notNull(),
  title: text("title"),
  status: text("status").notNull().default("draft"), // draft | approved
  version: integer("version").notNull().default(1),
  parentSheetId: integer("parent_sheet_id").references((): any => pricingSheetsTable.id, { onDelete: "set null" }),
  // روابط اختيارية
  tenderId: integer("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  practiceId: integer("practice_id").references(() => practicesTable.id, { onDelete: "set null" }),
  purchaseOrderId: integer("purchase_order_id").references(() => directPurchaseOrdersTable.id, { onDelete: "set null" }),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  // إعدادات عامة
  containerShippingCost: numeric("container_shipping_cost", { precision: 15, scale: 3 }).notNull().default("0"),
  containerCount: integer("container_count").notNull().default(1),
  unloadingCost: numeric("unloading_cost", { precision: 15, scale: 3 }).notNull().default("0"),
  clearanceCost: numeric("clearance_cost", { precision: 15, scale: 3 }).notNull().default("0"),
  maintenanceCost: numeric("maintenance_cost", { precision: 15, scale: 3 }).notNull().default("0"),
  bankFees: numeric("bank_fees", { precision: 15, scale: 3 }).notNull().default("0"),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 4 }).notNull().default("0.3070"),
  customsPercent: numeric("customs_percent", { precision: 5, scale: 2 }).notNull().default("5"),
  minProfitPercent: numeric("min_profit_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  goodProfitPercent: numeric("good_profit_percent", { precision: 5, scale: 2 }).notNull().default("20"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedByUserId: integer("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pricingItemsTable = pgTable("pricing_items", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id").notNull().references(() => pricingSheetsTable.id, { onDelete: "cascade" }),
  itemNumber: text("item_number"),
  itemName: text("item_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  unitCostUsd: numeric("unit_cost_usd", { precision: 15, scale: 4 }).notNull().default("0"),
  sellPriceUnit: numeric("sell_price_unit", { precision: 15, scale: 4 }).notNull().default("0"),
  sortOrder: smallint("sort_order").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPricingSheetSchema = createInsertSchema(pricingSheetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedByUserId: true,
  approvedAt: true,
});
export const updatePricingSheetSchema = insertPricingSheetSchema.partial();

export const insertPricingItemSchema = createInsertSchema(pricingItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePricingItemSchema = insertPricingItemSchema.partial();

export type InsertPricingSheet = z.infer<typeof insertPricingSheetSchema>;
export type UpdatePricingSheet = z.infer<typeof updatePricingSheetSchema>;
export type PricingSheet = typeof pricingSheetsTable.$inferSelect;

export type InsertPricingItem = z.infer<typeof insertPricingItemSchema>;
export type UpdatePricingItem = z.infer<typeof updatePricingItemSchema>;
export type PricingItem = typeof pricingItemsTable.$inferSelect;
