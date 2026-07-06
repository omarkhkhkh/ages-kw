import { pgTable, serial, text, numeric, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tendersTable = pgTable("tenders", {
  id: serial("id").primaryKey(),
  tenderNumber: text("tender_number").notNull(),
  governmentEntity: text("government_entity"),
  projectName: text("project_name").notNull(),
  tenderType: text("tender_type"),
  announcementDate: date("announcement_date"),
  deadline: date("deadline"),
  bondValue: numeric("bond_value", { precision: 15, scale: 2 }),
  docsValue: numeric("docs_value", { precision: 15, scale: 2 }),
  responsibleEngineer: text("responsible_engineer"),
  status: text("status").notNull().default("new"),
  offerValue: numeric("offer_value", { precision: 15, scale: 2 }),
  profitPercentage: numeric("profit_percentage", { precision: 5, scale: 2 }),
  isSubmitted: boolean("is_submitted").notNull().default(false),
  winner: text("winner"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenderSchema = createInsertSchema(tendersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTenderSchema = insertTenderSchema.partial();

export type InsertTender = z.infer<typeof insertTenderSchema>;
export type UpdateTender = z.infer<typeof updateTenderSchema>;
export type Tender = typeof tendersTable.$inferSelect;
