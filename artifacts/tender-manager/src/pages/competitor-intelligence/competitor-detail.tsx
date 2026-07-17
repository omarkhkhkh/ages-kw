/**
 * /competitor-intelligence/c/:id — تفاصيل شركة منافسة
 */
import { useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Trophy, Building2, Package, FileDown, Printer, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { exportCompetitorReportToExcel } from "@/lib/export";
import { printCompetitorReport } from "@/lib/print-competitor-report";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

async function apiFetch(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function diffStyle(pct: number | null) {
  if (pct === null) return { color: "#9ca3af" };
  if (pct < -1) return { color: "#16a34a", fontWeight: 800 };
  if (pct < 1)  return { color: "#d97706", fontWeight: 700 };
  return { color: "#dc2626" };
}

export default function CompetitorDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["competitor-detail", id],
    queryFn: () => apiFetch(`/api/analytics/competitors/${id}`),
    staleTime: 5 * 60_000,
  });

  // Monthly buckets of the average price difference vs. us — shows whether the
  // competitor is getting more or less aggressive over time.
  const trendData = useMemo(() => {
    const hist: any[] = data?.history ?? [];
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const h of hist) {
      if (h.opening_date == null || h.diff_pct == null) continue;
      const month = String(h.opening_date).slice(0, 7); // YYYY-MM
      const b = buckets.get(month) ?? { sum: 0, count: 0 };
      b.sum += Number(h.diff_pct);
      b.count += 1;
      buckets.set(month, b);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, b]) => ({
        month,
        avgDiff: Math.round((b.sum / b.count) * 10) / 10,
        sessions: b.count,
      }));
  }, [data]);

  const S = {
    card: { background: "white", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" } as any,
    tbl:  { borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" } as any,
    th:   { padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" } as any,
    td:   { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", textAlign: "right" } as any,
  };

  if (isLoading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
    </div>
  );
  if (error || !data) return (
    <div style={{ padding: 24, textAlign: "center", color: "#dc2626" }}>فشل في تحميل البيانات</div>
  );

  const { competitor, history, entityBreakdown, itemBreakdown } = data;
  const wins   = history.filter((h: any) => h.is_winner && !h.is_us_session).length;
  const losses = history.filter((h: any) => !h.is_winner).length;
  const diffs  = history.map((h: any) => Number(h.diff_pct)).filter((v: number) => !isNaN(v));
  const avgDiff = diffs.length ? (diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length).toFixed(1) : null;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => window.history.back()}
          style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ArrowRight size={16} color="#374151" />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0 }}>{competitor.name}</h1>
          {competitor.shortName && <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{competitor.shortName}</p>}
        </div>
        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => exportCompetitorReportToExcel(competitor.name, history, entityBreakdown, itemBreakdown)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "white", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "inherit" }}>
            <FileDown size={13} /> Excel
          </button>
          <button
            onClick={() => printCompetitorReport(competitor.name, {
              totalSessions: history.length,
              theirWins: wins,
              ourWins: history.length - wins,
              avgDiffPct: avgDiff != null ? Number(avgDiff) : null,
            }, history, entityBreakdown, itemBreakdown)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "white", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "inherit" }}>
            <Printer size={13} /> PDF
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 14 }}>
        {[
          { label: "إجمالي الجلسات", value: history.length, color: "#2563eb" },
          { label: "فاز علينا",       value: wins,           color: "#dc2626" },
          { label: "فزنا عليه",       value: history.length - wins, color: "#16a34a" },
          { label: "متوسط الفرق",     value: avgDiff != null ? `${Number(avgDiff) >= 0 ? "+" : ""}${avgDiff}%` : "—", color: Number(avgDiff) < 0 ? "#16a34a" : "#d97706" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Price-behavior trend over time */}
      {history.length >= 3 && trendData.length >= 2 && (
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <TrendingUp size={15} color={G} />
            <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>📈 اتجاه السلوك السعري عبر الزمن</span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 11, color: "#9ca3af" }}>
            متوسط فارق سعره عن سعرنا شهريًا — فوق الصفر: أغلى منّا، تحت الصفر: أرخص منّا (أكثر شراسة)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, fontFamily: "Cairo, sans-serif", direction: "rtl" }}
                formatter={(v: any, _n: any, props: any) => [
                  `${Number(v) >= 0 ? "+" : ""}${v}% (${props.payload.sessions} جلسة)`,
                  "متوسط الفرق",
                ]}
              />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
              <Line dataKey="avgDiff" stroke={G} strokeWidth={3} dot={{ r: 5, fill: G }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History table */}
      <div style={{ background: "white", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={15} color={G} />
          <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>التاريخ الكامل ({history.length} جلسة)</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>
                {["التاريخ","المناقصة / الممارسة","الجهة","سعرهم","سعرنا","الفرق","الترتيب","الفائز"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h: any, i: number) => (
                <tr key={i} style={{ background: h.is_winner ? "#fef2f2" : "white" }}>
                  <td style={{ ...S.td, whiteSpace: "nowrap", color: "#6b7280" }}>
                    {h.opening_date ? new Date(h.opening_date).toLocaleDateString("ar-KW") : "—"}
                  </td>
                  <td style={{ ...S.td, fontWeight: 700, color: GR, maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.tender_name ?? h.practice_name ?? "—"}
                    </div>
                  </td>
                  <td style={{ ...S.td, color: "#6b7280" }}>{h.tender_entity ?? h.practice_entity ?? "—"}</td>
                  <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700 }}>{formatCurrency(h.total_price)}</td>
                  <td style={{ ...S.td, fontFamily: "monospace", color: GD }}>
                    {h.our_price ? formatCurrency(h.our_price) : "—"}
                  </td>
                  <td style={{ ...S.td }}>
                    <span style={diffStyle(h.diff_pct ? Number(h.diff_pct) : null)}>
                      {h.diff_pct != null ? `${Number(h.diff_pct) >= 0 ? "+" : ""}${Number(h.diff_pct).toFixed(1)}%` : "—"}
                    </span>
                  </td>
                  <td style={{ ...S.td, textAlign: "center", fontWeight: 700 }}>#{h.rank ?? "—"}</td>
                  <td style={{ ...S.td }}>
                    {h.is_winner
                      ? <span style={{ background: "#fecaca", color: "#dc2626", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>✓ فائز</span>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entity breakdown */}
      {entityBreakdown.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Building2 size={15} color={G} />
            <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>الأداء حسب الجهة الحكومية</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entityBreakdown.map((e: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "#f9fafb" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: GR }}>{e.entity}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }}>{e.total} جلسة</span>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {e.their_wins > 0 && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 700 }}>فاز {e.their_wins}×</span>}
                  {e.avg_diff_pct != null && (
                    <span style={{ fontSize: 12, ...diffStyle(Number(e.avg_diff_pct)) }}>
                      متوسط: {Number(e.avg_diff_pct) >= 0 ? "+" : ""}{Number(e.avg_diff_pct).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item breakdown */}
      {itemBreakdown.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Package size={15} color={G} />
            <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>مقارنة أسعار البنود</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["البند","ظهر","متوسط سعرهم","متوسط سعرنا","الفرق"].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {itemBreakdown.map((item: any, i: number) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{item.item_name}</td>
                    <td style={{ ...S.td }}>{item.appearances}×</td>
                    <td style={{ ...S.td, fontFamily: "monospace" }}>{formatCurrency(item.avg_their_price)}</td>
                    <td style={{ ...S.td, fontFamily: "monospace", color: GD }}>{item.avg_our_price ? formatCurrency(item.avg_our_price) : "—"}</td>
                    <td style={{ ...S.td }}>
                      <span style={diffStyle(item.avg_diff_pct ? Number(item.avg_diff_pct) : null)}>
                        {item.avg_diff_pct != null ? `${Number(item.avg_diff_pct) >= 0 ? "+" : ""}${Number(item.avg_diff_pct).toFixed(1)}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
