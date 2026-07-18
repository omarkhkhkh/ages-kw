import { pgTable, serial, text, integer, boolean, date, timestamp, unique, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tendersTable } from "./tenders";
import { practicesTable } from "./practices";
import { contractsTable } from "./contracts";
import { directPurchaseOrdersTable } from "./direct-purchase-orders";
import { suppliersTable } from "./suppliers";
import { governmentEntitiesTable } from "./government-entities";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { departmentsTable, governmentContactsTable } from "./entity-directory";

/* ── قوالب الخطابات ── */
export const correspondenceTemplatesTable = pgTable("correspondence_templates", {
  id:              serial("id").primaryKey(),
  name:            text("name").notNull(),
  // quote_request | inquiry | extension_request | approval | apology | thanks |
  // meeting_invitation | supply_request | purchase_order | financial_claim | custom
  category:        text("category").notNull(),
  bodyJson:        text("body_json").notNull(), // Tiptap JSON with {{placeholder}} tokens, stringified
  isSystem:        boolean("is_system").notNull().default(false),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});

/* ── الخطابات (صادر / وارد) ── */
export const correspondenceLettersTable = pgTable("correspondence_letters", {
  id:                  serial("id").primaryKey(),
  letterNumber:        text("letter_number").notNull().unique(), // server-generated, e.g. "MOE-2026-0001"; suffixed "-VOID" once its number is reclaimed on cancel
  direction:           text("direction").notNull(), // 'outgoing' | 'incoming'
  status:              text("status").notNull().default("draft"), // draft | sent | received | closed | cancelled
  subject:             text("subject").notNull(),
  letterType:          text("letter_type"), // same vocabulary as template.category, plus incoming_general/other
  bodyJson:            text("body_json"), // Tiptap JSON (composed letters); null for scan-only incoming letters
  bodyHtml:            text("body_html"), // cached render, regenerated on every save — used for list preview/search
  letterDate:          date("letter_date").notNull(),
  senderName:          text("sender_name"),     // mainly for incoming letters
  recipientName:       text("recipient_name"),  // mainly for outgoing letters
  attentionLine:        text("attention_line"),  // "عناية" — a specific person/department within the recipient entity
  recipientHonorific:  text("recipient_honorific").notNull().default("المحترمين"), // المحترمين | المحترم — لقب سطر الجهة
  attentionHonorific:  text("attention_honorific").notNull().default("المحترمين"), // لقب سطر العناية
  companyName:         text("company_name"),    // sender company name shown in the signature block (manual, per letter)
  referenceNumber:     text("reference_number"), // the OTHER party's letter/reference number
  inReplyToId:         integer("in_reply_to_id").references((): AnyPgColumn => correspondenceLettersTable.id, { onDelete: "set null" }),
  // Which record this letter is filed under
  sourceType:          text("source_type"), // 'tender'|'practice'|'contract'|'purchase_order'|'supplier'|'project'|'government_entity'|null
  tenderId:            integer("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  practiceId:          integer("practice_id").references(() => practicesTable.id, { onDelete: "set null" }),
  contractId:          integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
  purchaseOrderId:     integer("purchase_order_id").references(() => directPurchaseOrdersTable.id, { onDelete: "set null" }),
  supplierId:          integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  projectId:           integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  // Which government entity the letter is addressed to/from — drives numbering + entity-scoped archive view
  governmentEntityId:  integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }),
  departmentId:        integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }), // الاختصاص
  contactId:           integer("contact_id").references(() => governmentContactsTable.id, { onDelete: "set null" }), // المسؤول
  responsibleEmployee: text("responsible_employee"),
  templateId:          integer("template_id").references(() => correspondenceTemplatesTable.id, { onDelete: "set null" }),
  approvalStatus:      text("approval_status").notNull().default("not_required"), // not_required|pending|approved|rejected
  approvedByUserId:    integer("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt:          timestamp("approved_at"),
  sentAt:              timestamp("sent_at"),
  deadlineDate:        date("deadline_date"), // drives dashboard deadline alerts
  isAnswered:          boolean("is_answered").notNull().default(false),
  cancelledAt:         timestamp("cancelled_at"),
  cancelledByUserId:   integer("cancelled_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  notes:               text("notes"),
  createdByUserId:     integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});

/* ── مرفقات الخطاب ── */
export const correspondenceAttachmentsTable = pgTable("correspondence_attachments", {
  id:               serial("id").primaryKey(),
  letterId:         integer("letter_id").notNull().references(() => correspondenceLettersTable.id, { onDelete: "cascade" }),
  fileName:         text("file_name").notNull(),
  fileUrl:          text("file_url").notNull(), // objectPath from object storage
  mimeType:         text("mime_type"),
  fileSize:         integer("file_size"),
  attachmentType:   text("attachment_type").default("general"), // 'main_copy' | 'general'
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

/* ── تتبّع تسلسل الترقيم لكل جهة / فئة ── */
export const correspondenceSequencesTable = pgTable("correspondence_sequences", {
  id:         serial("id").primaryKey(),
  // 'government_entity' | 'suppliers' | 'contracts' | 'practices' | 'purchase_orders' | 'tenders' | 'general'
  scopeType:  text("scope_type").notNull(),
  scopeId:    integer("scope_id").notNull().default(0), // government_entities.id when scopeType='government_entity', else 0
  prefix:     text("prefix").notNull(),
  year:       integer("year").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uqScope: unique("uq_correspondence_sequences_scope").on(t.scopeType, t.scopeId, t.year),
}));

export const insertCorrespondenceLetterSchema = createInsertSchema(correspondenceLettersTable).omit({
  id: true,
  letterNumber: true,
  approvedByUserId: true,
  approvedAt: true,
  sentAt: true,
  isAnswered: true,
  cancelledAt: true,
  cancelledByUserId: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
});
export const updateCorrespondenceLetterSchema = insertCorrespondenceLetterSchema.partial();

export const insertCorrespondenceAttachmentSchema = createInsertSchema(correspondenceAttachmentsTable).omit({
  id: true,
  uploadedByUserId: true,
  createdAt: true,
});

export const insertCorrespondenceTemplateSchema = createInsertSchema(correspondenceTemplatesTable).omit({
  id: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
});
export const updateCorrespondenceTemplateSchema = insertCorrespondenceTemplateSchema.partial();

export type InsertCorrespondenceLetter = z.infer<typeof insertCorrespondenceLetterSchema>;
export type UpdateCorrespondenceLetter = z.infer<typeof updateCorrespondenceLetterSchema>;
export type CorrespondenceLetter = typeof correspondenceLettersTable.$inferSelect;

export type InsertCorrespondenceAttachment = z.infer<typeof insertCorrespondenceAttachmentSchema>;
export type CorrespondenceAttachment = typeof correspondenceAttachmentsTable.$inferSelect;

export type InsertCorrespondenceTemplate = z.infer<typeof insertCorrespondenceTemplateSchema>;
export type UpdateCorrespondenceTemplate = z.infer<typeof updateCorrespondenceTemplateSchema>;
export type CorrespondenceTemplate = typeof correspondenceTemplatesTable.$inferSelect;

export type CorrespondenceSequence = typeof correspondenceSequencesTable.$inferSelect;
