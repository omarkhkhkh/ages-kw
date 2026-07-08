import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const competitorsTable = pgTable("competitors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  shortName: text("short_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompetitorSchema = createInsertSchema(competitorsTable).omit({ id: true, createdAt: true });
export const updateCompetitorSchema = insertCompetitorSchema.partial();
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type UpdateCompetitor = z.infer<typeof updateCompetitorSchema>;
export type Competitor = typeof competitorsTable.$inferSelect;
