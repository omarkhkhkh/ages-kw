import * as XLSX from "xlsx";
import { exportToExcel } from "./export";
import { computeItemRow, getTotalQuantity, type PricingItemRaw, type PricingSettings } from "./pricing-calc";

const IMPORT_HEADER_MAP: Record<string, keyof PricingItemRaw> = {
  "رقم البند": "itemNumber",
  "اسم الصنف": "itemName",
  "الكمية": "quantity",
  "الحاويات": "containers",
  "تكلفة الوحدة بالدولار": "unitCostUsd",
  "سعر البيع للوحدة": "sellPriceUnit",
};

/**
 * Reads an uploaded .xlsx file and maps its columns (by Arabic header) to the
 * five raw item input fields — everything else is derived, not imported.
 */
export function importPricingItemsFromExcel(file: File): Promise<Partial<PricingItemRaw>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
        const items: Partial<PricingItemRaw>[] = rows
          .map((row) => {
            const item: Partial<PricingItemRaw> = {};
            for (const [header, field] of Object.entries(IMPORT_HEADER_MAP)) {
              if (row[header] !== undefined && row[header] !== "") (item as any)[field] = row[header];
            }
            return item;
          })
          .filter((item) => item.itemName);
        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("فشل في قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports the full 19-column computed pricing table to Excel.
 */
export function exportPricingSheetToExcel(sheetNumber: string, items: PricingItemRaw[], settings: PricingSettings) {
  const totalQty = getTotalQuantity(items);
  const rows = items.map((item) => {
    const c = computeItemRow(item, settings, totalQty);
    return {
      itemNumber: c.itemNumber,
      itemName: c.itemName,
      quantity: c.quantity,
      containers: Number(item.containers ?? 0),
      unitCostUsd: c.unitCostUsd,
      shippingPerUnitUsd: c.shippingPerUnitUsd,
      clearancePerUnitUsd: c.clearancePerUnitUsd,
      customsValueUsd: c.customsValueUsd,
      totalUnitCostUsd: c.totalUnitCostUsd,
      totalItemCostUsd: c.totalItemCostUsd,
      unitCostKwd: c.unitCostKwd,
      serviceCostPerUnitKwd: c.serviceCostPerUnitKwd,
      unloadingCostPerUnitKwd: c.unloadingCostPerUnitKwd,
      bankFeesPerUnitKwd: c.bankFeesPerUnitKwd,
      finalUnitCost: c.finalUnitCost,
      totalItemCostKwd: c.totalItemCostKwd,
      sellPriceUnit: c.sellPriceUnit,
      totalSales: c.totalSales,
      totalProfit: c.totalProfit,
      profitPercent: c.profitPercent.toFixed(2),
    };
  });

  exportToExcel(
    rows,
    [
      { header: "رقم البند", key: "itemNumber" },
      { header: "اسم الصنف", key: "itemName" },
      { header: "الكمية", key: "quantity" },
      { header: "الحاويات", key: "containers" },
      { header: "تكلفة الوحدة بالدولار", key: "unitCostUsd" },
      { header: "تكلفة الشحن للوحدة", key: "shippingPerUnitUsd" },
      { header: "تكلفة التخليص للوحدة", key: "clearancePerUnitUsd" },
      { header: "قيمة الجمرك", key: "customsValueUsd" },
      { header: "إجمالي تكلفة الوحدة بالدولار", key: "totalUnitCostUsd" },
      { header: "إجمالي تكلفة الصنف بالدولار", key: "totalItemCostUsd" },
      { header: "تكلفة الوحدة بالدينار الكويتي", key: "unitCostKwd" },
      { header: "توزيع مصاريف الخدمات", key: "serviceCostPerUnitKwd" },
      { header: "توزيع مصاريف التنزيل", key: "unloadingCostPerUnitKwd" },
      { header: "توزيع المصاريف البنكية", key: "bankFeesPerUnitKwd" },
      { header: "التكلفة النهائية للوحدة", key: "finalUnitCost" },
      { header: "إجمالي التكلفة", key: "totalItemCostKwd" },
      { header: "سعر البيع للوحدة", key: "sellPriceUnit" },
      { header: "إجمالي المبيعات", key: "totalSales" },
      { header: "إجمالي الربح", key: "totalProfit" },
      { header: "نسبة الربح %", key: "profitPercent" },
    ],
    `تسعير_${sheetNumber}`
  );
}
