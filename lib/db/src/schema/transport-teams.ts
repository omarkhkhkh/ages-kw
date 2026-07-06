import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const transportTeamsTable = pgTable("transport_teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#D4A534"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transportTeamMembersTable = pgTable("transport_team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => transportTeamsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export type TransportTeam = typeof transportTeamsTable.$inferSelect;
export type TransportTeamMember = typeof transportTeamMembersTable.$inferSelect;
