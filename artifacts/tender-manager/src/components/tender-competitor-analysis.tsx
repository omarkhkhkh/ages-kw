/**
 * TenderCompetitorAnalysis — تحليل المناقصة مقابل المناقصات المشابهة
 * يظهر في تبويبة "تحليل المنافسة" داخل صفحة تفاصيل المناقصة
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, TrendingUp, Trophy, Info } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

async function apiFetch(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ── colour palette for competitor lines ── */
const LINE_COLORS = ["#3b82f6", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899", "#14b8a6"];

/* ── Diff cell color ── */
function diffStyle(pct: number | null) {
  if (pct === null) return { color: "#9ca3af" };
  if (pct < -1)  return { color: "#16a34a", fontWeight: 800 };   // أرخص منّا ← خطر
  if (pct < 1)   return { color: "#d97706", fontWeight: 700 };   // منافسة شديدة
  return { color: "#dc2626", fontWeight: 600 };                   // أغلى منّا
}
function diffEmoji(pct: number | null) {
  if (pct === null) return "—";
  if (pct < -1)  return `${pct.toFixed(1)}% 🟢`;
  if (pct < 1)   return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% 🟡`;
  return `+${pct.toFixed(1)}% 🔴`;
}

interface Props { tenderId: number }

export default function TenderCompetitorAnalysis({ tenderId }: Props) {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["tender-comparison", tenderId],
    queryFn:  () => apiFetch(`/api/analytics/competitors/tender-comparison/${tenderId}`),
    staleTime: 5 * 60_000,
  });

  const [chartMode, setChartMode] = useState<"absolute" | "diff">("absolute");

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
        <p style={{ marginTop: 8 }}>جاري البحث عن مناقصات مشابهة...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#dc2626" }}>
        <AlertTriangle size={24} style={{ display: "inline-block", marginBottom: 8 }} />
        <p>فشل في تحميل بيانات المقارنة</p>
      </div>
    );
  }

  const { similarTenders, competitorMatrix } = data as {
    similarTenders: any[];
    competitorMatrix: any[];
  };

  if (!similarTenders.length) {
    return (
      <div style={{ padding: 32, textAlign: "center", background: "#fafafa", borderRadius: 12, border: "1.5px dashed #e5e7eb" }}>
        <TrendingUp size={32} style={{ margin: "0 auto 10px", display: "block", color: "#d1d5db" }} />
        <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>لا توجد مناقصات مشابهة لها فضوض مسجَّلة بعد</p>
        <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>سجّل نتائج فضوض مناقصاتك السابقة لتفعيل هذا التحليل تدريجياً</p>
      </div>
    );
  }

  /* ── build chart data ── */
  const sortedSimilar = [...similarTenders].sort((a, b) =>
    (a.opening_date ?? "").localeCompare(b.opening_date ?? "")
  );

  const topCompetitors = competitorMatrix.slice(0, 5);

  const chartData = sortedSimilar.map(s => {
    const ourEntry = s.entries.find((e: any) => e.is_us);
    const ourPrice = ourEntry ? Number(ourEntry.total_price) : null;
    const point: any = {
      name: s.opening_date ? new Date(s.opening_date).toLocaleDateString("ar-KW", { month: "short", year: "2-digit" }) : "—",
      label: s.tender_name ?? s.practice_name,
      ourPrice,
    };
    for (const c of topCompetitors) {
      const entry = s.entries.find((e: any) => e.competitor_id === c.competitor_id && !e.is_us);
      const price = entry ? Number(entry.total_price) : null;
      if (chartMode === "diff" && ourPrice && price) {
        point[`c_${c.competitor_id}`] = Math.round((price / ourPrice - 1) * 1000) / 10;
      } else {
        point[`c_${c.competitor_id}`] = price;
      }
    }
    if (chartMode === "diff") point.ourPrice = 0;
    return point;
  });

  /* ── alerts ── */
  const alerts: string[] = [];
  for (const c of competitorMatrix.slice(0, 3)) {
    if (c.wins_over_us >= 2 && c.avg_diff_pct !== null && Math.abs(c.avg_diff_pct) < 3) {
      alerts.push(`⚠ ${c.company_name} خطرة — فازت علينا ${c.wins_over_us} مرات بفارق متوسط ${c.avg_diff_pct?.toFixed(1)}%`);
    }
    if (c.wins_over_us === 0 && c.appearances >= 2) {
      alerts.push(`✓ ${c.company_name} لم تفز علينا أبداً في هذا النوع (${c.appearances} جلسات)`);
    }
  }
  // Gap stat
  const tooClose = similarTenders.filter(s => {
    const entries = s.entries.filter((e: any) => !e.is_us);
    const usE = s.entries.find((e: any) => e.is_us);
    if (!usE) return false;
    return entries.some((e: any) => Math.abs(Number(e.total_price) / Number(usE.total_price) - 1) < 0.02);
  }).length;
  if (tooClose > 0) {
    alerts.push(`ℹ في ${tooClose} من ${similarTenders.length} جلسة مشابهة، كان أحد المنافسين في نطاق ±2% من سعرنا`);
  }

  const S = {
    th: { padding: "8px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", textAlign: "right", background: "#f9fafb", borderBottom: "1.5px solid #e5e7eb", whiteSpace: "nowrap" } as any,
    td: { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", textAlign: "right" } as any,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} dir="rtl">

      {/* ── Alert cards ── */}
      {alerts.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {alerts.map((a, i) => (
            <p key={i} style={{ margin: 0, fontSize: 13, color: "#92400e" }}>{a}</p>
          ))}
        </div>
      )}

      {/* ── Similar tenders summary ── */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", margin: "0 0 8px" }}>
          وُجدت <strong style={{ color: GR }}>{similarTenders.length}</strong> مناقصة مشابهة لها فضوض مسجَّلة
        </p>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["المناقصة", "تاريخ الفض", "سعرنا", "الفائز"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sortedSimilar.map((s, i) => {
                const usEntry    = s.entries.find((e: any) => e.is_us);
                const winnerEntry = s.entries.find((e: any) => e.is_winner && !e.is_us);
                const weWon      = s.entries.find((e: any) => e.is_winner && e.is_us);
                return (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700, color: GR, maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                           title={s.tender_name ?? s.practice_name}>
                        {s.tender_name ?? s.practice_name}
                      </div>
                    </td>
                    <td style={{ ...S.td, color: "#6b7280", whiteSpace: "nowrap" }}>
                      {s.opening_date ? new Date(s.opening_date).toLocaleDateString("ar-KW") : "—"}
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700 }}>
                      {usEntry ? formatCurrency(usEntry.total_price) : "—"}
                    </td>
                    <td style={S.td}>
                      {weWon
                        ? <span style={{ background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>✓ نحن</span>
                        : winnerEntry
                          ? <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{winnerEntry.company_name}</span>
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Line Chart ── */}
      {chartData.length >= 2 && (
        <div style={{ background: "white", borderRadius: 12, border: "1.5px solid #e5e7eb", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>تطور الأسعار عبر الزمن</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(["absolute", "diff"] as const).map(mode => (
                <button key={mode}
                  onClick={() => setChartMode(mode)}
                  style={{ padding: "4px 12px", borderRadius: 7, border: `1.5px solid ${chartMode === mode ? G : "#e5e7eb"}`, background: chartMode === mode ? "#fffbeb" : "white", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: chartMode === mode ? GD : "#6b7280" }}>
                  {mode === "absolute" ? "القيم (د.ك)" : "الفرق عن سعرنا (%)"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}
                tickFormatter={v => chartMode === "diff" ? `${v}%` : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === "ourPrice") return [chartMode === "diff" ? "0% (مرجع)" : formatCurrency(value), "◀ شركتنا"];
                  const c = topCompetitors.find(x => `c_${x.competitor_id}` === name);
                  const label = c?.company_name ?? name;
                  return [chartMode === "diff" ? `${value}%` : formatCurrency(value), label];
                }}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload;
                  return p?.label ?? label;
                }}
                contentStyle={{ fontSize: 12, fontFamily: "Cairo, sans-serif", direction: "rtl" }}
              />
              <Legend formatter={(value) => {
                if (value === "ourPrice") return "◀ شركتنا";
                const c = topCompetitors.find(x => `c_${x.competitor_id}` === value);
                return c?.company_name ?? value;
              }} wrapperStyle={{ fontSize: 11 }} />
              {chartMode === "diff" && <ReferenceLine y={0} stroke={G} strokeWidth={2} strokeDasharray="4 2" />}
              {/* Our line */}
              <Line dataKey="ourPrice" stroke={G} strokeWidth={3} dot={{ r: 5, fill: G }} connectNulls={false} name="ourPrice" />
              {/* Competitor lines */}
              {topCompetitors.map((c, ci) => (
                <Line key={c.competitor_id} dataKey={`c_${c.competitor_id}`}
                  stroke={LINE_COLORS[ci % LINE_COLORS.length]} strokeWidth={2}
                  dot={{ r: 4 }} connectNulls={false} strokeDasharray={ci > 0 ? "5 3" : undefined}
                  name={`c_${c.competitor_id}`} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>🟢 أرخص منّا (خطر) &nbsp; 🟡 فرق ±1% (منافسة شديدة) &nbsp; 🔴 أغلى منّا</span>
          </div>
        </div>
      )}

      {/* ── Competitor Matrix ── */}
      {competitorMatrix.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 8px" }}>الجدول التحليلي للمنافسين</p>
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1.5px solid #e5e7eb" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth: 150 }}>الشركة</th>
                  {sortedSimilar.map((s, i) => (
                    <th key={i} style={{ ...S.th, minWidth: 110, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 600 }}>{s.tender_name?.substring(0, 20) ?? "—"}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>
                        {s.opening_date ? new Date(s.opening_date).toLocaleDateString("ar-KW", { month: "numeric", year: "2-digit" }) : ""}
                      </div>
                    </th>
                  ))}
                  <th style={{ ...S.th, background: "#f0fdf4", color: "#166534", minWidth: 110 }}>الملخص</th>
                </tr>
              </thead>
              <tbody>
                {/* Our row */}
                <tr style={{ background: "#fffbeb" }}>
                  <td style={{ ...S.td, fontWeight: 800, color: GD }}>◀ شركتنا (مرجع)</td>
                  {sortedSimilar.map((s, i) => {
                    const usE = s.entries.find((e: any) => e.is_us);
                    return (
                      <td key={i} style={{ ...S.td, textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: GD }}>
                        {usE ? formatCurrency(usE.total_price) : "—"}
                        {usE?.is_winner && <span style={{ display: "block", fontSize: 10, color: "#16a34a" }}>✓ فزنا</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...S.td, background: "#fffbeb", textAlign: "center", fontSize: 11, color: "#9ca3af" }}>—</td>
                </tr>

                {/* Competitor rows */}
                {competitorMatrix.map((c, ci) => (
                  <tr key={c.competitor_id}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{c.company_name}</td>
                    {sortedSimilar.map((s, si) => {
                      const perT = c.per_tender.find((p: any) => p.bid_result_id === s.bid_result_id);
                      if (!perT) return <td key={si} style={{ ...S.td, textAlign: "center", color: "#d1d5db" }}>—</td>;
                      return (
                        <td key={si} style={{ ...S.td, textAlign: "center" }}>
                          <div style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>{formatCurrency(perT.total_price)}</div>
                          <div style={{ fontSize: 11, ...diffStyle(perT.diff_pct) }}>{diffEmoji(perT.diff_pct)}</div>
                          {perT.is_winner && <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>✓ فائز</div>}
                        </td>
                      );
                    })}
                    <td style={{ ...S.td, background: "#f9fafb" }}>
                      <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span>ظهر {c.appearances}×</span>
                        {c.wins_over_us > 0 && <span style={{ color: "#dc2626" }}>فاز علينا {c.wins_over_us}×</span>}
                        {c.avg_diff_pct !== null && (
                          <span style={diffStyle(c.avg_diff_pct)}>متوسط: {c.avg_diff_pct >= 0 ? "+" : ""}{c.avg_diff_pct?.toFixed(1)}%</span>
                        )}
                      </div>
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

