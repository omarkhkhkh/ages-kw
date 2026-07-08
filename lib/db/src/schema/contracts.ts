import { pgTable, serial, text, numeric, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";
import { governmentEntitiesTable } from "./government-entities";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  contractNumber: text("contract_number").notNull(),
  governmentEntityId: integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  signDate: date("sign_date"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("active"), // active, completed, terminated
  notes: text("notes"),
  // Final bond (كفالة نهائية)
  finalBondValue:      numeric("final_bond_value",       { precision: 15, scale: 3 }),
  finalBondNumber:     text("final_bond_number"),     // رقم الكفالة
  finalBondBank:       text("final_bond_bank"),        // البنك المُصدر
  finalBondIssueDate:  date("final_bond_issue_date"),  // تاريخ الإصدار
  finalBondExpiryDate: date("final_bond_expiry_date"), // تاريخ الانتهاء
  finalBondStatus:     text("final_bond_status").default("active"), // active | released | confiscated
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateContractSchema = insertContractSchema.partial();

export type InsertContract = z.infer<typeof insertContractSchema>;
export type UpdateContract = z.infer<typeof updateContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
