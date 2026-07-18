import { computeItemRow, computeSheetSummary, getTotalQuantity, type PricingItemRaw, type PricingSettings } from "./pricing-calc";

function fmt(n: number): string {
  return n.toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Opens a standalone popup window with a printable pricing sheet and triggers
 * the browser print dialog — same PDF-export mechanism used across the app
 * (see print-workers-report.ts / print-letter.ts; no PDF library in the stack).
 */
export function printPricingSheet(sheetNumber: string, title: string | null, items: PricingItemRaw[], settings: PricingSettings) {
  const totalQty = getTotalQuantity(items);
  const summary = computeSheetSummary(items, settings);

  const perItemMode = settings.containerMode === "per_item";
  const rows = items.map((item) => {
    const c = computeItemRow(item, settings, totalQty);
    return `<tr>
      <td>${escapeHtml(c.itemNumber || "—")}</td>
      <td>${escapeHtml(c.itemName)}</td>
      <td>${c.quantity}</td>
      ${perItemMode ? `<td>${Number(item.containers ?? 0)}</td>` : ""}
      <td>${fmt(c.unitCostUsd)}</td>
      <td>${fmt(c.totalUnitCostUsd)}</td>
      <td>${fmt(c.unitCostKwd)}</td>
      <td>${fmt(c.finalUnitCost)}</td>
      <td>${fmt(c.totalItemCostKwd)}</td>
      <td>${fmt(c.sellPriceUnit)}</td>
      <td>${fmt(c.totalSales)}</td>
      <td>${fmt(c.totalProfit)}</td>
      <td>${c.profitPercent.toFixed(1)}%</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>ورقة تسعير — ${escapeHtml(sheetNumber)}</title>
<style>
  @page { size: landscape; margin: 1.2cm; }
  body { font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; color: #1a1a1a; direction: rtl; font-size: 11px; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 14px; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .card { border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; min-width: 130px; }
  .card .label { font-size: 10px; color: #6b7280; margin-bottom: 3px; }
  .card .value { font-size: 13px; font-weight: 700; direction: ltr; text-align: right; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: right; }
  th { background: #f3f4f6; font-weight: 700; font-size: 10px; }
  td { direction: ltr; text-align: right; }
  td:nth-child(2) { direction: rtl; text-align: right; }
</style>
</head>
<body>
  <h1>ورقة تسعير — ${escapeHtml(sheetNumber)}${title ? ` — ${escapeHtml(title)}` : ""}</h1>
  <div class="meta">عدد الأصناف: ${items.length} — تاريخ الطباعة: ${new Date().toLocaleDateString("ar-KW")}</div>
  <div class="summary">
    <div class="card"><div class="label">إجمالي التكلفة</div><div class="value">${fmt(summary.totalCost)}</div></div>
    <div class="card"><div class="label">إجمالي المبيعات</div><div class="value">${fmt(summary.totalSales)}</div></div>
    <div class="card"><div class="label">إجمالي الربح</div><div class="value">${fmt(summary.totalProfit)}</div></div>
    <div class="card"><div class="label">متوسط نسبة الربح</div><div class="value">${summary.avgProfitPercent.toFixed(1)}%</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>رقم البند</th><th>اسم الصنف</th><th>الكمية</th>${perItemMode ? "<th>الحاويات</th>" : ""}<th>تكلفة الوحدة $</th>
        <th>إجمالي تكلفة الوحدة $</th><th>تكلفة الوحدة د.ك</th><th>التكلفة النهائية للوحدة</th>
        <th>إجمالي التكلفة</th><th>سعر البيع</th><th>إجمالي المبيعات</th><th>إجمالي الربح</th><th>نسبة الربح</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1200,height=1100");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}
