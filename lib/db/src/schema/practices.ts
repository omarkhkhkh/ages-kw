import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const practicesTable = pgTable("practices", {
  id:                   serial("id").primaryKey(),
  practiceNumber:       text("practice_number").notNull(),
  projectName:          text("project_name").notNull(),
  description:          text("description"),
  governmentEntity:     text("government_entity"),
  contractValue:        numeric("contract_value",  { precision: 15, scale: 3 }),
  profitPercentage:     numeric("profit_percentage", { precision: 5, scale: 2 }),
  completionPercentage: numeric("completion_percentage", { precision: 5, scale: 2 }),
  startYear:            text("start_year"),
  endYear:              text("end_year"),
  // status: current | previous | future | targeted | under_submission
  status:               text("status").notNull().default("current"),
  // future-project specific
  expectedValue:        numeric("expected_value", { precision: 15, scale: 3 }),
  finalBondValue:       numeric("final_bond_value", { precision: 15, scale: 3 }),
  notes:                text("notes"),
  // Assigned team member
  responsibleEmployee:  text("responsible_employee"),
  // Attached documents
  fileConditions:       text("file_conditions"),  // الشروط الخاصة
  filePricing:          text("file_pricing"),      // التسعير
  fileSuppliers:        text("file_suppliers"),    // الموردين
  fileOpening:          text("file_opening"),      // فض الظروف
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export const insertPracticeSchema = createInsertSchema(practicesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const updatePracticeSchema = insertPracticeSchema.partial();

export type InsertPractice = z.infer<typeof insertPracticeSchema>;
export type UpdatePractice = z.infer<typeof updatePracticeSchema>;
export type Practice = typeof practicesTable.$inferSelect;
