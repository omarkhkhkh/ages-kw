interface CompetitorStats {
  totalSessions: number;
  theirWins: number;
  ourWins: number;
  avgDiffPct: number | null;
}

/**
 * Opens a standalone popup window with a printable single-competitor report
 * (summary line + history / entity / item tables) and triggers the browser
 * print dialog — the project's PDF-export mechanism (there's no PDF library
 * in the stack; see print-workers-report.ts for the same pattern).
 */
export function printCompetitorReport(
  competitorName: string,
  stats: CompetitorStats,
  history: any[],
  entityBreakdown: any[],
  itemBreakdown: any[]
) {
  const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const pct = (v: any) => (v === null || v === undefined ? "—" : `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%`);

  const historyRows = history.map((h) => `
    <tr${h.is_winner ? ' class="won"' : ""}>
      <td>${escapeHtml(fmt(h.opening_date))}</td>
      <td>${escapeHtml(fmt(h.tender_name || h.practice_name))}</td>
      <td>${escapeHtml(fmt(h.tender_entity || h.practice_entity))}</td>
      <td class="num">${escapeHtml(fmt(h.total_price))}</td>
      <td class="num">${escapeHtml(fmt(h.our_price))}</td>
      <td class="num">${escapeHtml(pct(h.diff_pct))}</td>
      <td class="num">${escapeHtml(fmt(h.rank))}</td>
      <td>${h.is_winner ? "✓ فائز" : "—"}</td>
    </tr>`).join("");

  const entityRows = entityBreakdown.map((e) => `
    <tr>
      <td>${escapeHtml(fmt(e.entity))}</td>
      <td class="num">${escapeHtml(fmt(e.total))}</td>
      <td class="num">${escapeHtml(fmt(e.their_wins))}</td>
      <td class="num">${escapeHtml(pct(e.avg_diff_pct))}</td>
    </tr>`).join("");

  const itemRows = itemBreakdown.map((it) => `
    <tr>
      <td>${escapeHtml(fmt(it.item_name))}</td>
      <td class="num">${escapeHtml(fmt(it.appearances))}</td>
      <td class="num">${escapeHtml(fmt(it.avg_their_price))}</td>
      <td class="num">${escapeHtml(fmt(it.avg_our_price))}</td>
      <td class="num">${escapeHtml(pct(it.avg_diff_pct))}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>تقرير منافس — ${escapeHtml(competitorName)}</title>
<style>
  @page { size: landscape; margin: 1.5cm; }
  body { font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; color: #1a1a1a; direction: rtl; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 22px 0 8px; border-bottom: 2px solid #D4A534; padding-bottom: 4px; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 6px; }
  .summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 14px; font-size: 12px; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 5px 9px; text-align: right; }
  th { background: #f3f4f6; font-weight: 700; }
  td.num { font-family: monospace; direction: ltr; text-align: left; }
  tr.won td { background: #fef2f2; }
  .empty { color: #9ca3af; font-size: 11px; padding: 8px 0; }
</style>
</head>
<body>
  <h1>تقرير منافس — ${escapeHtml(competitorName)}</h1>
  <div class="meta">تاريخ التقرير: ${new Date().toLocaleDateString("ar-KW")}</div>
  <div class="summary">
    إجمالي المواجهات: <strong>${stats.totalSessions}</strong>
    &nbsp;·&nbsp; مرات فوزه: <strong>${stats.theirWins}</strong>
    &nbsp;·&nbsp; مرات فوزنا عليه: <strong>${stats.ourWins}</strong>
    &nbsp;·&nbsp; متوسط فارق السعر عنّا: <strong>${escapeHtml(pct(stats.avgDiffPct))}</strong>
  </div>

  <h2>سجل المواجهات (${history.length})</h2>
  ${history.length ? `<table>
    <thead><tr>
      <th>التاريخ</th><th>المناقصة/الممارسة</th><th>الجهة</th>
      <th>سعرهم</th><th>سعرنا</th><th>الفرق</th><th>الترتيب</th><th>النتيجة</th>
    </tr></thead>
    <tbody>${historyRows}</tbody>
  </table>` : `<div class="empty">لا توجد مواجهات مسجّلة</div>`}

  <h2>الأداء حسب الجهة الحكومية (${entityBreakdown.length})</h2>
  ${entityBreakdown.length ? `<table>
    <thead><tr>
      <th>الجهة</th><th>الجلسات</th><th>مرات فوزه</th><th>متوسط الفرق</th>
    </tr></thead>
    <tbody>${entityRows}</tbody>
  </table>` : `<div class="empty">لا بيانات</div>`}

  <h2>مقارنة أسعار البنود (${itemBreakdown.length})</h2>
  ${itemBreakdown.length ? `<table>
    <thead><tr>
      <th>البند</th><th>مرات التسعير</th><th>متوسط سعرهم</th><th>متوسط سعرنا</th><th>الفرق</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>` : `<div class="empty">لا بيانات بنود</div>`}
</body>
</html>`;

  const win = window.open("", "_blank", "width=1000,height=1100");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
