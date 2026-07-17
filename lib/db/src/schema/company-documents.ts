import { pgTable, serial, text, date, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull().unique(),
  notes:     text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCompanySchema = insertCompanySchema.partial();

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type UpdateCompany = z.infer<typeof updateCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;

export const companyDocumentsTable = pgTable("company_documents", {
  id:                  serial("id").primaryKey(),
  companyId:           integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  name:                text("name").notNull(),
  documentNumber:      text("document_number"),
  issuingBody:         text("issuing_body"),
  issueDate:           date("issue_date"),
  expiryDate:          date("expiry_date"),
  fileUrl:             text("file_url"),
  notes:               text("notes"),
  responsibleEmployee: text("responsible_employee"),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanyDocumentSchema = createInsertSchema(companyDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCompanyDocumentSchema = insertCompanyDocumentSchema.partial();

export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;
export type CompanyDocument = typeof companyDocumentsTable.$inferSelect;
