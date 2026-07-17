import { pgTable, serial, text, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { governmentEntitiesTable } from "./government-entities";
import { usersTable } from "./users";

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  governmentEntityId: integer("government_entity_id").notNull().references(() => governmentEntitiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  specializationType: text("specialization_type"), // نوع التخصص: إدارة مشتريات / إدارة مناقصات / إدارة عقود / ... / أخرى
  branch: text("branch"), // الفرع أو الموقع
  governorate: text("governorate"), // المحافظة
  address: text("address"),
  buildingNumber: text("building_number"),
  floor: text("floor"),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateDepartmentSchema = insertDepartmentSchema.partial();

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;
export type Department = typeof departmentsTable.$inferSelect;

export const governmentContactsTable = pgTable("government_contacts", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"), // تصنيف: مدير / رئيس قسم / موظف / ... / تصنيف مخصص (نص حر)
  section: text("section"), // قسم فرعي داخل الإدارة
  status: text("status").notNull().default("active"), // active | retired | transferred
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGovernmentContactSchema = createInsertSchema(governmentContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateGovernmentContactSchema = insertGovernmentContactSchema.partial();

export type InsertGovernmentContact = z.infer<typeof insertGovernmentContactSchema>;
export type UpdateGovernmentContact = z.infer<typeof updateGovernmentContactSchema>;
export type GovernmentContact = typeof governmentContactsTable.$inferSelect;

export const contactMethodsTable = pgTable("contact_methods", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => governmentContactsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // هاتف المكتب / هاتف مباشر / تحويلة / فاكس / هاتف الطوارئ / جوال شخصي / جوال العمل / واتساب / بريد إلكتروني / Microsoft Teams / أخرى
  value: text("value").notNull(),
  label: text("label"), // ملاحظة اختيارية، مثال: "تحويلة 105"
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContactMethodSchema = createInsertSchema(contactMethodsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateContactMethodSchema = insertContactMethodSchema.partial();

export type InsertContactMethod = z.infer<typeof insertContactMethodSchema>;
export type UpdateContactMethod = z.infer<typeof updateContactMethodSchema>;
export type ContactMethod = typeof contactMethodsTable.$inferSelect;

// قائمة "أنواع التعامل" المركزية القابلة للتعديل من لوحة الإعدادات الإدارية
export const serviceTypesTable = pgTable("service_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServiceTypeSchema = createInsertSchema(serviceTypesTable).omit({ id: true, createdAt: true });
export type InsertServiceType = z.infer<typeof insertServiceTypeSchema>;
export type ServiceType = typeof serviceTypesTable.$inferSelect;

// ربط أنواع التعامل بكل إدارة
export const departmentServiceTypesTable = pgTable("department_service_types", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id, { onDelete: "cascade" }),
  serviceTypeId: integer("service_type_id").notNull().references(() => serviceTypesTable.id, { onDelete: "cascade" }),
}, (t) => ({
  uqDepartmentServiceType: unique("uq_department_service_types_department_service").on(t.departmentId, t.serviceTypeId),
}));

export const insertDepartmentServiceTypeSchema = createInsertSchema(departmentServiceTypesTable).omit({ id: true });
export type InsertDepartmentServiceType = z.infer<typeof insertDepartmentServiceTypeSchema>;
export type DepartmentServiceType = typeof departmentServiceTypesTable.$inferSelect;

// مستندات الإدارة (نماذج كتب، كتب رسمية، عقود، تعليمات، خرائط وصول، مستندات داخلية، تعاميم...)
export const departmentDocumentsTable = pgTable("department_documents", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDepartmentDocumentSchema = createInsertSchema(departmentDocumentsTable).omit({ id: true, createdAt: true });
export type InsertDepartmentDocument = z.infer<typeof insertDepartmentDocumentSchema>;
export type DepartmentDocument = typeof departmentDocumentsTable.$inferSelect;
