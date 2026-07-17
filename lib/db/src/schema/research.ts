import { pgTable, serial, text, smallint, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { suppliersTable } from "./suppliers";
import { tendersTable } from "./tenders";
import { practicesTable } from "./practices";

/* ── تقييمات الموردين/المصانع ── */
export const supplierEvaluationsTable = pgTable("supplier_evaluations", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
  qualityScore: smallint("quality_score").notNull(), // 1-5
  priceScore: smallint("price_score").notNull(), // 1-5
  commitmentScore: smallint("commitment_score").notNull(), // 1-5
  notes: text("notes"),
  evaluatedByUserId: integer("evaluated_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  evaluatedAt: timestamp("evaluated_at").notNull().defaultNow(),
});

/* ── مركز المعرفة المؤسسية (دروس مستفادة) ── */
export const knowledgeEntriesTable = pgTable("knowledge_entries", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  practiceId: integer("practice_id").references(() => practicesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  outcome: text("outcome").notNull().default("other"), // won | lost | ongoing | other
  reasons: text("reasons"),
  lessonsLearned: text("lessons_learned"),
  competitorNames: text("competitor_names"),
  tags: text("tags"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── شات الفريق (قناة واحدة مشتركة) ── */
export const teamMessagesTable = pgTable("team_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ── مركز المواصفات (ملفات مواصفات مرتبطة بصنف + مناقصة/ممارسة/طلب عرض سعر) ── */
export const researchSpecsTable = pgTable("research_specs", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  fileUrl: text("file_url"),
  linkedEntityType: text("linked_entity_type"), // tender | practice | rfq
  linkedEntityId: integer("linked_entity_id"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── تكليفات البحث والتطوير (توجيه مهمة/مواصفة من المدير لموظف) ── */
export const researchAssignmentsTable = pgTable("research_assignments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToUserId: integer("assigned_to_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  assignedByUserId: integer("assigned_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  linkedEntityType: text("linked_entity_type"), // tender | practice
  linkedEntityId: integer("linked_entity_id"),
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupplierEvaluationSchema = createInsertSchema(supplierEvaluationsTable).omit({ id: true, evaluatedAt: true });
export const insertKnowledgeEntrySchema = createInsertSchema(knowledgeEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateKnowledgeEntrySchema = insertKnowledgeEntrySchema.partial();
export const insertTeamMessageSchema = createInsertSchema(teamMessagesTable).omit({ id: true, createdAt: true });
export const insertResearchSpecSchema = createInsertSchema(researchSpecsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateResearchSpecSchema = insertResearchSpecSchema.partial();
export const insertResearchAssignmentSchema = createInsertSchema(researchAssignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateResearchAssignmentSchema = insertResearchAssignmentSchema.partial();

export type InsertSupplierEvaluation = z.infer<typeof insertSupplierEvaluationSchema>;
export type SupplierEvaluation = typeof supplierEvaluationsTable.$inferSelect;

export type InsertKnowledgeEntry = z.infer<typeof insertKnowledgeEntrySchema>;
export type UpdateKnowledgeEntry = z.infer<typeof updateKnowledgeEntrySchema>;
export type KnowledgeEntry = typeof knowledgeEntriesTable.$inferSelect;

export type InsertTeamMessage = z.infer<typeof insertTeamMessageSchema>;
export type TeamMessage = typeof teamMessagesTable.$inferSelect;

export type InsertResearchSpec = z.infer<typeof insertResearchSpecSchema>;
export type UpdateResearchSpec = z.infer<typeof updateResearchSpecSchema>;
export type ResearchSpec = typeof researchSpecsTable.$inferSelect;

export type InsertResearchAssignment = z.infer<typeof insertResearchAssignmentSchema>;
export type UpdateResearchAssignment = z.infer<typeof updateResearchAssignmentSchema>;
export type ResearchAssignment = typeof researchAssignmentsTable.$inferSelect;
