import { pgTable, serial, text, numeric, boolean, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { governmentEntitiesTable } from "./government-entities";

export const tendersTable = pgTable("tenders", {
  id: serial("id").primaryKey(),
  tenderNumber: text("tender_number").notNull(),
  // Legacy text field kept for backward compat; prefer governmentEntityId going forward
  governmentEntity: text("government_entity"),
  governmentEntityId: integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }),
  projectName: text("project_name").notNull(),
  tenderType: text("tender_type"),
  referenceNumber: text("reference_number"),
  competitionType: text("competition_type"), // عامة، محدودة، مباشرة
  announcementDate: date("announcement_date"),
  deadline: date("deadline"),
  executionDuration: integer("execution_duration"), // بالأيام
  bondValue: numeric("bond_value", { precision: 15, scale: 2 }),
  docsValue: numeric("docs_value", { precision: 15, scale: 2 }),
  // Section 2: Responsibilities
  responsibleEngineer: text("responsible_engineer"),
  tenderManager: text("tender_manager"),
  procurementOfficer: text("procurement_officer"),
  financialOfficer: text("financial_officer"),
  transportOfficer: text("transport_officer"),
  approvalManager: text("approval_manager"),
  // Section 3: Status
  status: text("status").notNull().default("new"),
  // Section 4: Financial
  estimatedCost: numeric("estimated_cost", { precision: 15, scale: 2 }),
  offerValue: numeric("offer_value", { precision: 15, scale: 2 }),
  expectedProfit: numeric("expected_profit", { precision: 15, scale: 2 }),
  profitPercentage: numeric("profit_percentage", { precision: 5, scale: 2 }),
  // Section 5: Award
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  awardDate: date("award_date"),
  executionStartDate: date("execution_start_date"),
  executionEndDate: date("execution_end_date"),
  // Misc
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
