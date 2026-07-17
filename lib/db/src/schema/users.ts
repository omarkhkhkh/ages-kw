import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  password: text("password").notNull(), // bcrypt hashed
  role: text("role").notNull().default("employee"), // 'admin' | 'employee'
  // Global permissions
  canView: boolean("can_view").notNull().default(true),
  canDownload: boolean("can_download").notNull().default(false),
  canUpload: boolean("can_upload").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  // Per-module access (each module can be hidden per employee)
  accessTenders: boolean("access_tenders").notNull().default(true),
  accessEntities: boolean("access_entities").notNull().default(true),
  accessSuppliers: boolean("access_suppliers").notNull().default(true),
  accessProjects: boolean("access_projects").notNull().default(true),
  accessGuarantees: boolean("access_guarantees").notNull().default(true),
  accessContracts: boolean("access_contracts").notNull().default(true),
  accessRfq: boolean("access_rfq").notNull().default(true),
  accessPo: boolean("access_po").notNull().default(true),
  accessTransportation: boolean("access_transportation").notNull().default(true),
  accessFinance: boolean("access_finance").notNull().default(true),
  accessCorrespondence: boolean("access_correspondence").notNull().default(true),
  accessResidency: boolean("access_residency").notNull().default(true),
  accessMaintenance: boolean("access_maintenance").notNull().default(true),
  accessResearch: boolean("access_research").notNull().default(true),
  accessPricing: boolean("access_pricing").notNull().default(true),
  accessTasks: boolean("access_tasks").notNull().default(true),
  taskViewScope: text("task_view_scope").notNull().default("own"), // 'own' | 'department' | 'all'
  taskCanApprove: boolean("task_can_approve").notNull().default(false),
  // خصوصية المراسلات: الموظف يرى كتبه فقط ما لم يمنحه المدير هذه الصلاحية
  correspondenceViewAll: boolean("correspondence_view_all").notNull().default(false),
  // مصفوفة الصلاحيات الدقيقة: لكل وحدة { view, add, edit, del } — المدير يتجاوزها دائمًا.
  // null = تُشتق تلقائيًا من الأعمدة القديمة (accessX + canEdit) للتوافق الخلفي.
  permissions: jsonb("permissions").$type<Record<string, { view: boolean; add: boolean; edit: boolean; del: boolean }>>(),
  // خصوصية السجلات الرئيسية (مناقصات/ممارسات/عقود/مشاريع/أوامر شراء):
  // 'own' = يرى سجلاته فقط (والسجلات القديمة بلا منشئ)، 'all' = يرى الكل
  recordViewScope: text("record_view_scope").notNull().default("own"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
