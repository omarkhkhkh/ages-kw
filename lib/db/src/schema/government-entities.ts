import { pgTable, serial, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./company-documents";

export const governmentEntitiesTable = pgTable("government_entities", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }), // الشركة المشاركة
  name: text("name").notNull(),
  type: text("type"), // وزارة، هيئة، شركة حكومية، جامعة
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  notes: text("notes"),
  logoUrl: text("logo_url"),
  // Short code used as the prefix for auto-generated correspondence letter numbers (e.g. "MOE")
  codePrefix: text("code_prefix"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uqCompanyCodePrefix: unique("uq_government_entities_company_code_prefix").on(t.companyId, t.codePrefix),
}));

export const insertGovernmentEntitySchema = createInsertSchema(governmentEntitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGovernmentEntitySchema = insertGovernmentEntitySchema.partial();

export type InsertGovernmentEntity = z.infer<typeof insertGovernmentEntitySchema>;
export type UpdateGovernmentEntity = z.infer<typeof updateGovernmentEntitySchema>;
export type GovernmentEntity = typeof governmentEntitiesTable.$inferSelect;
