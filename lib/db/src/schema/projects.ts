import { pgTable, serial, text, numeric, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";
import { governmentEntitiesTable } from "./government-entities";
import { companiesTable } from "./company-documents";
import { departmentsTable, governmentContactsTable } from "./entity-directory";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  projectNumber: text("project_number"),
  name: text("name").notNull(),
  governmentEntityId: integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }),
  departmentId: integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }), // الاختصاص
  contactId: integer("contact_id").references(() => governmentContactsTable.id, { onDelete: "set null" }), // المسؤول
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }), // الشركة المشاركة
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("active"), // active, completed, suspended
  projectManager: text("project_manager"),
  completionPercentage: numeric("completion_percentage", { precision: 5, scale: 2 }).default("0"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }), // منشئ السجل — لخصوصية العرض
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectSchema = insertProjectSchema.partial();

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
