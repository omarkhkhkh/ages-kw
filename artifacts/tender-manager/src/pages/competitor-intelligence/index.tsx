/**
 * /competitor-intelligence — لوحة ذكاء المنافسين
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Trophy, TrendingUp, Target, BarChart3, Calendar,
  Loader2, ChevronLeft, Search, X, ArrowUpDown,
  ShieldAlert, Flame, AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip,
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

type SortKey = "total_bids" | "wins" | "avg_diff_pct" | "last_seen" | "win_rate";

/* ── Threat level badge ── */
function ThreatBadge({ wins, totalBids, avgDiff }: { wins: number; totalBids: number; avgDiff: number | null }) {
  const winRate = totalBids > 0 ? (wins / totalBids) * 100 : 0;
  const isClose = avgDiff !== null && Math.abs(avgDiff) < 3;

  if (wins >= 3 && winRate >= 25 && isClose) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fef2f2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
        <Flame size={11} /> خطر عالٍ
      </span>
    );
  }
  if ((wins >= 1 && winRate >= 15) || (isClose && totalBids >= 3)) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff7ed", color: "#c2410c", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
        <AlertTriangle size={11} /> تهديد متوسط
      </span>
    );
  }
  if (wins === 0 && totalBids >= 3) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f0fdf4", color: "#15803d", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
        <ShieldAlert size={11} /> تهديد منخفض
      </span>
    );
  }
  return <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>;
}

/* ── Win Rate bar ── */
function WinRateBar({ wins, total }: { wins: number; total: number }) {
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const color = pct >= 30 ? "#dc2626" : pct >= 15 ? "#f97316" : "#16a34a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ width: 60, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 30 }}>{pct}%</span>
    </div>
  );
}

export default function CompetitorIntelligence() {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tenderTypeFilter, setTenderTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [search,   setSearch]   = useState("");
  const [sortKey,  setSortKey]  = useState<SortKey>("total_bids");
  const [sortAsc,  setSortAsc]  = useState(false);

  const params = new URLSearchParams();
  if (sourceFilter !== "all") params.set("source_type", sourceFilter);
  if (tenderTypeFilter)       params.set("tender_type", tenderTypeFilter);
  if (dateFrom)               params.set("date_from", dateFrom);
  if (dateTo)                 params.set("date_to", dateTo);
  const paramStr = params.toString();

  const { data: summary = [], isLoading: summaryLoading } = useQuery<any[]>({
    queryKey: ["competitor-summary", paramStr],
    queryFn: () => apiFetch(`/api/analytics/competitors/summary${paramStr ? "?" + paramStr : ""}`),
    staleTime: 5 * 60_000,
  });

  const { data: gapData } = useQuery<any>({
    queryKey: ["competitor-gap"],
    queryFn: () => apiFetch("/api/analytics/competitors/gap-analysis"),
    staleTime: 10 * 60_000,
  });

  /* ── client-side filter + sort ── */
  const displayed = useMemo(() => {
    let list = [...summary];

    // Search by name
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c => c.company_name?.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      // nulls always sort to the end regardless of direction
      const nullLast = (va: any, vb: any, asc: boolean) => {
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return asc ? va - vb : vb - va;
      };

      let va: any, vb: any;
      if (sortKey === "win_rate") {
        va = a.total_bids > 0 ? a.wins / a.total_bids : 0;
        vb = b.total_bids > 0 ? b.wins / b.total_bids : 0;
      } else if (sortKey === "avg_diff_pct") {
        return nullLast(
          a.avg_diff_pct !== null ? Number(a.avg_diff_pct) : null,
          b.avg_diff_pct !== null ? Number(b.avg_diff_pct) : null,
          sortAsc,
        );
      } else if (sortKey === "last_seen") {
        va = a.last_seen ? new Date(a.last_seen).getTime() : 0;
        vb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      } else {
        va = a[sortKey] ?? 0;
        vb = b[sortKey] ?? 0;
      }
      return sortAsc ? va - vb : vb - va;
    });

    return list;
  }, [summary, search, sortKey, sortAsc]);

  /* ── Stats ── */
  const totalCompetitors = summary.length;
  const topThreat = summary.find(c => c.wins > 0);

  const S = {
    card: { background: "white", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1.5px solid #f3f4f6" } as any,
  };

  const gapChartData = gapData ? [
    { name: "< 1%",  value: gapData.gap_lt_1pct  ?? 0, fill: "#ef4444" },
    { name: "1–2%",  value: gapData.gap_1_to_2pct ?? 0, fill: "#f97316" },
    { name: "2–5%",  value: gapData.gap_2_to_5pct ?? 0, fill: "#eab308" },
    { name: "> 5%",  value: gapData.gap_gt_5pct   ?? 0, fill: "#22c55e" },
  ] : [];

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortBtn({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <button onClick={() => toggleSort(k)}
        style={{
          display: "flex", alignItems: "center", gap: 3, padding: "5px 12px",
          borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          border: `1.5px solid ${active ? G : "#e5e7eb"}`,
          background: active ? "#fffbeb" : "white",
          color: active ? GD : "#6b7280",
        }}>
        {children}
        <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.4 }} />
        {active && <span style={{ fontSize: 9 }}>{sortAsc ? "↑" : "↓"}</span>}
      </button>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>مركز ذكاء المنافسين</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>
            تحليل شامل لأداء المنافسين عبر جميع المناقصات والممارسات
          </p>
        </div>
        <Link href="/competitor-intelligence/predict"
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontFamily: "inherit", textDecoration: "none", boxShadow: "0 4px 14px rgba(212,165,52,0.3)" }}>
          <Target size={15} /> تنبؤ الأسعار
        </Link>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 14 }}>
        {[
          { icon: BarChart3,   label: "جلسات مسجَّلة",        value: gapData?.total_sessions ?? "—",                                              color: "#2563eb", bg: "#eff6ff" },
          { icon: Trophy,      label: "شركة منافسة",           value: totalCompetitors || "—",                                                     color: G,         bg: "#fffbeb" },
          { icon: TrendingUp,  label: "متوسط الفارق 1st–2nd",  value: gapData?.avg_gap_pct != null ? `${gapData.avg_gap_pct}%` : "—",              color: "#7c3aed", bg: "#f5f3ff" },
          { icon: Calendar,    label: "أقل فارق مسجَّل",       value: gapData?.min_gap_pct != null ? `${gapData.min_gap_pct}%` : "—",              color: "#dc2626", bg: "#fef2f2" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} style={{ ...S.card, borderTop: `3px solid ${color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon size={15} color={color} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {gapChartData.length > 0 && (
          <div style={S.card}>
            <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 14px" }}>توزيع الفارق بين المرتبة 1 و2</p>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={gapChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, fontFamily: "Cairo,sans-serif", direction: "rtl" }}
                  formatter={(v: any) => [`${v} جلسة`]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {gapChartData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>الفارق أقل من 1% = منافسة شديدة جداً</p>
          </div>
        )}

        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: 0 }}>ملخص الإحصاءات</p>
          {gapData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
              {[
                { label: "إجمالي الجلسات المحللة",    value: gapData.total_sessions, color: "#2563eb" },
                { label: "أصغر فارق 1st–2nd",        value: `${gapData.min_gap_pct}%`, color: "#dc2626" },
                { label: "أكبر فارق 1st–2nd",        value: `${gapData.max_gap_pct}%`, color: "#16a34a" },
                { label: "جلسات بفارق أقل من 1%",   value: gapData.gap_lt_1pct, color: "#7c3aed" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "#f9fafb" }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color }}>{value ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
          {topThreat && (
            <div style={{ marginTop: "auto", padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1.5px solid #fecaca", display: "flex", alignItems: "center", gap: 8 }}>
              <Flame size={14} color="#dc2626" />
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>الأعلى خطورة</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: GR }}>{topThreat.company_name}</p>
              </div>
              <span style={{ marginRight: "auto", fontSize: 12, fontWeight: 800, color: "#dc2626" }}>{topThreat.wins} انتصار</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Leaderboard ── */}
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trophy size={15} color="white" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>ترتيب الشركات المنافسة</span>
              {summary.length > 0 && (
                <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>
                  {displayed.length}/{summary.length} شركة
                </span>
              )}
            </div>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "6px 12px", minWidth: 200 }}>
              <Search size={13} color="#94a3b8" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث باسم الشركة..."
                style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", flex: 1, background: "transparent" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  <X size={12} color="#94a3b8" />
                </button>
              )}
            </div>
          </div>

          {/* Filters row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>نوع:</span>
            {[["all", "الكل"], ["tender", "مناقصات"], ["practice", "ممارسات"]].map(([v, l]) => (
              <button key={v} onClick={() => setSourceFilter(v)}
                style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${sourceFilter === v ? G : "#e5e7eb"}`, background: sourceFilter === v ? "#fffbeb" : "white", color: sourceFilter === v ? GD : "#6b7280" }}>
                {l}
              </button>
            ))}
            {["مناقصة عامة", "مناقصة محدودة", "أمر شراء مباشر"].map(t => (
              <button key={t} onClick={() => setTenderTypeFilter(tenderTypeFilter === t ? "" : t)}
                style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${tenderTypeFilter === t ? "#6366f1" : "#e5e7eb"}`, background: tenderTypeFilter === t ? "#eef2ff" : "white", color: tenderTypeFilter === t ? "#4f46e5" : "#6b7280" }}>
                {t}
              </button>
            ))}

            {/* Date range */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: "auto" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>من:</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: "3px 8px", borderRadius: 7, border: "1.5px solid #e5e7eb", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>إلى:</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: "3px 8px", borderRadius: 7, border: "1.5px solid #e5e7eb", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                  <X size={12} color="#94a3b8" />
                </button>
              )}
            </div>
          </div>

          {/* Sort row */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>ترتيب حسب:</span>
            <SortBtn k="total_bids">الجلسات</SortBtn>
            <SortBtn k="wins">الانتصارات</SortBtn>
            <SortBtn k="win_rate">نسبة الفوز</SortBtn>
            <SortBtn k="avg_diff_pct">الفرق السعري</SortBtn>
            <SortBtn k="last_seen">آخر ظهور</SortBtn>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          {summaryLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
              <Trophy size={36} style={{ margin: "0 auto 10px", display: "block", opacity: 0.2 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                {search ? `لا توجد شركات تطابق "${search}"` : "لا توجد بيانات بعد"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                {search ? "جرب بحثاً مختلفاً" : "ابدأ بتسجيل نتائج فضوض العطاء في المناقصات"}
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr style={{ background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)" }}>
                  {["#", "الشركة", "الجلسات", "الانتصارات", "نسبة الفوز", "متوسط الفرق", "مستوى التهديد", "آخر ظهور", ""].map(h => (
                    <th key={h} style={{ padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((c: any, i: number) => {
                  const rankColors: Record<number, [string, string, string]> = {
                    0: [G,        "#7c4b00", "#fffbeb"],
                    1: ["#94a3b8","#1e293b", "#f8fafc"],
                    2: ["#cd7c2f","#431407", "#fff7ed"],
                  };
                  const [badgeBg, badgeText, rowAccent] = rankColors[i] ?? ["#e2e8f0", "#64748b", "white"];
                  const rowBg = i % 2 === 0 ? "white" : "#fafbfc";
                  const avgDiff = c.avg_diff_pct != null ? Number(c.avg_diff_pct) : null;

                  return (
                    <tr key={c.competitor_id} style={{ background: rowBg, cursor: "pointer", transition: "background 0.12s" }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = "#f0f9ff")}
                      onMouseLeave={ev => (ev.currentTarget.style.background = rowBg)}>

                      {/* Rank */}
                      <td style={{ padding: "12px 14px", width: 44, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: badgeBg, color: badgeText, fontSize: 11, fontWeight: 900 }}>
                          {i + 1}
                        </span>
                      </td>

                      {/* Company */}
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: GR, borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: rowAccent, border: `1.5px solid ${badgeBg}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: badgeBg, flexShrink: 0 }}>
                            {c.company_name?.[0] ?? "?"}
                          </div>
                          <span style={{ fontSize: 13 }}>{c.company_name}</span>
                        </div>
                      </td>

                      {/* Total bids */}
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          {c.total_bids} جلسة
                        </span>
                      </td>

                      {/* Wins */}
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        {c.wins > 0 ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                            🏆 {c.wins}×
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                            لم يفز
                          </span>
                        )}
                      </td>

                      {/* Win rate */}
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <WinRateBar wins={c.wins ?? 0} total={c.total_bids ?? 0} />
                      </td>

                      {/* Avg diff */}
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        {avgDiff !== null ? (
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                            background: avgDiff < 0 ? "#dcfce7" : avgDiff < 2 ? "#fef9c3" : "#f1f5f9",
                            color: avgDiff < 0 ? "#15803d" : avgDiff < 2 ? "#92400e" : "#475569",
                          }}>
                            {avgDiff >= 0 ? "+" : ""}{avgDiff}%
                          </span>
                        ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>

                      {/* Threat level */}
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <ThreatBadge wins={c.wins ?? 0} totalBids={c.total_bids ?? 0} avgDiff={avgDiff} />
                      </td>

                      {/* Last seen */}
                      <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 12, borderBottom: "1px solid #f1f5f9" }}>
                        {c.last_seen ? new Date(c.last_seen).toLocaleDateString("ar-KW") : "—"}
                      </td>

                      {/* Detail link */}
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
