import { pgTable, serial, text, integer, numeric, date, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/* ── الشركات الكفيلة ── */
export const sponsorCompaniesTable = pgTable("sponsor_companies", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull(),
  notes:     text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── العمال ── */
export const workersTable = pgTable("workers", {
  id:        serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => sponsorCompaniesTable.id, { onDelete: "cascade" }),
  photoUrl:  text("photo_url"),

  fullName:    text("full_name").notNull(),
  nationality: text("nationality"),
  civilId:     text("civil_id"),
  jobTitle:    text("job_title"),
  department:  text("department"),
  assignedModule: text("assigned_module"), // "maintenance" | "transportation" | null
  salary:      numeric("salary", { precision: 12, scale: 3 }),
  hireDate:    date("hire_date"),
  sponsor:     text("sponsor"),
  status:      text("status").notNull().default("active"), // active | inactive | terminated

  residencyNumber:       text("residency_number"),
  residencyExpiry:       date("residency_expiry"),
  passportNumber:        text("passport_number"),
  passportExpiry:        date("passport_expiry"),
  healthInsuranceNumber: text("health_insurance_number"),
  healthInsuranceExpiry: date("health_insurance_expiry"),
  workPermitNumber:      text("work_permit_number"),
  workPermitExpiry:      date("work_permit_expiry"),

  notes:     text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── مستندات العامل (8 سلوتات ثابتة) ── */
export const workerDocumentsTable = pgTable("worker_documents", {
  id:               serial("id").primaryKey(),
  workerId:         integer("worker_id").notNull().references(() => workersTable.id, { onDelete: "cascade" }),
  documentType:     text("document_type").notNull(), // passport_photo | residency_photo | work_permit | civil_id | health_insurance | employment_contract | personal_photo | driving_license
  fileUrl:          text("file_url").notNull(),
  mimeType:         text("mime_type"),
  fileSize:         integer("file_size"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uqWorkerDocType: unique("uq_worker_doc_type").on(t.workerId, t.documentType),
}));

/* ── سجل تجديد العامل ── */
export const workerHistoryTable = pgTable("worker_history", {
  id:              serial("id").primaryKey(),
  workerId:        integer("worker_id").notNull().references(() => workersTable.id, { onDelete: "cascade" }),
  operationType:   text("operation_type").notNull(), // e.g. "تجديد إقامة", "تعديل مهنة"
  oldValue:        text("old_value"),
  newValue:        text("new_value"),
  effectiveDate:   date("effective_date"),
  notes:           text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
});

export const insertSponsorCompanySchema = createInsertSchema(sponsorCompaniesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateSponsorCompanySchema = insertSponsorCompanySchema.partial();
export const insertWorkerSchema = createInsertSchema(workersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateWorkerSchema = insertWorkerSchema.partial();
export const insertWorkerHistorySchema = createInsertSchema(workerHistoryTable).omit({ id: true, createdAt: true });

export type InsertSponsorCompany = z.infer<typeof insertSponsorCompanySchema>;
export type UpdateSponsorCompany = z.infer<typeof updateSponsorCompanySchema>;
export type SponsorCompany = typeof sponsorCompaniesTable.$inferSelect;

export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type UpdateWorker = z.infer<typeof updateWorkerSchema>;
export type Worker = typeof workersTable.$inferSelect;

export type WorkerDocument = typeof workerDocumentsTable.$inferSelect;

export type InsertWorkerHistory = z.infer<typeof insertWorkerHistorySchema>;
export type WorkerHistory = typeof workerHistoryTable.$inferSelect;
