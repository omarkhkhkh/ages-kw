import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companyDocumentsTable = pgTable("company_documents", {
  id:                  serial("id").primaryKey(),
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
