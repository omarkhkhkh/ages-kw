import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { transportTeamsTable } from "./transport-teams";
import { usersTable } from "./users";

export const transportTasksTable = pgTable("transport_tasks", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => transportTeamsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  dueTime: text("due_time"), // HH:MM stored as text
  status: text("status").notNull().default("pending"), // pending | in_progress | done
  notes: text("notes"),
  assignedTo: integer("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TransportTask = typeof transportTasksTable.$inferSelect;
