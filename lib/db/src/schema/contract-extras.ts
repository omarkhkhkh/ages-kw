import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { contractsTable } from "./contracts";
import { usersTable } from "./users";

/* جدولان كانا مستخدمَين في مسارات العقود (مستندات العقد كـbase64 + تعليقات
   المدير/الموظف) لكنهما لم يكونا معرّفَين في الـschema، فلم يُنشآ في قواعد
   Docker/الإنتاج — ما كان يكسر تبويبَي المستندات والتعليقات في تفاصيل العقد. */

export const contractDocumentsTable = pgTable("contract_documents", {
  id:         serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contractsTable.id, { onDelete: "cascade" }),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
  fileName:   text("file_name").notNull(),
  fileSize:   integer("file_size"),
  mimeType:   text("mime_type"),
  fileData:   text("file_data").notNull(), // base64
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const contractCommentsTable = pgTable("contract_comments", {
  id:         serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contractsTable.id, { onDelete: "cascade" }),
  fromUserId: integer("from_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  toUserId:   integer("to_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  content:    text("content").notNull(),
  isRead:     boolean("is_read").notNull().default(false),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});
