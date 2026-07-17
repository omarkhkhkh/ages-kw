export interface PricingSettings {
  containerShippingCost: string | number;
  containerCount: number;
  unloadingCost: string | number;
  clearanceCost: string | number;
  maintenanceCost: string | number;
  bankFees: string | number;
  exchangeRate: string | number;
  customsPercent: string | number;
  minProfitPercent: string | number;
  goodProfitPercent: string | number;
}

export interface PricingItemRaw {
  id?: number;
  itemNumber?: string | null;
  itemName: string;
  quantity: string | number;
  unitCostUsd: string | number;
  sellPriceUnit: string | number;
  notes?: string | null;
}

export interface ComputedPricingItem {
  itemNumber: string;
  itemName: string;
  quantity: number;
  unitCostUsd: number;
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

  const totalShippingPoolKwd = n(settings.containerShippingCost) * n(settings.containerCount);
  const shippingPerUnitKwd = totalQty > 0 ? totalShippingPoolKwd / totalQty : 0;
  const shippingPerUnitUsd = exchangeRate > 0 ? shippingPerUnitKwd / exchangeRate : 0;

  const clearancePerUnitKwd = totalQty > 0 ? n(settings.clearanceCost) / totalQty : 0;
  const clearancePerUnitUsd = exchangeRate > 0 ? clearancePerUnitKwd / exchangeRate : 0;

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
    quantity, unitCostUsd,
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
}

export function computeSheetSummary(items: PricingItemRaw[], settings: PricingSettings): PricingSheetSummary {
  const totalQty = getTotalQuantity(items);
  const rows = items.map((it) => computeItemRow(it, settings, totalQty));

  const totalShipping = n(settings.containerShippingCost) * n(settings.containerCount);
  const totalClearance = n(settings.clearanceCost);
  const totalCustoms = rows.reduce((s, r) => s + r.customsValueUsd * r.quantity, 0);
  const totalExpenses = n(settings.maintenanceCost) + n(settings.unloadingCost) + n(settings.bankFees);
  const totalCost = rows.reduce((s, r) => s + r.totalItemCostKwd, 0);
  const totalSales = rows.reduce((s, r) => s + r.totalSales, 0);
  const totalProfit = totalSales - totalCost;
  const avgProfitPercent = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  return { totalShipping, totalClearance, totalCustoms, totalExpenses, totalCost, totalSales, totalProfit, avgProfitPercent };
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
