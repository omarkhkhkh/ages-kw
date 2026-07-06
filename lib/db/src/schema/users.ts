import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  password: text("password").notNull(), // bcrypt hashed
  role: text("role").notNull().default("employee"), // 'admin' | 'employee'
  // Granular permissions
  canView: boolean("can_view").notNull().default(true),
  canDownload: boolean("can_download").notNull().default(false),
  canUpload: boolean("can_upload").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
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
