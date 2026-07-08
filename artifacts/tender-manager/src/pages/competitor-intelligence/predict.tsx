/**
 * /competitor-intelligence/predict — تنبؤ أسعار المنافسين
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Loader2, ArrowRight, Target, Search,
  Package, ChevronDown, X, BarChart2, SlidersHorizontal,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

async function apiFetch(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ── Win probability heuristic ── */
function calcWinProb(sliderValue: number, predictions: any[]): number {
  if (!predictions.length || sliderValue <= 0) return 0;
  let score = 0;
  for (const p of predictions) {
    if (sliderValue < p.range_low)  score += 1;
    else if (sliderValue < p.mean)  score += 0.65;
    else if (sliderValue < p.range_high) score += 0.3;
  }
  return Math.min(95, Math.max(3, Math.round((score / predictions.length) * 100)));
}

/* ── Probability Gauge (SVG arc) ── */
function ProbGauge({ pct }: { pct: number }) {
  const color = pct >= 60 ? "#16a34a" : pct >= 35 ? GD : "#dc2626";
  const r = 48; const cx = 60; const cy = 60;
  const circumference = Math.PI * r; // half circle
  const filled = circumference * (pct / 100);
  return (
    <svg width={120} height={70} viewBox="0 0 120 70">
      {/* track */}
      <path d={`M 12 60 A ${r} ${r} 0 0 1 108 60`}
        fill="none" stroke="#e5e7eb" strokeWidth={10} strokeLinecap="round" />
      {/* fill */}
      <path d={`M 12 60 A ${r} ${r} 0 0 1 108 60`}
        fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.4s ease" }} />
      <text x={cx} y={56} textAnchor="middle" fontSize={20} fontWeight={900}
        fill={color} fontFamily="'Cairo',sans-serif">{pct}%</text>
    </svg>
  );
}

/* ── Searchable Combobox ── */
function Combobox({
  items, value, onChange, placeholder, renderItem, getLabel,
}: {
  items: any[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  renderItem: (item: any) => React.ReactNode;
  getLabel: (item: any) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = items.find(i => String(i.id) === value);
  const filtered = q
    ? items.filter(i => getLabel(i).toLowerCase().includes(q.toLowerCase())).slice(0, 80)
    : items.slice(0, 80);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => { setOpen(o => !o); setQ(""); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: `1.5px solid ${open ? G : "#e5e7eb"}`, borderRadius: 9,
          background: "white", padding: "9px 14px", cursor: "pointer",
          boxShadow: open ? `0 0 0 3px ${G}20` : "none", transition: "all 0.15s",
        }}>
        <span style={{ fontSize: 13, color: selected ? GR : "#9ca3af", fontWeight: selected ? 600 : 400, flexGrow: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {selected && (
            <button onClick={e => { e.stopPropagation(); onChange(""); setOpen(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <X size={13} color="#9ca3af" />
            </button>
          )}
          <ChevronDown size={14} color="#94a3b8" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)", overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 6 }}>
            <Search size={13} color="#9ca3af" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ابحث..."
              style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", flex: 1, background: "transparent" }}
            />
            {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} color="#9ca3af" /></button>}
          </div>
          <div style={{ overflowY: "auto", maxHeight: 260 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "18px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>لا نتائج مطابقة</div>
            ) : filtered.map(item => (
              <div key={item.id}
                onClick={() => { onChange(String(item.id)); setOpen(false); setQ(""); }}
                style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f9fafb", fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                {renderItem(item)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Item Autocomplete Search ── */
function ItemSearch({ onSelect }: { onSelect: (name: string) => void }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["item-names", debouncedQ],
    queryFn: () => apiFetch(`/api/analytics/competitors/item-names?q=${encodeURIComponent(debouncedQ)}`),
    enabled: debouncedQ.length >= 1,
    staleTime: 60_000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${open ? G : "#e5e7eb"}`, borderRadius: 9, background: "white", padding: "9px 14px", gap: 8, boxShadow: open ? `0 0 0 3px ${G}20` : "none", transition: "all 0.15s" }}>
        <Search size={14} color="#94a3b8" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="اكتب اسم الصنف أو جزء منه..."
          style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", flex: 1, background: "transparent" }}
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <X size={13} color="#94a3b8" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)", overflow: "hidden",
        }}>
          <div style={{ overflowY: "auto", maxHeight: 240 }}>
            {suggestions.map(s => (
              <div key={s}
                onClick={() => { setQ(s); setOpen(false); onSelect(s); }}
                style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f9fafb", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                <Package size={13} color={G} />
                <span style={{ color: GR }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "6px 14px 8px", borderTop: "1px solid #f3f4f6" }}>
            <button
              onClick={() => { onSelect(q); setOpen(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: GD, fontWeight: 700, fontFamily: "inherit", padding: 0 }}>
              البحث عن "{q}" مباشرةً ←
            </button>
          </div>
        </div>
      )}

      {open && q.length >= 1 && suggestions.length === 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: "12px 14px",
        }}>
          <button
            onClick={() => { onSelect(q); setOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: GD, fontWeight: 700, fontFamily: "inherit", padding: 0 }}>
            البحث عن "{q}" ←
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Main Page
   ════════════════════════════════════════════════════════ */
export default function PredictPage() {
  // Mode: by tender/practice OR by item name
  const [mode, setMode] = useState<"source" | "item">("source");

  // Source mode state
  const [sourceType, setSourceType] = useState<"tender" | "practice">("tender");
  const [sourceId, setSourceId] = useState("");
  const [sliderPct, setSliderPct] = useState(0);
  const [compFilter, setCompFilter] = useState("");

  // Item mode state
  const [itemName, setItemName] = useState("");
  const [activeItemName, setActiveItemName] = useState("");

  /* ── Data queries ── */
  const { data: tenders = [] } = useQuery<any[]>({
    queryKey: ["tenders-for-predict"],
    queryFn: () => apiFetch("/api/tenders"),
    staleTime: 5 * 60_000,
  });
  const { data: practices = [] } = useQuery<any[]>({
    queryKey: ["practices-for-predict"],
    queryFn: () => apiFetch("/api/practices"),
    staleTime: 5 * 60_000,
  });

  const { data: prediction, isLoading: predLoading } = useQuery<any>({
    queryKey: ["predict", sourceType, sourceId],
    queryFn: () => apiFetch(`/api/analytics/competitors/predict?source_type=${sourceType}&source_id=${sourceId}`),
    enabled: !!sourceId && mode === "source",
    staleTime: 2 * 60_000,
  });

  const { data: itemAnalysis, isLoading: itemLoading } = useQuery<any>({
    queryKey: ["item-analysis", activeItemName],
    queryFn: () => apiFetch(`/api/analytics/competitors/item-analysis?item_name=${encodeURIComponent(activeItemName)}`),
    enabled: !!activeItemName && mode === "item",
    staleTime: 2 * 60_000,
  });

  /* ── Derived ── */
  const refValue   = prediction?.ref_value ?? 0;
  const sliderVal  = refValue ? refValue * (1 + sliderPct / 100) : 0;
  const prob       = prediction ? calcWinProb(sliderVal, prediction.predictions ?? []) : 0;

  const filteredPredictions = (prediction?.predictions ?? []).filter((p: any) =>
    !compFilter || p.company_name?.toLowerCase().includes(compFilter.toLowerCase())
  );

  const S = {
    card: { background: "white", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1.5px solid #f3f4f6" } as any,
    inp:  { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" } as any,
    lbl:  { fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 5 } as any,
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22, maxWidth: 860, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => window.history.back()}
          style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ArrowRight size={16} color="#374151" />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={20} color={G} /> تنبؤ أسعار المنافسين
          </h1>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>مبني على بيانات الفضوض المسجَّلة</p>
        </div>
      </div>

      {/* ── Mode Tabs ── */}
      <div style={{ display: "flex", gap: 6, background: "#f3f4f6", borderRadius: 10, padding: 4 }}>
        {([
          { id: "source", label: "بمناقصة / ممارسة", icon: Target },
          { id: "item",   label: "بصنف / مادة",      icon: Package },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMode(id)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", border: "none",
              background: mode === id ? `linear-gradient(135deg,${G},${GD})` : "transparent",
              color: mode === id ? "white" : "#6b7280",
              boxShadow: mode === id ? "0 2px 8px rgba(212,165,52,0.3)" : "none",
              transition: "all 0.2s",
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════
          MODE: by Tender / Practice
          ════════════════════════════════ */}
      {mode === "source" && (
        <>
          {/* Step 1: Select */}
          <div style={S.card}>
            <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg,${G},${GD})`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white", fontWeight: 900 }}>1</span>
              اختر المناقصة أو الممارسة
            </p>

            {/* Source type pills */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["tender", "practice"] as const).map(t => (
                <button key={t} onClick={() => { setSourceType(t); setSourceId(""); setSliderPct(0); }}
                  style={{
                    padding: "6px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${sourceType === t ? G : "#e5e7eb"}`,
                    background: sourceType === t ? "#fffbeb" : "white",
                    color: sourceType === t ? GD : "#6b7280",
                  }}>
                  {t === "tender" ? "مناقصة" : "ممارسة"}
                </button>
              ))}
            </div>

            {/* Searchable combobox */}
            <Combobox
              items={sourceType === "tender" ? tenders : practices}
              value={sourceId}
              onChange={v => { setSourceId(v); setSliderPct(0); setCompFilter(""); }}
              placeholder={`— ابحث واختر ${sourceType === "tender" ? "مناقصة" : "ممارسة"} —`}
              getLabel={item => `${item.tenderNumber || item.practiceNumber || ""} ${item.projectName || ""}`}
              renderItem={item => (
                <div>
                  <span style={{ fontWeight: 800, color: G, fontFamily: "monospace", fontSize: 12 }}>
                    {item.tenderNumber || item.practiceNumber}
                  </span>
                  <span style={{ color: GR, marginRight: 10, fontSize: 13 }}>{item.projectName}</span>
                  {item.governmentEntity && (
                    <span style={{ color: "#94a3b8", fontSize: 11, marginRight: 6 }}>— {item.governmentEntity}</span>
                  )}
                </div>
              )}
            />
          </div>

          {/* Loading */}
          {predLoading && (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <Loader2 size={26} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13 }}>جاري البحث عن جلسات مشابهة...</p>
            </div>
          )}

          {/* Results */}
          {prediction && !predLoading && (
            <>
              {/* Context banner */}
              <div style={{ ...S.card, background: "#fffbeb", border: `1.5px solid ${G}50` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    {prediction.source_name && (
                      <p style={{ margin: "0 0 4px", fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ background: sourceType === "practice" ? "#dbeafe" : "#f0fdf4", color: sourceType === "practice" ? "#1e40af" : "#166534", padding: "1px 8px", borderRadius: 10, fontWeight: 700, fontSize: 11 }}>
                          {sourceType === "practice" ? "ممارسة" : "مناقصة"}
                        </span>
                        <span style={{ fontWeight: 700, color: GR }}>{prediction.source_name}</span>
                      </p>
                    )}
                    <p style={{ margin: "0 0 2px", fontSize: 13, color: "#92400e", fontWeight: 700 }}>
                      مبني على <strong style={{ color: GR }}>{prediction.similar_sessions}</strong> جلسة مشابهة
                      {prediction.similar_sessions === 0 && (
                        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginRight: 6 }}>
                          — لم يُسجَّل فضوض مشابهة لهذه {sourceType === "practice" ? "الممارسة" : "المناقصة"} بعد
                        </span>
                      )}
                    </p>
                    {refValue > 0 && (
                      <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                        سعرنا المرجعي: <strong style={{ fontFamily: "monospace", color: GD }}>{formatCurrency(refValue)}</strong>
                      </p>
                    )}
                  </div>
                  <div>
                    {prediction.similar_sessions >= 5 && (
                      <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
                        ✓ بيانات كافية للتحليل
                      </span>
                    )}
                    {prediction.similar_sessions > 0 && prediction.similar_sessions < 5 && (
                      <span style={{ fontSize: 11, background: "#fef9c3", color: "#92400e", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
                        ⚠ بيانات محدودة — دقة منخفضة
                      </span>
                    )}
                    {prediction.similar_sessions === 0 && (
                      <span style={{ fontSize: 11, background: "#fee2e2", color: "#dc2626", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
                        ✗ لا بيانات كافية
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {prediction.predictions?.length === 0 && (
                <div style={{ ...S.card, textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>
                  <Target size={36} style={{ margin: "0 auto 10px", display: "block", opacity: 0.25 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>لا توجد بيانات كافية</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12 }}>لم يتم تسجيل فضوض كافية لهذه المناقصة</p>
                </div>
              )}

              {prediction.predictions?.length > 0 && (
                <>
                  {/* Competitor predictions table */}
                  <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Target size={14} color="white" />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>توقعات أسعار المنافسين</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>
                        {prediction.predictions.length} شركة
                      </span>
                      {/* Filter by company name */}
                      <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "5px 10px" }}>
                        <Search size={12} color="#94a3b8" />
                        <input
                          value={compFilter}
                          onChange={e => setCompFilter(e.target.value)}
                          placeholder="فلتر بالشركة..."
                          style={{ border: "none", outline: "none", fontSize: 12, fontFamily: "inherit", background: "transparent", width: 130 }}
                        />
                        {compFilter && <button onClick={() => setCompFilter("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={11} color="#94a3b8" /></button>}
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)" }}>
                            {["#", "الشركة", "النطاق المتوقع", "متوسط السعر", "الفرق عن سعرنا", "جلسات", "الثقة"].map(h => (
                              <th key={h} style={{ padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPredictions.map((p: any, i: number) => {
                            const rowBg = i % 2 === 0 ? "white" : "#fafbfc";
                            const confColor = p.confidence >= 70 ? "#15803d" : p.confidence >= 40 ? "#92400e" : "#dc2626";
                            const confBg   = p.confidence >= 70 ? "#dcfce7" : p.confidence >= 40 ? "#fef9c3"  : "#fee2e2";
                            const diffPct  = refValue > 0 ? ((p.mean - refValue) / refValue * 100).toFixed(1) : null;
                            // positive diff = competitor more expensive than us → advantage (green)
                            // negative diff = competitor cheaper than us → threat (red)
                            const diffPos  = diffPct !== null && Number(diffPct) > 0;
                            return (
                              <tr key={p.competitor_id} style={{ background: rowBg, transition: "background 0.12s" }}
                                onMouseEnter={ev => (ev.currentTarget.style.background = "#f0f9ff")}
                                onMouseLeave={ev => (ev.currentTarget.style.background = rowBg)}>
                                <td style={{ padding: "12px 14px", width: 40, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: i === 0 ? `${G}20` : "#f1f5f9", color: i === 0 ? GD : "#64748b", fontSize: 11, fontWeight: 900 }}>{i + 1}</span>
                                </td>
                                <td style={{ padding: "12px 14px", fontWeight: 700, color: GR, borderBottom: "1px solid #f1f5f9" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#475569", flexShrink: 0 }}>
                                      {p.company_name?.[0] ?? "?"}
                                    </div>
                                    <span style={{ fontSize: 13 }}>{p.company_name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, color: "#475569", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                                  <span style={{ background: "#f0fdf4", color: "#15803d", padding: "3px 7px", borderRadius: 6, border: "1px solid #bbf7d0", fontSize: 11 }}>{formatCurrency(p.range_low)}</span>
                                  <span style={{ margin: "0 5px", color: "#94a3b8" }}>↔</span>
                                  <span style={{ background: "#fef2f2", color: "#dc2626", padding: "3px 7px", borderRadius: 6, border: "1px solid #fecaca", fontSize: 11 }}>{formatCurrency(p.range_high)}</span>
                                </td>
                                <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 800, color: GD, fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
                                  {formatCurrency(p.mean)}
                                </td>
                                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                                  {diffPct !== null ? (
                                    <span style={{
                                      display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                                      background: diffPos ? "#dcfce7" : "#fee2e2",
                                      color: diffPos ? "#15803d" : "#dc2626",
                                    }}>
                                      {diffPos ? "أغلى منا " : "أرخص منا "}
                                      {Number(diffPct) >= 0 ? "+" : ""}{diffPct}%
                                    </span>
                                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                                </td>
                                <td style={{ padding: "12px 14px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                                  <span style={{ background: "#f1f5f9", color: "#475569", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{p.appearances}</span>
                                </td>
                                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", minWidth: 130 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                    <div style={{ flex: 1, height: 7, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${p.confidence}%`, background: confColor, borderRadius: 4, transition: "width 0.4s ease" }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: confColor, background: confBg, padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>{p.confidence}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredPredictions.length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                                لا توجد شركات مطابقة للبحث
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Win Probability Simulator ── */}
                  {refValue > 0 && (
                    <div style={S.card}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 7 }}>
                        <SlidersHorizontal size={14} color={G} /> محاكاة السعر — احتمال الفوز
                      </p>

                      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                        {/* Gauge */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <ProbGauge pct={prob} />
                          <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, fontWeight: 600 }}>احتمال الفوز</span>
                          <span style={{ fontSize: 10, color: prob >= 60 ? "#15803d" : prob >= 35 ? GD : "#dc2626", fontWeight: 800, marginTop: 2 }}>
                            {prob >= 60 ? "فرصة جيدة" : prob >= 35 ? "منافسة متوسطة" : "منافسة شديدة"}
                          </span>
                        </div>

                        {/* Slider */}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>سعرك المقترح:</span>
                            <span style={{ fontFamily: "monospace", fontWeight: 800, color: GD, fontSize: 15 }}>{formatCurrency(sliderVal)}</span>
                          </div>
                          <input type="range" min="-25" max="25" step="0.5" value={sliderPct}
                            onChange={e => setSliderPct(Number(e.target.value))}
                            style={{ width: "100%", accentColor: G, cursor: "pointer" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                            <span>−25% ({formatCurrency(refValue * 0.75)})</span>
                            <span style={{ fontWeight: 700, color: "#6b7280" }}>مرجع</span>
                            <span>+25% ({formatCurrency(refValue * 1.25)})</span>
                          </div>

                          {/* Marker lines vs competitors */}
                          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
                            {(prediction.predictions ?? []).slice(0, 4).map((p: any) => {
                              const pct2 = refValue > 0 ? ((p.mean - refValue) / refValue * 100) : 0;
                              const isBelow = sliderVal < p.mean;
                              return (
                                <div key={p.competitor_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#475569", flexShrink: 0 }}>
                                    {p.company_name?.[0] ?? "?"}
                                  </span>
                                  <span style={{ color: "#6b7280", flexShrink: 0, width: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.company_name}</span>
                                  <span style={{ fontFamily: "monospace", color: GD, flexShrink: 0 }}>{formatCurrency(p.mean)}</span>
                                  <span style={{
                                    padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 800,
                                    background: isBelow ? "#dcfce7" : "#fee2e2",
                                    color: isBelow ? "#15803d" : "#dc2626",
                                  }}>{isBelow ? "✓ أقل منهم" : "✗ أعلى منهم"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════
          MODE: by Item Name
          ════════════════════════════════ */}
      {mode === "item" && (
        <>
          {/* Search */}
          <div style={S.card}>
            <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg,${G},${GD})`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white", fontWeight: 900 }}>1</span>
              ابحث عن اسم الصنف أو المادة
            </p>
            <ItemSearch onSelect={name => { setActiveItemName(name); setItemName(name); }} />
            {activeItemName && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <Package size={13} color={G} />
                <span style={{ fontSize: 12, color: "#6b7280" }}>يعرض نتائج: </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>{activeItemName}</span>
                <button onClick={() => setActiveItemName("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8" }}>
                  <X size={12} /> مسح
                </button>
              </div>
            )}
          </div>

          {/* Loading */}
          {itemLoading && (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
              <Loader2 size={26} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13 }}>جاري البحث في سجلات الأصناف...</p>
            </div>
          )}

          {/* Item Analysis Results */}
          {itemAnalysis && !itemLoading && (
            <>
              {/* Our price context */}
              {itemAnalysis.our_data?.our_avg_price && (
                <div style={{ ...S.card, background: `linear-gradient(135deg,${GR}f2,${GR})`, border: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${G}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <BarChart2 size={18} color={G} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: `${G}cc`, fontWeight: 700 }}>متوسط سعرنا لهذا الصنف</p>
                      <p style={{ margin: "2px 0 0", fontFamily: "monospace", fontWeight: 900, color: G, fontSize: 20 }}>
                        {formatCurrency(Number(itemAnalysis.our_data.our_avg_price))}
                      </p>
                    </div>
                    <div style={{ marginRight: "auto", display: "flex", gap: 16 }}>
                      {itemAnalysis.our_data.our_min_price && (
                        <div style={{ textAlign: "center" }}>
                          <p style={{ margin: 0, fontSize: 10, color: `${G}99` }}>الأدنى</p>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#86efac", fontFamily: "monospace" }}>{formatCurrency(Number(itemAnalysis.our_data.our_min_price))}</p>
                        </div>
                      )}
                      {itemAnalysis.our_data.our_max_price && (
                        <div style={{ textAlign: "center" }}>
                          <p style={{ margin: 0, fontSize: 10, color: `${G}99` }}>الأعلى</p>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fca5a5", fontFamily: "monospace" }}>{formatCurrency(Number(itemAnalysis.our_data.our_max_price))}</p>
                        </div>
                      )}
                      <div style={{ textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 10, color: `${G}99` }}>ظهور</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "white" }}>{itemAnalysis.our_data.appearances}×</p>
                      </div>
                    </div>
                  </div>
                  {itemAnalysis.our_data.matched_items && (
                    <p style={{ margin: "10px 0 0", fontSize: 11, color: `${G}90` }}>
                      أصناف مطابقة: {itemAnalysis.our_data.matched_items}
                    </p>
                  )}
                </div>
              )}

              {itemAnalysis.competitors.length === 0 ? (
                <div style={{ ...S.card, textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>
                  <Package size={36} style={{ margin: "0 auto 10px", display: "block", opacity: 0.25 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>لا توجد بيانات منافسين لهذا الصنف</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12 }}>جرب بحثاً مختلفاً أو تحقق من تسمية الصنف</p>
                </div>
              ) : (
                <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Package size={14} color="white" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>أسعار المنافسين للصنف</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>
                      {itemAnalysis.competitors.length} شركة
                    </span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                      <thead>
                        <tr style={{ background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)" }}>
                          {["#", "الشركة", "متوسط السعر", "أدنى سعر", "أعلى سعر", "الفرق عن سعرنا", "ظهور"].map(h => (
                            <th key={h} style={{ padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itemAnalysis.competitors.map((c: any, i: number) => {
                          const rowBg = i % 2 === 0 ? "white" : "#fafbfc";
                          const ourAvg = Number(itemAnalysis.our_data?.our_avg_price ?? 0);
                          const theirAvg = Number(c.avg_price);
                          const diffPct = ourAvg > 0 ? ((theirAvg - ourAvg) / ourAvg * 100).toFixed(1) : null;
                          // negative = competitor cheaper than us → threat (red)
                          // positive = competitor more expensive → good (green)
                          const cheaperThanUs = diffPct !== null && Number(diffPct) < 0;
                          return (
                            <tr key={c.competitor_id} style={{ background: rowBg, transition: "background 0.12s" }}
                              onMouseEnter={ev => (ev.currentTarget.style.background = "#f0f9ff")}
                              onMouseLeave={ev => (ev.currentTarget.style.background = rowBg)}>
                              <td style={{ padding: "12px 14px", width: 40, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: i === 0 ? `${G}20` : "#f1f5f9", color: i === 0 ? GD : "#64748b", fontSize: 11, fontWeight: 900 }}>{i + 1}</span>
                              </td>
                              <td style={{ padding: "12px 14px", fontWeight: 700, color: GR, borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#475569", flexShrink: 0 }}>
                                    {c.company_name?.[0] ?? "?"}
                                  </div>
                                  {c.company_name}
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 800, color: GD, fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
                                {formatCurrency(Number(c.avg_price))}
                              </td>
                              <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, color: "#15803d", borderBottom: "1px solid #f1f5f9" }}>
                                {formatCurrency(Number(c.min_price))}
                              </td>
                              <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, color: "#dc2626", borderBottom: "1px solid #f1f5f9" }}>
                                {formatCurrency(Number(c.max_price))}
                              </td>
                              <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                                {diffPct !== null ? (
                                  <span style={{
                                    display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                                    background: cheaperThanUs ? "#dcfce7" : "#fee2e2",
                                    color: cheaperThanUs ? "#15803d" : "#dc2626",
                                  }}>
                                    {cheaperThanUs ? "أرخص منا " : "أغلى منا "}
                                    {Number(diffPct) >= 0 ? "+" : ""}{diffPct}%
                                  </span>
                                ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                                <span style={{ background: "#f1f5f9", color: "#475569", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{c.appearances}×</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
