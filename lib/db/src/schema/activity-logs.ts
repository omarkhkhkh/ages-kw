import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  // action: login | logout | create | update | delete | export
  action: text("action").notNull(),
  // module: tenders | entities | suppliers | projects | guarantees | contracts | rfq | po | users | auth
  module: text("module"),
  resourceId: integer("resource_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
