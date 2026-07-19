import { pgTable, serial, text, numeric, timestamp, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { governmentEntitiesTable } from "./government-entities";
import { departmentsTable, governmentContactsTable } from "./entity-directory";
import { suppliersTable } from "./suppliers";
import { usersTable } from "./users";
import { pricingSheetsTable } from "./pricing";
import { correspondenceLettersTable } from "./correspondence";
import { contractsTable } from "./contracts";

/* ═══════════════════════════════════════════════════════════════
   قسم البحث والتسعير — فرص أوامر الشراء الحكومية
   دورة الحياة: new → researching (بعد الاستلام) → pending_pricing
   → priced → quotation_sent → under_review → won/lost/cancelled/retendered
═══════════════════════════════════════════════════════════════ */

export const OPPORTUNITY_STATUSES = [
  "new", "researching", "pending_pricing", "priced",
  "quotation_sent", "under_review", "won", "lost", "cancelled", "retendered",
] as const;

export const procurementOpportunitiesTable = pgTable("procurement_opportunities", {
  id:                serial("id").primaryKey(),
  orderNumber:       text("order_number").notNull(),           // رقم أمر الشراء
  title:             text("title").notNull(),                   // عنوان الأمر
  governmentEntityId: integer("government_entity_id").references(() => governmentEntitiesTable.id, { onDelete: "set null" }),
  departmentId:      integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }),
  contactId:         integer("contact_id").references(() => governmentContactsTable.id, { onDelete: "set null" }),
  entityType:        text("entity_type"),                       // وزارة/هيئة/جامعة/...
  issueDate:         date("issue_date"),                        // تاريخ الإصدار
  submissionDeadline: date("submission_deadline"),              // آخر موعد للتسليم
  openingDate:       date("opening_date"),                      // تاريخ الفض
  bondValue:         numeric("bond_value", { precision: 15, scale: 3 }), // قيمة الكفالة
  isUrgent:          boolean("is_urgent").notNull().default(false),
  notes:             text("notes"),
  status:            text("status").notNull().default("new"),

  // الاستلام الحصري — تحديث شرطي واحد يمنع الاستلام المزدوج
  claimedByUserId:   integer("claimed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  claimedAt:         timestamp("claimed_at"),

  // طوابع SLA — تُملأ تلقائيًا عند كل انتقال
  discoveredAt:      timestamp("discovered_at").notNull().defaultNow(),
  researchDoneAt:    timestamp("research_done_at"),
  pricedAt:          timestamp("priced_at"),
  quotationSentAt:   timestamp("quotation_sent_at"),
  resultAt:          timestamp("result_at"),

  // الروابط
  pricingSheetId:    integer("pricing_sheet_id").references(() => pricingSheetsTable.id, { onDelete: "set null" }),
  quotationLetterId: integer("quotation_letter_id").references(() => correspondenceLettersTable.id, { onDelete: "set null" }),
  contractId:        integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),

  // نتيجة الترسية
  winnerName:        text("winner_name"),                       // الشركة الفائزة (عند الخسارة)
  winnerPrice:       numeric("winner_price", { precision: 15, scale: 3 }),
  ourPrice:          numeric("our_price", { precision: 15, scale: 3 }),
  lossReason:        text("loss_reason"),                       // price | quality | delivery_time | specs | other
  lossNotes:         text("loss_notes"),

  createdByUserId:   integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
  updatedAt:         timestamp("updated_at").notNull().defaultNow(),
});

/* بنود أمر الشراء */
export const opportunityItemsTable = pgTable("opportunity_items", {
  id:            serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull().references(() => procurementOpportunitiesTable.id, { onDelete: "cascade" }),
  itemName:      text("item_name").notNull(),
  specifications: text("specifications"),
  quantity:      numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
  unit:          text("unit"),                                  // الوحدة (قطعة/كرتون/...)
  notes:         text("notes"),
  sortOrder:     integer("sort_order").notNull().default(0),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

/* عروض الموردين لكل بند — عدد غير محدود */
export const opportunityItemQuotesTable = pgTable("opportunity_item_quotes", {
  id:            serial("id").primaryKey(),
  itemId:        integer("item_id").notNull().references(() => opportunityItemsTable.id, { onDelete: "cascade" }),
  supplierId:    integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  supplierName:  text("supplier_name"),                         // إدخال سريع إن لم يكن من القائمة
  contactPerson: text("contact_person"),
  phone:         text("phone"),
  whatsapp:      text("whatsapp"),
  email:         text("email"),
  price:         numeric("price", { precision: 15, scale: 3 }).notNull().default("0"), // سعر الوحدة د.ك
  deliveryDays:  integer("delivery_days"),                      // مدة التوريد بالأيام
  qualityRating: integer("quality_rating"),                     // 1-5
  warranty:      text("warranty"),
  quoteFileUrl:  text("quote_file_url"),                        // عرض السعر
  catalogFileUrl: text("catalog_file_url"),                     // الكتالوج
  imageFileUrl:  text("image_file_url"),                        // صور
  notes:         text("notes"),
  isChosen:      boolean("is_chosen").notNull().default(false), // المورد المختار للبند
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

/* مرفقات أمر الشراء + النص المستخرج (قابل للتعديل اليدوي) */
export const opportunityFilesTable = pgTable("opportunity_files", {
  id:            serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull().references(() => procurementOpportunitiesTable.id, { onDelete: "cascade" }),
  fileName:      text("file_name").notNull(),
  fileUrl:       text("file_url").notNull(),                    // objectPath في التخزين المحلي
  extractedText: text("extracted_text"),                        // نص PDF المستخرج تلقائيًا
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

/* سجل مراحل الفرصة — تدقيق كامل لكل انتقال */
export const opportunityStageHistoryTable = pgTable("opportunity_stage_history", {
  id:            serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull().references(() => procurementOpportunitiesTable.id, { onDelete: "cascade" }),
  stage:         text("stage").notNull(),
  changedByUserId: integer("changed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  changedAt:     timestamp("changed_at").notNull().defaultNow(),
  note:          text("note"),
});

/* Zod schemas */
export const insertOpportunitySchema = createInsertSchema(procurementOpportunitiesTable).omit({
  id: true, createdAt: true, updatedAt: true, discoveredAt: true,
  claimedByUserId: true, claimedAt: true,
  researchDoneAt: true, pricedAt: true, quotationSentAt: true, resultAt: true,
});
export const updateOpportunitySchema = insertOpportunitySchema.partial();

export const insertOpportunityItemSchema = createInsertSchema(opportunityItemsTable).omit({ id: true, createdAt: true });
export const updateOpportunityItemSchema = insertOpportunityItemSchema.partial().omit({ opportunityId: true });

export const insertOpportunityQuoteSchema = createInsertSchema(opportunityItemQuotesTable).omit({ id: true, createdAt: true, createdByUserId: true });
export const updateOpportunityQuoteSchema = insertOpportunityQuoteSchema.partial().omit({ itemId: true });

export const insertOpportunityFileSchema = createInsertSchema(opportunityFilesTable).omit({ id: true, createdAt: true, uploadedByUserId: true });

export type Opportunity = typeof procurementOpportunitiesTable.$inferSelect;
export type OpportunityItem = typeof opportunityItemsTable.$inferSelect;
export type OpportunityItemQuote = typeof opportunityItemQuotesTable.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
