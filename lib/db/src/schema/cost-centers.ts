import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * مراكز التكلفة/الربح (أقسام الشركة الداخلية) — النواة الموحّدة للنظام المالي.
 * ملاحظة: مختلف تمامًا عن `departments` في entity-directory (تلك إدارات الجهات الحكومية).
 * النوع يحدّد معيار التقييم:
 *   profit      = مركز ربح (له دخل ومصروف) — يُقاس بالدخل > المصروف
 *   cost        = مركز تكلفة (لا دخل مباشر، لكنه ضروري) — يُقاس بمعقولية التكلفة
 *   allocatable = تكلفة مشتركة تُوزّع على الجميع (إيجار/إدارة/كهرباء)
 */
export const costCentersTable = pgTable("cost_centers", {
  id:               serial("id").primaryKey(),
  name:             text("name").notNull().unique(),
  type:             text("type").notNull().default("profit"), // profit | cost | allocatable
  evaluationMetric: text("evaluation_metric"),                // معيار الحكم (نص حر: نسبة/هامش/…)
  isActive:         boolean("is_active").notNull().default(true),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

export const insertCostCenterSchema = createInsertSchema(costCentersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateCostCenterSchema = insertCostCenterSchema.partial();

export type InsertCostCenter = z.infer<typeof insertCostCenterSchema>;
export type UpdateCostCenter = z.infer<typeof updateCostCenterSchema>;
export type CostCenter = typeof costCentersTable.$inferSelect;
