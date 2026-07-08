/**
 * /competitor-intelligence — لوحة ذكاء المنافسين
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trophy, TrendingUp, Target, BarChart3, Calendar, Loader2, ChevronLeft } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, Cell,
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

const LINE_COLORS = ["#3b82f6", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4"];

export default function CompetitorIntelligence() {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tenderTypeFilter, setTenderTypeFilter] = useState("");

  const params = new URLSearchParams();
  if (sourceFilter !== "all") params.set("source_type", sourceFilter);
  if (tenderTypeFilter) params.set("tender_type", tenderTypeFilter);
  const paramStr = params.toString();

  const { data: summary = [], isLoading: summaryLoading } = useQuery<any[]>({
    queryKey: ["competitor-summary", paramStr],
    queryFn: () => apiFetch(`/api/analytics/competitors/summary${paramStr ? "?" + paramStr : ""}`),
    staleTime: 5 * 60_000,
  });

  const { data: gapData } = useQuery<any>({
    queryKey: ["competitor-gap"],
    queryFn:  () => apiFetch("/api/analytics/competitors/gap-analysis"),
    staleTime: 10 * 60_000,
  });

  /* ── stat cards ── */
  const totalSessions = summary.reduce((s, c) => s + (c.total_bids ?? 0), 0) / Math.max(summary.length, 1);
  const totalCompetitors = summary.length;
  const ourWinRate = gapData ? null : null; // calculated from sessions

  const S = {
    card: { background: "white", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1.5px solid #f3f4f6" } as any,
    th:   { padding: "10px 14px", fontWeight: 800, fontSize: 11, color: "#6b7280", textAlign: "right", background: "#f9fafb", borderBottom: "1.5px solid #e5e7eb", whiteSpace: "nowrap" } as any,
    td:   { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", textAlign: "right" } as any,
  };

  /* ── gap chart data ── */
  const gapChartData = gapData ? [
    { name: "< 1%",  value: gapData.gap_lt_1pct  ?? 0, fill: "#ef4444" },
    { name: "1–2%",  value: gapData.gap_1_to_2pct ?? 0, fill: "#f97316" },
    { name: "2–5%",  value: gapData.gap_2_to_5pct ?? 0, fill: "#eab308" },
    { name: "> 5%",  value: gapData.gap_gt_5pct   ?? 0, fill: "#22c55e" },
  ] : [];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>مركز ذكاء المنافسين</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>تحليل أداء المنافسين عبر جميع المناقصات والممارسات</p>
        </div>
        <Link href="/competitor-intelligence/predict" style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontFamily: "inherit", textDecoration: "none" }}>
          <Target size={15} /> تنبؤ المنافسين
        </Link>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>فلترة:</span>
        {[["all","الكل"],["tender","مناقصات"],["practice","ممارسات"]].map(([v,l]) => (
          <button key={v} onClick={() => setSourceFilter(v)}
            style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${sourceFilter === v ? G : "#e5e7eb"}`, background: sourceFilter === v ? "#fffbeb" : "white", color: sourceFilter === v ? GD : "#6b7280" }}>
            {l}
          </button>
        ))}
        {["مناقصة عامة","مناقصة محدودة","أمر شراء مباشر"].map(t => (
          <button key={t} onClick={() => setTenderTypeFilter(tenderTypeFilter === t ? "" : t)}
            style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${tenderTypeFilter === t ? "#6366f1" : "#e5e7eb"}`, background: tenderTypeFilter === t ? "#eef2ff" : "white", color: tenderTypeFilter === t ? "#4f46e5" : "#6b7280" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 14 }}>
        {[
          { icon: BarChart3, label: "جلسات مسجَّلة", value: gapData?.total_sessions ?? "—", color: "#2563eb", bg: "#eff6ff" },
          { icon: Trophy,    label: "شركة منافسة",  value: totalCompetitors || "—",         color: G,        bg: "#fffbeb" },
          { icon: TrendingUp,label: "متوسط الفارق 1st-2nd", value: gapData?.avg_gap_pct != null ? `${gapData.avg_gap_pct}%` : "—", color: "#7c3aed", bg: "#f5f3ff" },
          { icon: Calendar,  label: "أقل فارق مسجَّل", value: gapData?.min_gap_pct != null ? `${gapData.min_gap_pct}%` : "—", color: "#dc2626", bg: "#fef2f2" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} style={{ ...S.card, borderTop: `3px solid ${color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon size={16} color={color} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

        {/* ── Gap Distribution Chart ── */}
        {gapChartData.length > 0 && (
          <div style={{ ...S.card }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 14px" }}>توزيع الفارق بين 1st و2nd</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gapChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, fontFamily: "Cairo,sans-serif", direction: "rtl" }}
                  formatter={(v: any) => [`${v} جلسة`]} />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {gapChartData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>
              الفارق الأكبر خطورة هو أقل من 1% — منافسة شديدة جداً
            </div>
          </div>
        )}

        {/* ── Win Rate Summary ── */}
        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: 0 }}>أبرز إحصاءات</p>
          {gapData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "إجمالي الجلسات المحللة", value: gapData.total_sessions, color: "#2563eb" },
                { label: "أصغر فارق مسجَّل (1st-2nd)", value: `${gapData.min_gap_pct}%`, color: "#dc2626" },
                { label: "أكبر فارق مسجَّل", value: `${gapData.max_gap_pct}%`, color: "#16a34a" },
                { label: "جلسات بفارق أقل من 1%", value: gapData.gap_lt_1pct, color: "#7c3aed" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: "#f9fafb" }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color }}>{value ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Competitor Leaderboard ── */}
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={15} color="white" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>ترتيب الشركات المنافسة</span>
          </div>
          {summary.length > 0 && (
            <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>{summary.length} شركة</span>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          {summaryLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
            </div>
          ) : summary.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
              <Trophy size={36} style={{ margin: "0 auto 10px", display: "block", opacity: 0.2 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>لا توجد بيانات بعد</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>ابدأ بتسجيل نتائج فضوض العطاء في المناقصات</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)" }}>
                  {["#","الشركة","الجلسات","فاز علينا","متوسط الفرق","آخر ظهور",""].map(h => (
                    <th key={h} style={{ padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((c: any, i: number) => {
                  const rankColors: Record<number,[string,string,string]> = {
                    0: [G,       "#7c4b00", "#fffbeb"],
                    1: ["#94a3b8","#1e293b", "#f8fafc"],
                    2: ["#cd7c2f","#431407", "#fff7ed"],
                  };
                  const [badgeBg, badgeText, rowAccent] = rankColors[i] ?? ["#e2e8f0","#64748b","white"];
                  const rowBg = i % 2 === 0 ? "white" : "#fafbfc";
                  return (
                    <tr key={c.competitor_id} style={{ background: rowBg, cursor: "pointer", transition: "background 0.12s" }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = "#f0f9ff")}
                      onMouseLeave={ev => (ev.currentTarget.style.background = rowBg)}>
                      <td style={{ padding: "12px 14px", width: 44, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: badgeBg, color: badgeText, fontSize: 11, fontWeight: 900 }}>
                          {i + 1}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: GR, borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: rowAccent, border: `1.5px solid ${badgeBg}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: badgeBg, flexShrink: 0 }}>
                            {c.company_name?.[0] ?? "?"}
                          </div>
                          {c.company_name}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          {c.total_bids} جلسة
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        {c.wins > 0 ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                            {c.wins}× فاز
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                            لم يفز
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        {c.avg_diff_pct != null ? (
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                            background: c.avg_diff_pct < 0 ? "#dcfce7" : c.avg_diff_pct < 2 ? "#fef9c3" : "#f1f5f9",
                            color: c.avg_diff_pct < 0 ? "#15803d" : c.avg_diff_pct < 2 ? "#92400e" : "#475569",
                          }}>
                            {c.avg_diff_pct >= 0 ? "+" : ""}{c.avg_diff_pct}%
                          </span>
                        ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 12, borderBottom: "1px solid #f1f5f9" }}>
                        {c.last_seen ? new Date(c.last_seen).toLocaleDateString("ar-KW") : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <Link href={`/competitor-intelligence/c/${c.competitor_id}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: GD, fontWeight: 800, textDecoration: "none", background: "#fffbeb", border: `1.5px solid ${G}40`, padding: "4px 12px", borderRadius: 20 }}>
                          تفاصيل <ChevronLeft size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
