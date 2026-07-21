import { pgTable, serial, text, numeric, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";
import { companiesTable } from "./company-documents";

export const bankGuaranteesTable = pgTable("bank_guarantees", {
  id: serial("id").primaryKey(),
  assignedUserId: integer("assigned_user_id"), // الموظف المسؤول (يُسنده المدير) — يقود الخصوصية
  tenderId: integer("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }), // الشركة المشاركة
  guaranteeNumber: text("guarantee_number"),
  type: text("type"), // ابتدائية، نهائية، دفعة مقدمة
  bankName: text("bank_name"),
  amount: numeric("amount", { precision: 15, scale: 2 }),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  status: text("status").notNull().default("active"), // active, expired, released
  location: text("location"), // مكان وجود الكفالة (البنك / الخزينة / لدى موظف...)
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBankGuaranteeSchema = createInsertSchema(bankGuaranteesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBankGuaranteeSchema = insertBankGuaranteeSchema.partial();

export type InsertBankGuarantee = z.infer<typeof insertBankGuaranteeSchema>;
export type UpdateBankGuarantee = z.infer<typeof updateBankGuaranteeSchema>;
export type BankGuarantee = typeof bankGuaranteesTable.$inferSelect;
