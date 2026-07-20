export interface PricingSettings {
  /** تكلفة شحن الحاوية الواحدة بالدولار ($) */
  containerShippingCost: string | number;
  /** عدد الحاويات الكلي — يُستخدم في نظام "حاويات مشتركة" فقط */
  containerCount: number;
  unloadingCost: string | number;
  /** تكلفة تخليص الحاوية الواحدة بالدولار ($) — مثل الشحن تمامًا */
  clearanceCost: string | number;
  maintenanceCost: string | number;
  bankFees: string | number;
  exchangeRate: string | number;
  customsPercent: string | number;
  minProfitPercent: string | number;
  goodProfitPercent: string | number;
  /** نظام الحاويات: shared = كل البنود تتقاسم عدد حاويات واحد،
   *  per_item = كل بند له عدد حاوياته الخاص (كما في جدول المرجع) */
  containerMode?: string | null;
  /** وضع التسعير: import = استيراد كامل | simple = مبسّط محلي (سعر المنتج + نقل + ربح) */
  pricingMode?: string | null;
  /** تكلفة النقل الإجمالية (د.ك) — للوضع المبسّط، توزَّع على الكميات */
  transportCost?: string | number | null;
  /** نسبة الربح % — للوضع المبسّط، تحدد سعر البيع المقترح */
  simpleProfitPercent?: string | number | null;
}

export interface PricingItemRaw {
  id?: number;
  itemNumber?: string | null;
  itemName: string;
  quantity: string | number;
  unitCostUsd: string | number;
  sellPriceUnit: string | number;
  /** عدد حاويات هذا البند — يُستخدم في نظام "لكل بند حاوياته" */
  containers?: string | number | null;
  notes?: string | null;
}

export interface ComputedPricingItem {
  itemNumber: string;
  itemName: string;
  quantity: number;
  unitCostUsd: number;
  /** سعر البيع المقترح للوحدة (الوضع المبسّط): التكلفة النهائية × (1 + الربح%) */
  suggestedSellUnit: number;
  shippingPerUnitUsd: number;
  clearancePerUnitUsd: number;
  customsValueUsd: number;
  totalUnitCostUsd: number;
  totalItemCostUsd: number;
  unitCostKwd: number;
  serviceCostPerUnitKwd: number;
  unloadingCostPerUnitKwd: number;
  bankFeesPerUnitKwd: number;
  finalUnitCost: number;
  totalItemCostKwd: number;
  sellPriceUnit: number;
  totalSales: number;
  totalProfit: number;
  profitPercent: number;
}

export type ProfitTier = "excellent" | "medium" | "low";

function n(v: string | number | null | undefined): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

export function getTotalQuantity(items: PricingItemRaw[]): number {
  return items.reduce((sum, it) => sum + n(it.quantity), 0);
}

export function computeItemRow(item: PricingItemRaw, settings: PricingSettings, totalQty: number): ComputedPricingItem {
  const quantity = n(item.quantity);
  const unitCostUsd = n(item.unitCostUsd);
  const sellPriceUnit = n(item.sellPriceUnit);
  const exchangeRate = n(settings.exchangeRate);
  const customsPercent = n(settings.customsPercent);

  /* ── الوضع المبسّط (شراء محلي): سعر المنتج (د.ك) + نصيب النقل + الربح ──
     لا شحن ولا جمرك ولا تخليص — الحقل "unitCostUsd" يُقرأ هنا كسعر المنتج بالدينار */
  if (settings.pricingMode === "simple") {
    const productPriceKwd = unitCostUsd; // نفس العمود — بالدينار في هذا الوضع
    const transportPerUnitKwd = totalQty > 0 ? n(settings.transportCost) / totalQty : 0;
    const finalUnitCost = productPriceKwd + transportPerUnitKwd;
    const suggestedSellUnit = finalUnitCost * (1 + n(settings.simpleProfitPercent) / 100);
    const totalItemCostKwd = finalUnitCost * quantity;
    const totalSales = sellPriceUnit * quantity;
    const totalProfit = totalSales - totalItemCostKwd;
    const profitPercent = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
    return {
      itemNumber: item.itemNumber ?? "",
      itemName: item.itemName,
      quantity, unitCostUsd: productPriceKwd, suggestedSellUnit,
      shippingPerUnitUsd: 0, clearancePerUnitUsd: 0, customsValueUsd: 0,
      totalUnitCostUsd: 0, totalItemCostUsd: 0,
      unitCostKwd: productPriceKwd,
      serviceCostPerUnitKwd: 0,
      unloadingCostPerUnitKwd: transportPerUnitKwd, // نصيب النقل يُعرض في خانة التوزيع
      bankFeesPerUnitKwd: 0,
      finalUnitCost, totalItemCostKwd,
      sellPriceUnit, totalSales, totalProfit, profitPercent,
    };
  }

  // الشحن والتخليص كلاهما بالدولار لكل حاوية (بلا أي تحويل ذهاب/إياب):
  // - نظام "لكل بند حاوياته": نصيب الوحدة = سعر الحاوية $ × حاويات البند ÷ كمية البند
  // - نظام "حاويات مشتركة": نصيب الوحدة = سعر الحاوية $ × العدد الكلي ÷ الكمية الكلية
  const shipPerContainerUsd = n(settings.containerShippingCost);
  const clearancePerContainerUsd = n(settings.clearanceCost);
  const perItemMode = settings.containerMode === "per_item";
  const itemContainers = n(item.containers);

  let shippingPerUnitUsd = 0;
  let clearancePerUnitUsd = 0;
  if (perItemMode) {
    shippingPerUnitUsd = quantity > 0 ? (shipPerContainerUsd * itemContainers) / quantity : 0;
    clearancePerUnitUsd = quantity > 0 ? (clearancePerContainerUsd * itemContainers) / quantity : 0;
  } else {
    shippingPerUnitUsd = totalQty > 0 ? (shipPerContainerUsd * n(settings.containerCount)) / totalQty : 0;
    clearancePerUnitUsd = totalQty > 0 ? (clearancePerContainerUsd * n(settings.containerCount)) / totalQty : 0;
  }

  const customsValueUsd = unitCostUsd * (customsPercent / 100);

  const totalUnitCostUsd = unitCostUsd + shippingPerUnitUsd + clearancePerUnitUsd + customsValueUsd;
  const totalItemCostUsd = totalUnitCostUsd * quantity;

  const unitCostKwd = totalUnitCostUsd * exchangeRate;

  const serviceCostPerUnitKwd = totalQty > 0 ? n(settings.maintenanceCost) / totalQty : 0;
  const unloadingCostPerUnitKwd = totalQty > 0 ? n(settings.unloadingCost) / totalQty : 0;
  const bankFeesPerUnitKwd = totalQty > 0 ? n(settings.bankFees) / totalQty : 0;

  const finalUnitCost = unitCostKwd + serviceCostPerUnitKwd + unloadingCostPerUnitKwd + bankFeesPerUnitKwd;
  const totalItemCostKwd = finalUnitCost * quantity;

  const totalSales = sellPriceUnit * quantity;
  const totalProfit = totalSales - totalItemCostKwd;
  const profitPercent = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  return {
    itemNumber: item.itemNumber ?? "",
    itemName: item.itemName,
    quantity, unitCostUsd, suggestedSellUnit: 0,
    shippingPerUnitUsd, clearancePerUnitUsd, customsValueUsd,
    totalUnitCostUsd, totalItemCostUsd,
    unitCostKwd, serviceCostPerUnitKwd, unloadingCostPerUnitKwd, bankFeesPerUnitKwd,
    finalUnitCost, totalItemCostKwd,
    sellPriceUnit, totalSales, totalProfit, profitPercent,
  };
}

export interface PricingSheetSummary {
  totalShipping: number;
  totalClearance: number;
  totalCustoms: number;
  totalExpenses: number; // maintenance + unloading + bank fees pools
  totalCost: number;
  totalSales: number;
  totalProfit: number;
  avgProfitPercent: number;
  /** عدد الحاويات الفعلي (المشترك أو مجموع حاويات البنود) */
  totalContainers: number;
}

/** عدد الحاويات الفعلي حسب النظام المختار */
export function getTotalContainers(items: PricingItemRaw[], settings: PricingSettings): number {
  return settings.containerMode === "per_item"
    ? items.reduce((s, it) => s + n(it.containers), 0)
    : n(settings.containerCount);
}

export function computeSheetSummary(items: PricingItemRaw[], settings: PricingSettings): PricingSheetSummary {
  const totalQty = getTotalQuantity(items);
  const rows = items.map((it) => computeItemRow(it, settings, totalQty));

  const totalContainers = getTotalContainers(items, settings);
  const exchangeRate = n(settings.exchangeRate);
  const simple = settings.pricingMode === "simple";
  // الإجماليات بالدينار: الشحن والتخليص كلاهما بالدولار × عدد الحاويات × سعر الصرف
  // (الوضع المبسّط: لا شحن ولا تخليص — النقل فقط)
  const totalShipping = simple ? 0 : n(settings.containerShippingCost) * totalContainers * exchangeRate;
  const totalClearance = simple ? 0 : n(settings.clearanceCost) * totalContainers * exchangeRate;
  const totalCustoms = rows.reduce((s, r) => s + r.customsValueUsd * r.quantity, 0);
  const totalExpenses = simple
    ? n(settings.transportCost)
    : n(settings.maintenanceCost) + n(settings.unloadingCost) + n(settings.bankFees);
  const totalCost = rows.reduce((s, r) => s + r.totalItemCostKwd, 0);
  const totalSales = rows.reduce((s, r) => s + r.totalSales, 0);
  const totalProfit = totalSales - totalCost;
  const avgProfitPercent = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  return { totalShipping, totalClearance, totalCustoms, totalExpenses, totalCost, totalSales, totalProfit, avgProfitPercent, totalContainers };
}

export function getProfitTier(profitPercent: number, settings: PricingSettings): ProfitTier {
  const min = n(settings.minProfitPercent);
  const good = n(settings.goodProfitPercent);
  if (profitPercent < min) return "low";
  if (profitPercent >= good) return "excellent";
  return "medium";
}

export const PROFIT_TIER_ICON: Record<ProfitTier, string> = {
  excellent: "🟢",
  medium: "🟡",
  low: "🔴",
};

export const PROFIT_TIER_LABEL: Record<ProfitTier, string> = {
  excellent: "ربح ممتاز",
  medium: "ربح متوسط",
  low: "ربح منخفض",
};
