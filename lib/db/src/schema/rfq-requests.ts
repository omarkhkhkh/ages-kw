import { pgTable, serial, text, numeric, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";
import { contractsTable } from "./contracts";
import { suppliersTable } from "./suppliers";
import { companiesTable } from "./company-documents";

export const rfqRequestsTable = pgTable("rfq_requests", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").references(() => tendersTable.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }), // العقد المرتبط (بدل المناقصة)
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }), // الشركة المشاركة
  rfqNumber: text("rfq_number"),
  itemDescription: text("item_description").notNull(),
  requestDate: date("request_date"),
  responseDeadline: date("response_deadline"),
  quotedPrice: numeric("quoted_price", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("pending"), // pending, received, rejected
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRfqRequestSchema = createInsertSchema(rfqRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRfqRequestSchema = insertRfqRequestSchema.partial();

export type InsertRfqRequest = z.infer<typeof insertRfqRequestSchema>;
export type UpdateRfqRequest = z.infer<typeof updateRfqRequestSchema>;
export type RfqRequest = typeof rfqRequestsTable.$inferSelect;
