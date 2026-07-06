import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const tasksTable = pgTable("tasks", {
  id:              serial("id").primaryKey(),
  title:           text("title").notNull(),
  taskType:        text("task_type").notNull(),          // category/type label
  description:     text("description"),
  priority:        text("priority").notNull().default("medium"), // low | medium | high | urgent
  status:          text("status").notNull().default("pending"),  // pending | in_progress | completed | cancelled
  assignedTo:      integer("assigned_to").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdBy:       integer("created_by").notNull().references(() => usersTable.id),
  dueDate:         timestamp("due_date", { mode: "string" }),
  completedAt:     timestamp("completed_at", { mode: "string" }),
  // Employee interaction
  employeeNotes:   text("employee_notes"),
  notesUpdatedAt:  timestamp("notes_updated_at", { mode: "string" }),
  // Admin read receipt for employee notes
  notesReadByAdmin: boolean("notes_read_by_admin").notNull().default(false),
  createdAt:       timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export type Task     = typeof tasksTable.$inferSelect;
export type NewTask  = typeof tasksTable.$inferInsert;
