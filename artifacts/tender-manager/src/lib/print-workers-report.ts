interface ReportWorker {
  fullName: string;
  nationality: string | null;
  jobTitle: string | null;
  department: string | null;
  residencyNumber: string | null;
  residencyExpiry: string | null;
  passportExpiry: string | null;
  status: string;
}

/**
 * Opens a standalone popup window with a printable worker report table and
 * triggers the browser print dialog — the project's PDF-export mechanism
 * (there's no PDF library in the stack; see print-letter.ts for the same pattern).
 */
export function printWorkersReport(companyName: string, workers: ReportWorker[]) {
  const rows = workers.map((w) => `
    <tr>
      <td>${escapeHtml(w.fullName)}</td>
      <td>${escapeHtml(w.nationality ?? "—")}</td>
      <td>${escapeHtml(w.jobTitle ?? "—")}</td>
      <td>${escapeHtml(w.department ?? "—")}</td>
      <td>${escapeHtml(w.residencyNumber ?? "—")}</td>
      <td>${escapeHtml(w.residencyExpiry ?? "—")}</td>
      <td>${escapeHtml(w.passportExpiry ?? "—")}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>تقرير العمال — ${escapeHtml(companyName)}</title>
<style>
  @page { size: landscape; margin: 1.5cm; }
  body { font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; color: #1a1a1a; direction: rtl; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 18px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: right; }
  th { background: #f3f4f6; font-weight: 700; }
</style>
</head>
<body>
  <h1>تقرير العمال — ${escapeHtml(companyName)}</h1>
  <div class="meta">عدد العمال: ${workers.length} — تاريخ التقرير: ${new Date().toLocaleDateString("ar-KW")}</div>
  <table>
    <thead>
      <tr>
        <th>الاسم</th><th>الجنسية</th><th>المسمى</th><th>القسم</th>
        <th>رقم الإقامة</th><th>انتهاء الإقامة</th><th>انتهاء الجواز</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
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
