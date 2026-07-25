import { pgTable, serial, text, boolean, timestamp, integer, numeric, date, unique } from "drizzle-orm/pg-core";
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

/**
 * جدول الأصول الموحّد — يدمج المعدات (maintenance_equipment) والمركبات (fleet_vehicles)
 * في جدول واحد للتقارير الرأسمالية العابرة للأقسام. مرحلة انتقالية آمنة:
 * الجدولان التشغيليان يبقيان مصدر الحقيقة، وهذا الجدول مرآة موحّدة تُزامَن منهما
 * (legacy_source/legacy_id يربطان كل أصل بمصدره). القطع النهائي في مرحلة التنظيف.
 */
export const assetsTable = pgTable("assets", {
  id:           serial("id").primaryKey(),
  costCenterId: integer("cost_center_id").references(() => costCentersTable.id, { onDelete: "set null" }),
  assetType:    text("asset_type").notNull().default("other"), // equipment | vehicle | other
  name:         text("name").notNull(),
  code:         text("code"),      // رقم الأصل / رقم اللوحة
  category:     text("category"),
  status:       text("status"),
  location:     text("location"),
  branch:       text("branch"),
  purchaseValue: numeric("purchase_value", { precision: 15, scale: 3 }),
  purchaseDate: date("purchase_date"),
  legacySource: text("legacy_source"), // maintenance_equipment | fleet_vehicles | null (يدوي)
  legacyId:     integer("legacy_id"),
  notes:        text("notes"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ uqLegacy: unique("uq_assets_legacy").on(t.legacySource, t.legacyId) }));

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Asset = typeof assetsTable.$inferSelect;

/** جدول الميزانيات الموحّد — يستبدل maintenance_budgets + transportation_budgets */
export const costCenterBudgetsTable = pgTable("cost_center_budgets", {
  id:           serial("id").primaryKey(),
  costCenterId: integer("cost_center_id").notNull().references(() => costCentersTable.id, { onDelete: "cascade" }),
  year:         integer("year").notNull(),
  month:        integer("month").notNull(),
  targetAmount: numeric("target_amount", { precision: 15, scale: 3 }).notNull().default("0"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ uqYm: unique("uq_ccb_ym").on(t.costCenterId, t.year, t.month) }));

export const insertCostCenterBudgetSchema = createInsertSchema(costCenterBudgetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type CostCenterBudget = typeof costCenterBudgetsTable.$inferSelect;

/**
 * قواعد توزيع التكاليف غير المباشرة (الإيجار/الإدارة/الكهرباء…) على مراكز الربح.
 * كل قاعدة تُعطي مركز ربح نسبةً (share_ratio، كسر من ١) من مجمّع التكاليف المشتركة
 * (= مصروفات الأقسام من نوع allocatable). cost_type/driver وصفيّان للشفافية والتدقيق.
 */
export const costAllocationRulesTable = pgTable("cost_allocation_rules", {
  id:           serial("id").primaryKey(),
  costCenterId: integer("cost_center_id").notNull().references(() => costCentersTable.id, { onDelete: "cascade" }),
  costType:     text("cost_type"),                                  // نوع التكلفة (إيجار/كهرباء/إدارة)
  driver:       text("driver"),                                    // قاعدة التوزيع (مساحة/عدد موظفين/أجهزة)
  shareRatio:   numeric("share_ratio", { precision: 6, scale: 4 }).notNull().default("0"), // نسبة القسم (0–1)
  notes:        text("notes"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const insertCostAllocationRuleSchema = createInsertSchema(costAllocationRulesTable).omit({ id: true, createdAt: true });
export type CostAllocationRule = typeof costAllocationRulesTable.$inferSelect;
