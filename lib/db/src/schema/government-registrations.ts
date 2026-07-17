import { pgTable, serial, text, date, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./company-documents";

export const governmentRegistrationsTable = pgTable("government_registrations", {
  id:                  serial("id").primaryKey(),
  companyId:           integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  entityName:          text("entity_name").notNull(),
  registrationNumber:  text("registration_number"),
  supplierNumber:      text("supplier_number"),
  fileNumber:          text("file_number"),
  registrationDate:    date("registration_date"),
  expiryDate:          date("expiry_date"),
  // status: active | expiring_soon | expired | pending
  status:              text("status").notNull().default("active"),
  notes:               text("notes"),
  responsibleEmployee: text("responsible_employee"),
  fileUrl:             text("file_url"),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});

export const insertGovernmentRegistrationSchema = createInsertSchema(governmentRegistrationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateGovernmentRegistrationSchema = insertGovernmentRegistrationSchema.partial();

export type InsertGovernmentRegistration = z.infer<typeof insertGovernmentRegistrationSchema>;
export type GovernmentRegistration = typeof governmentRegistrationsTable.$inferSelect;
