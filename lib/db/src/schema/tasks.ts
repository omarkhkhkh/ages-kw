import { pgTable, serial, text, integer, timestamp, boolean, smallint, numeric, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// أنواع المهام المُدارة إداريًا (تشبه serviceTypesTable)
export const taskTypesTable = pgTable("task_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  suggestedSubtasks: jsonb("suggested_subtasks").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskTypeSchema = createInsertSchema(taskTypesTable).omit({ id: true, createdAt: true });
export type InsertTaskType = z.infer<typeof insertTaskTypeSchema>;
export type TaskType = typeof taskTypesTable.$inferSelect;

// قوالب المهام المتكررة
export const recurringTaskTemplatesTable = pgTable("recurring_task_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  taskTypeId: integer("task_type_id").references(() => taskTypesTable.id, { onDelete: "set null" }),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  assignedTo: integer("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  recurrenceRule: text("recurrence_rule").notNull(), // daily | weekly | monthly
  dayOfWeek: smallint("day_of_week"),   // 0-6, for weekly
  dayOfMonth: smallint("day_of_month"), // 1-31, for monthly
  proofType: text("proof_type").notNull().default("none"), // none | file | note — إثبات الإنجاز المطلوب من الموظف قبل الإكمال
  isActive: boolean("is_active").notNull().default(true),
  lastGeneratedAt: timestamp("last_generated_at", { mode: "string" }),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRecurringTaskTemplateSchema = createInsertSchema(recurringTaskTemplatesTable).omit({ id: true, createdAt: true, lastGeneratedAt: true });
export const updateRecurringTaskTemplateSchema = insertRecurringTaskTemplateSchema.partial();
export type InsertRecurringTaskTemplate = z.infer<typeof insertRecurringTaskTemplateSchema>;
export type RecurringTaskTemplate = typeof recurringTaskTemplatesTable.$inferSelect;

export const tasksTable = pgTable("tasks", {
  id:              serial("id").primaryKey(),
  title:           text("title").notNull(),
  taskType:        text("task_type"),                      // legacy free-text label (kept for back-compat, nullable now)
  taskTypeId:      integer("task_type_id").references(() => taskTypesTable.id, { onDelete: "set null" }),
  description:     text("description"),
  priority:        text("priority").notNull().default("medium"), // low | medium | high | urgent | critical
  status:          text("status").notNull().default("pending"),
  // pending | under_review | in_progress | awaiting_reply | awaiting_external | blocked | needs_approval | completed | cancelled
  assignedTo:      integer("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  requestedBy:     integer("requested_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdBy:       integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  // ربط عام بأي وحدة في النظام — بدون قيد FK لتنوع الجداول الهدف
  linkedEntityType: text("linked_entity_type"),
  linkedEntityId:   integer("linked_entity_id"),
  startDate:       timestamp("start_date", { mode: "string" }),
  dueDate:         timestamp("due_date", { mode: "string" }),
  expectedDurationHours: numeric("expected_duration_hours", { precision: 8, scale: 2 }),
  actualTimeHours: numeric("actual_time_hours", { precision: 8, scale: 2 }),
  progressPercent: integer("progress_percent").notNull().default(0),
  budget:          numeric("budget", { precision: 15, scale: 2 }),
  actualCost:      numeric("actual_cost", { precision: 15, scale: 2 }),
  qualityRating:   smallint("quality_rating"), // 1-5، يُحدَّد عند الإغلاق/الاعتماد
  recurringTemplateId: integer("recurring_template_id").references(() => recurringTaskTemplatesTable.id, { onDelete: "set null" }),
  proofType:       text("proof_type").notNull().default("none"), // none | file | note — شرط إثبات الإنجاز قبل الإكمال
  isArchived:      boolean("is_archived").notNull().default(false), // نسخ الأيام السابقة من المهام الدورية تؤرشف عند توليد نسخة اليوم
  // حقول الأتمتة (idempotent dedupe)
  sourceType:      text("source_type"),
  sourceId:        integer("source_id"),
  triggerKey:      text("trigger_key"),
  completedAt:     timestamp("completed_at", { mode: "string" }),
  // Employee interaction
  employeeNotes:   text("employee_notes"),
  notesUpdatedAt:  timestamp("notes_updated_at", { mode: "string" }),
  notesReadByAdmin: boolean("notes_read_by_admin").notNull().default(false),
  createdAt:       timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (t) => ({
  uqTaskSource: unique("uq_tasks_source").on(t.sourceType, t.sourceId, t.triggerKey),
}));

export type Task     = typeof tasksTable.$inferSelect;
export type NewTask  = typeof tasksTable.$inferInsert;

// مساعدون / متعاونون على المهمة (بالإضافة إلى المسؤول الرئيسي)
export const taskCollaboratorsTable = pgTable("task_collaborators", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (t) => ({ uq: unique("uq_task_collaborators").on(t.taskId, t.userId) }));

export const insertTaskCollaboratorSchema = createInsertSchema(taskCollaboratorsTable).omit({ id: true, addedAt: true });
export type InsertTaskCollaborator = z.infer<typeof insertTaskCollaboratorSchema>;
export type TaskCollaborator = typeof taskCollaboratorsTable.$inferSelect;

// مراحل فرعية (checklist) — تحدد اكتمال المهمة الفعلي
export const taskStagesTable = pgTable("task_stages", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  sortOrder: smallint("sort_order").notNull().default(0),
  doneAt: timestamp("done_at", { mode: "string" }),
  doneByUserId: integer("done_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskStageSchema = createInsertSchema(taskStagesTable).omit({ id: true, createdAt: true });
export const updateTaskStageSchema = insertTaskStageSchema.partial();
export type InsertTaskStage = z.infer<typeof insertTaskStageSchema>;
export type TaskStage = typeof taskStagesTable.$inferSelect;

// تعليقات + إشارات @
export const taskCommentsTable = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskCommentSchema = createInsertSchema(taskCommentsTable).omit({ id: true, createdAt: true });
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskCommentsTable.$inferSelect;

export const taskCommentMentionsTable = pgTable("task_comment_mentions", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => taskCommentsTable.id, { onDelete: "cascade" }),
  mentionedUserId: integer("mentioned_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});

export type TaskCommentMention = typeof taskCommentMentionsTable.$inferSelect;

// مرفقات (ملفات/صور/PDF) — بنفس نمط departmentDocumentsTable
export const taskAttachmentsTable = pgTable("task_attachments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskAttachmentSchema = createInsertSchema(taskAttachmentsTable).omit({ id: true, createdAt: true });
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type TaskAttachment = typeof taskAttachmentsTable.$inferSelect;

// سجل نشاط شامل واحد — يغطي الإنشاء/تعديل الحقول/تغيير الحالة/التعليقات/المرفقات/الاعتمادات/التحويل. لا يُحذف أبدًا.
export const taskActivityLogTable = pgTable("task_activity_log", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }), // null = تلقائي (أتمتة)
  changeType: text("change_type").notNull(), // created | field_update | status_change | comment | attachment | approval | assignment
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TaskActivityLog = typeof taskActivityLogTable.$inferSelect;

// بوابات اعتماد مستقلة (غير متسلسلة)
export const taskApprovalsTable = pgTable("task_approvals", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  gate: text("gate").notNull(), // manager | finance | procurement | admin
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  decidedByUserId: integer("decided_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { mode: "string" }),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ uq: unique("uq_task_approvals_gate").on(t.taskId, t.gate) }));

export const insertTaskApprovalSchema = createInsertSchema(taskApprovalsTable).omit({ id: true, createdAt: true, decidedAt: true });
export type InsertTaskApproval = z.infer<typeof insertTaskApprovalSchema>;
export type TaskApproval = typeof taskApprovalsTable.$inferSelect;

// مركز الإشعارات الداخلي
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientUserId: integer("recipient_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  // task_created | assignee_changed | due_soon | overdue | task_completed | task_rejected | comment_added | file_uploaded
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
