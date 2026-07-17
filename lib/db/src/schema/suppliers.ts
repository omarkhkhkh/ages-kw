import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./company-documents";
import { usersTable } from "./users";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }), // الشركة المشاركة
  type: text("type"), // مقاول، مورد، استشاري
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  specialization: text("specialization"),
  commercialRegNo: text("commercial_reg_no"),
  notes: text("notes"),
  status: text("status").notNull().default("approved"), // draft | approved — مورد يضيفه موظف غير مدير يبقى "مسودة" حتى اعتماد المدير
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSupplierSchema = insertSupplierSchema.partial();

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
