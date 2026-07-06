import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const governmentEntitiesTable = pgTable("government_entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type"), // وزارة، هيئة، شركة حكومية، جامعة
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGovernmentEntitySchema = createInsertSchema(governmentEntitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGovernmentEntitySchema = insertGovernmentEntitySchema.partial();

export type InsertGovernmentEntity = z.infer<typeof insertGovernmentEntitySchema>;
export type UpdateGovernmentEntity = z.infer<typeof updateGovernmentEntitySchema>;
export type GovernmentEntity = typeof governmentEntitiesTable.$inferSelect;
