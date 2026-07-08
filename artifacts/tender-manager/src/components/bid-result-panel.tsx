/**
 * BidResultPanel — مكوّن إدخال وعرض نتائج فض العطاء
 * يُضمَّن في تفاصيل المناقصة وفي الصف الموسّع للممارسات
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Save, Pencil, ChevronDown, ChevronUp,
  Trophy, Loader2, X, Check, Calendar, FileText,
  Building2, DollarSign, TrendingUp, TrendingDown,
  AlertCircle, Package, Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";

/* ── theme ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

/* ── helpers ── */
async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

function diffColor(pct: number | null) {
  if (pct === null) return "#94a3b8";
  if (pct < -1) return "#16a34a";
  if (pct < 1)  return "#d97706";
  return "#dc2626";
}
function diffLabel(pct: number | null) {
  if (pct === null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/* ── Styled input ── */
const INP: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 9,
  border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box", background: "white",
  transition: "border-color 0.15s, box-shadow 0.15s",
};
function SI(p: React.InputHTMLAttributes<HTMLInputElement> & { ltr?: boolean }) {
  const { ltr, style, ...rest } = p;
  const [f, sf] = useState(false);
  return (
    <input
      style={{ ...INP, ...(f ? { borderColor: G, boxShadow: `0 0 0 3px ${G}18` } : {}), ...(ltr ? { direction: "ltr", textAlign: "left", fontFamily: "monospace" } : {}), ...style }}
      onFocus={() => sf(true)} onBlur={() => sf(false)} {...rest} />
  );
}

/* ── Rank badge ── */
function RankBadge({ rank }: { rank: number | null }) {
  const map: Record<number, [string, string]> = {
    1: [G, GR], 2: ["#94a3b8", "#1e293b"], 3: ["#cd7c2f", "#431407"],
  };
  const [bg, text] = map[rank ?? 0] ?? ["#e2e8f0", "#64748b"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: bg, color: text, fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
      {rank ?? "—"}
    </span>
  );
}

/* ── Competitor autocomplete with inline-add ── */
function CompetitorInput({ value, onChange }: { value: string; onChange: (name: string, id?: number | null) => void }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: results = [] } = useQuery<any[]>({
    queryKey: ["competitors-search", q],
    queryFn: () => apiFetch(`/api/competitors?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const trimmed = q.trim();
  const exactMatch = results.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
  const showAddNew = trimmed.length >= 2 && !exactMatch;

  async function handleAddNew() {
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      const newComp = await apiFetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      qc.invalidateQueries({ queryKey: ["competitors-search"] });
      setQ(newComp.name);
      onChange(newComp.name, newComp.id);
      setOpen(false);
    } catch {
      onChange(trimmed, null);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Building2 size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
        <input
          style={{ ...INP, paddingRight: 30 }}
          value={q}
          onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="اسم الشركة..."
          dir="rtl"
        />
      </div>
      {open && (results.length > 0 || showAddNew) && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0, background: "white", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", maxHeight: 200, overflowY: "auto" }}>
          {results.map((c: any) => (
            <div key={c.id}
              style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}
              onMouseDown={() => { setQ(c.name); onChange(c.name, c.id); setOpen(false); }}
              onMouseEnter={ev => (ev.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
              <Building2 size={12} color="#94a3b8" />
              <span style={{ fontWeight: 600, color: GR }}>{c.name}</span>
              {c.shortName && <span style={{ color: "#94a3b8", fontSize: 11 }}>({c.shortName})</span>}
            </div>
          ))}
          {showAddNew && (
            <div
              onMouseDown={handleAddNew}
              style={{ padding: "9px 12px", cursor: adding ? "default" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 7, borderTop: results.length > 0 ? "1.5px dashed #e2e8f0" : "none", color: GD, fontWeight: 700, background: "#fffbeb" }}
              onMouseEnter={ev => { if (!adding) ev.currentTarget.style.background = "#fef3c7"; }}
              onMouseLeave={ev => { ev.currentTarget.style.background = "#fffbeb"; }}>
              {adding
                ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> جاري الإضافة...</>
                : <><Plus size={12} /> إضافة &ldquo;{trimmed}&rdquo; كشركة جديدة</>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
interface Props {
  sourceType: "tender" | "practice";
  sourceId:   number;
  ourPrice?:  string | number | null;
  ourName?:   string;
}

export default function BidResultPanel({ sourceType, sourceId, ourPrice, ourName = "شركتنا" }: Props) {
  const { user }  = useAuth();
  const { toast } = useToast();
  const qc        = useQueryClient();
  const isAdmin   = user?.role === "admin";
  const canEdit   = isAdmin || !!user?.canEdit;

  const queryKey = ["bid-result", sourceType, sourceId];

  const { data: session, isLoading } = useQuery<any>({
    queryKey,
    queryFn: () => apiFetch(`/api/bid-results?${sourceType}_id=${sourceId}`),
    staleTime: 60_000,
  });

  const [editing, setEditing]     = useState(false);
  const [showItems, setShowItems] = useState(false);

  const emptyEntry = () => ({ competitorId: null as number | null, companyName: "", totalPrice: "", isWinner: false, isUs: false, notes: "" });
  const [form, setForm] = useState({
    openingDate: "",
    notes: "",
    entries: [{ ...emptyEntry(), companyName: ourName, isUs: true, totalPrice: ourPrice ? String(ourPrice) : "" }],
    items: [] as { itemName: string; itemType: string; unit: string; quantity: string; prices: { entryIndex: number; unitPrice: string }[] }[],
  });

  useEffect(() => {
    if (session && editing) {
      setForm({
        openingDate: session.openingDate ?? "",
        notes: session.notes ?? "",
        entries: session.entries.map((e: any) => ({
          competitorId: e.competitorId,
          companyName: e.companyName,
          totalPrice: e.totalPrice,
          isWinner: e.isWinner,
          isUs: e.isUs,
          notes: e.notes ?? "",
        })),
        items: session.items?.map((item: any) => ({
          itemName: item.itemName,
          itemType: item.itemType ?? "",
          unit: item.unit ?? "",
          quantity: item.quantity ?? "",
          prices: item.prices?.map((p: any) => {
            const entIdx = session.entries.findIndex((e: any) => e.id === p.bidEntryId);
            return { entryIndex: entIdx, unitPrice: p.unitPrice };
          }) ?? [],
        })) ?? [],
      });
    }
    if (!session && !editing) {
      setForm({
        openingDate: "",
        notes: "",
        entries: [{ ...emptyEntry(), companyName: ourName, isUs: true, totalPrice: ourPrice ? String(ourPrice) : "" }],
        items: [],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, editing]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (session) return apiFetch(`/api/bid-results/${session.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return apiFetch("/api/bid-results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); qc.invalidateQueries({ queryKey: ["tenders"] }); setEditing(false); toast({ title: "✅ تم حفظ نتائج جلسة الفض" }); },
    onError: (err: any) => { toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/bid-results/${session.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); qc.invalidateQueries({ queryKey: ["tenders"] }); toast({ title: "تم حذف الجلسة" }); },
  });

  const handleSave = () => {
    const payload = {
      sourceType,
      [`${sourceType}Id`]: sourceId,
      openingDate: form.openingDate || null,
      notes: form.notes || null,
      entries: form.entries.map(e => ({ competitorId: e.competitorId, companyName: e.companyName, totalPrice: e.totalPrice, isWinner: e.isWinner, isUs: e.isUs, notes: e.notes || null })),
      items: form.items.map(item => ({ itemName: item.itemName, itemType: item.itemType || null, unit: item.unit || null, quantity: item.quantity || null, prices: item.prices })),
    };
    saveMutation.mutate(payload);
  };

  const setEntryField = (idx: number, field: string, val: any) =>
    setForm(f => ({ ...f, entries: f.entries.map((e, i) => i === idx ? { ...e, [field]: val } : e) }));

  const addEntry  = () => setForm(f => ({ ...f, entries: [...f.entries, emptyEntry()] }));
  const removeEntry = (idx: number) => setForm(f => ({ ...f, entries: f.entries.filter((_, i) => i !== idx) }));

  /* ── table styles ── */
  const TH: React.CSSProperties = { padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", textAlign: "right" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 };

  /* ════════════ LOADING ════════════ */
  if (isLoading) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: G, display: "inline-block" }} />
    </div>
  );

  /* ════════════ EMPTY STATE ════════════ */
  if (!session && !editing) return (
    <div style={{ background: "linear-gradient(135deg,#fafbfc,#f1f5f9)", borderRadius: 16, border: "2px dashed #e2e8f0", padding: "40px 32px", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg,#f8fafc,#e2e8f0)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Trophy size={28} color="#cbd5e1" />
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color: "#475569", margin: "0 0 6px" }}>لم تُسجَّل نتائج فض العطاء بعد</p>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 22px", lineHeight: 1.6 }}>سجّل نتائج جلسة الفض لتفعيل تحليل المنافسين وتتبع ترتيبك</p>
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 26px", borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 3px 14px ${G}40` }}>
          <Plus size={15} /> تسجيل نتائج جلسة الفض
        </button>
      )}
    </div>
  );

  /* ════════════ VIEW MODE ════════════ */
  if (session && !editing) {
    const usEntry    = session.entries.find((e: any) => e.isUs);
    const winner     = session.entries.find((e: any) => e.isWinner);
    const ourPriceN  = usEntry ? Number(usEntry.totalPrice) : null;
    const weWon      = usEntry?.isWinner;
    const sorted     = [...session.entries].sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99));
    const ourRank    = usEntry?.rank ?? null;
    const totalBidders = session.entries.length;

    /* closest competitor diff */
    const competitors = sorted.filter((e: any) => !e.isUs);
    const closestDiff = ourPriceN && competitors.length
      ? competitors.reduce((best: number | null, e: any) => {
          const d = Math.abs(Number(e.totalPrice) / ourPriceN - 1) * 100;
          return best === null || d < best ? d : best;
        }, null as number | null)
      : null;

    /* result banner config */
    const resultConfig = weWon
      ? { bg: "linear-gradient(135deg,#15803d,#166534)", text: "white", accent: "#dcfce7", icon: Trophy, label: "رسَت علينا المناقصة", sub: "تهانينا — عرضنا كان الأفضل" }
      : winner
      ? { bg: "linear-gradient(135deg,#dc2626,#991b1b)", text: "white", accent: "#fee2e2", icon: AlertCircle, label: `رست على: ${winner.companyName}`, sub: ourRank ? `ترتيبنا: ${ourRank} من ${totalBidders}` : "لم نفز بهذه الجلسة" }
      : { bg: `linear-gradient(135deg,${GR},#1e3a22)`, text: "white", accent: "#fffbeb", icon: Trophy, label: "نتائج فض العطاء", sub: session.openingDate ? new Date(session.openingDate).toLocaleDateString("ar-KW") : "جلسة مسجَّلة" };

    const ResultIcon = resultConfig.icon;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }} dir="rtl">

        {/* ── Result Banner ── */}
        <div style={{ background: resultConfig.bg, borderRadius: 16, padding: "20px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden" }}>
          {/* decorative circle */}
          <div style={{ position: "absolute", left: -30, top: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", left: 40, bottom: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ResultIcon size={22} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "white" }}>{resultConfig.label}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>{resultConfig.sub}</div>
              </div>
            </div>

            {/* action buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              {session.openingDate && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.1)", padding: "5px 12px", borderRadius: 20 }}>
                  <Calendar size={12} /> {new Date(session.openingDate).toLocaleDateString("ar-KW")}
                </span>
              )}
              {canEdit && (
                <button onClick={() => setEditing(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)", color: "white", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.18)")}
                  onMouseLeave={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.1)")}>
                  <Pencil size={12} /> تعديل
                </button>
              )}
              {isAdmin && (
                <button onClick={() => { if (confirm("هل تريد حذف هذه الجلسة؟")) deleteMutation.mutate(); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, border: "1.5px solid rgba(255,100,100,0.4)", background: "rgba(220,38,38,0.2)", color: "#fca5a5", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* ── Quick stats row ── */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", position: "relative" }}>
            {[
              { label: "عدد المتنافسين",   value: totalBidders,  icon: Users },
              { label: "ترتيبنا",           value: ourRank ? `${ourRank} / ${totalBidders}` : "—", icon: Trophy },
              { label: "سعرنا",             value: ourPriceN ? formatCurrency(ourPriceN) : "—",     icon: DollarSign },
              { label: "أقرب فارق",         value: closestDiff !== null ? `${closestDiff.toFixed(1)}%` : "—", icon: TrendingUp },
            ].map(s => (
              <div key={s.label} style={{ flex: "1 1 110px", background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <s.icon size={10} /> {s.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "white", fontFamily: typeof s.value === "string" && s.value.includes(".") ? "monospace" : undefined }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Entries Table ── */}
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, background: "#fafbfc" }}>
            <Users size={14} color={G} />
            <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>الشركات المتنافسة</span>
            <span style={{ marginRight: "auto", fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{totalBidders} شركة</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "الشركة", "السعر الكلي", "الفرق عن سعرنا", "النتيجة"].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e: any, ri: number) => {
                const diffPct = ourPriceN && !e.isUs
                  ? Math.round((Number(e.totalPrice) / ourPriceN - 1) * 1000) / 10
                  : null;
                const rowBg = e.isUs ? "#fffdf0" : e.isWinner ? "#f0fdf4" : ri % 2 === 0 ? "white" : "#fafbfc";
                const sideBar = e.isUs ? `3px solid ${G}` : e.isWinner ? "3px solid #16a34a" : "3px solid transparent";
                return (
                  <tr key={e.id} style={{ background: rowBg, borderRight: sideBar, transition: "background 0.12s" }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = e.isUs ? "#fef3c7" : e.isWinner ? "#dcfce7" : "#f0f9ff")}
                    onMouseLeave={ev => (ev.currentTarget.style.background = rowBg)}>
                    <td style={{ ...TD, width: 46, textAlign: "center" }}><RankBadge rank={e.rank} /></td>
                    <td style={{ ...TD, fontWeight: 700, color: GR }}>
                      {e.isUs && (
                        <span style={{ fontSize: 10.5, background: `linear-gradient(135deg,${G},${GD})`, color: "white", padding: "2px 8px", borderRadius: 20, marginLeft: 7, fontWeight: 800 }}>نحن</span>
                      )}
                      {e.companyName}
                    </td>
                    <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, fontSize: 13.5 }}>{formatCurrency(e.totalPrice)}</td>
                    <td style={TD}>
                      {e.isUs
                        ? <span style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>مرجع</span>
                        : (
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800, background: diffPct === null ? "#f1f5f9" : diffPct < -1 ? "#dcfce7" : diffPct < 1 ? "#fef9c3" : "#fee2e2", color: diffColor(diffPct) }}>
                            {diffLabel(diffPct)}
                          </span>
                        )}
                    </td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      {e.isWinner && !e.isUs && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: 20, fontWeight: 800 }}>
                          <Trophy size={11} /> فائز
                        </span>
                      )}
                      {e.isWinner && e.isUs && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#fef3c7", color: GD, padding: "3px 10px", borderRadius: 20, fontWeight: 800 }}>
                          <Trophy size={11} /> فزنا
                        </span>
                      )}
                      {!e.isWinner && <span style={{ color: "#e2e8f0", fontSize: 18 }}>·</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Items toggle ── */}
        {session.items?.length > 0 && (
          <div>
            <button
              onClick={() => setShowItems(v => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", padding: "7px 16px", fontWeight: 700 }}>
              <Package size={13} color={G} />
              {showItems ? "إخفاء" : "عرض"} البنود التفصيلية
              <span style={{ background: G, color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 900 }}>{session.items.length}</span>
              {showItems ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showItems && (
              <div style={{ marginTop: 10, borderRadius: 14, overflow: "auto", border: "1px solid #e2e8f0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th style={TH}>البند</th>
                      <th style={TH}>الوحدة</th>
                      <th style={TH}>الكمية</th>
                      {session.entries.map((e: any) => (
                        <th key={e.id} style={{ ...TH, color: e.isUs ? GD : "#64748b", background: e.isUs ? "#fffbeb" : undefined }}>
                          {e.isUs ? "◀ نحن" : e.companyName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {session.items.map((item: any, ri: number) => (
                      <tr key={item.id} style={{ background: ri % 2 === 0 ? "white" : "#fafbfc" }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = "#f0f9ff")}
                        onMouseLeave={ev => (ev.currentTarget.style.background = ri % 2 === 0 ? "white" : "#fafbfc")}>
                        <td style={{ ...TD, fontWeight: 700, color: GR }}>{item.itemName}</td>
                        <td style={{ ...TD, color: "#64748b" }}>{item.unit ?? "—"}</td>
                        <td style={{ ...TD, color: "#64748b" }}>{item.quantity ?? "—"}</td>
                        {session.entries.map((e: any) => {
                          const price = item.prices?.find((p: any) => p.bidEntryId === e.id);
                          return (
                            <td key={e.id} style={{ ...TD, fontFamily: "monospace", fontWeight: 600, color: e.isUs ? GD : "#374151" }}>
                              {price ? formatCurrency(price.unitPrice) : <span style={{ color: "#cbd5e1" }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Notes ── */}
        {session.notes && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 16px", borderRadius: 12 }}>
            <FileText size={14} color={G} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.7 }}>{session.notes}</p>
          </div>
        )}
      </div>
    );
  }

  /* ════════════ EDIT / CREATE MODE ════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} dir="rtl">

      {/* ── Section header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: `linear-gradient(135deg,${GR},#1e3a22)`, borderRadius: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trophy size={17} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "white" }}>{session ? "تعديل نتائج الجلسة" : "تسجيل نتائج فض العطاء"}</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>أدخل أسعار جميع الشركات المشاركة</div>
        </div>
        {session && (
          <button onClick={() => setEditing(false)}
            style={{ marginRight: "auto", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)" }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Session meta ── */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={13} color={G} /> بيانات الجلسة
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
          <div>
            <label style={lbl}>تاريخ الجلسة</label>
            <SI type="date" value={form.openingDate} onChange={e => setForm(f => ({ ...f, openingDate: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>ملاحظات الجلسة</label>
            <SI value={form.notes} placeholder="أي ملاحظات عن الجلسة..." onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* ── Entries ── */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, background: "#fafbfc" }}>
          <Users size={14} color={G} />
          <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>الشركات المتنافسة</span>
          <span style={{ fontSize: 11.5, color: "#94a3b8", marginRight: "auto" }}>حدّد الفائز بالضغط على زر الكأس</span>
          <button onClick={addEntry}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${G}`, background: "#fffbeb", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: GD, fontWeight: 800 }}>
            <Plus size={12} /> إضافة شركة
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={TH}>الشركة</th>
                <th style={TH}>السعر الكلي (د.ك)</th>
                <th style={{ ...TH, textAlign: "center", width: 70 }}>فائز</th>
                <th style={{ ...TH, textAlign: "center", width: 70 }}>شركتنا</th>
                <th style={{ ...TH, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.entries.map((e, idx) => {
                const rowBg = e.isUs ? "#fffdf0" : "white";
                return (
                  <tr key={idx} style={{ background: rowBg, borderRight: e.isUs ? `3px solid ${G}` : "3px solid transparent" }}>
                    {/* company */}
                    <td style={{ ...TD, minWidth: 180 }}>
                      {e.isUs ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10.5, background: `linear-gradient(135deg,${G},${GD})`, color: "white", padding: "2px 8px", borderRadius: 20, fontWeight: 800, flexShrink: 0 }}>نحن</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: GD }}>{e.companyName}</span>
                        </div>
                      ) : (
                        <CompetitorInput
                          value={e.companyName}
                          onChange={(name, id) => { setEntryField(idx, "companyName", name); setEntryField(idx, "competitorId", id ?? null); }}
                        />
                      )}
                    </td>
                    {/* price */}
                    <td style={{ ...TD, minWidth: 140 }}>
                      <SI ltr type="number" step="0.001" value={e.totalPrice}
                        onChange={ev => setEntryField(idx, "totalPrice", ev.target.value)}
                        placeholder="0.000" />
                    </td>
                    {/* winner toggle */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!e.isWinner) {
                            setForm(f => ({ ...f, entries: f.entries.map((en, i) => ({ ...en, isWinner: i === idx })) }));
                          } else {
                            setEntryField(idx, "isWinner", false);
                          }
                        }}
                        style={{
                          width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
                          background: e.isWinner ? (e.isUs ? `linear-gradient(135deg,${G},${GD})` : "linear-gradient(135deg,#16a34a,#15803d)") : "#f1f5f9",
                          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
                          transition: "all 0.15s",
                        }}>
                        <Trophy size={14} color={e.isWinner ? "white" : "#94a3b8"} />
                      </button>
                    </td>
                    {/* is us toggle */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setEntryField(idx, "isUs", !e.isUs)}
                        style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", background: e.isUs ? `linear-gradient(135deg,${G},${GD})` : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", transition: "all 0.15s" }}>
                        <Check size={14} color={e.isUs ? "white" : "#94a3b8"} />
                      </button>
                    </td>
                    {/* delete */}
                    <td style={TD}>
                      {!e.isUs && (
                        <button onClick={() => removeEntry(idx)}
                          style={{ background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 7, cursor: "pointer", color: "#dc2626", padding: "4px 7px", display: "flex", alignItems: "center" }}>
                          <X size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Items section ── */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <button
          onClick={() => setShowItems(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", background: "#fafbfc", border: "none", cursor: "pointer", fontFamily: "inherit", borderBottom: showItems ? "1.5px solid #f1f5f9" : "none" }}>
          <Package size={14} color={G} />
          <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>البنود التفصيلية</span>
          <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>(اختياري)</span>
          <div style={{ marginRight: "auto", fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
            {showItems ? <><ChevronUp size={14} /> إخفاء</> : <><ChevronDown size={14} /> إضافة بنود</>}
          </div>
        </button>

        {showItems && (
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {form.items.map((item, iIdx) => (
              <div key={iIdx} style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <label style={lbl}>اسم البند *</label>
                    <SI value={item.itemName} placeholder="مثال: طاولة مكتبية"
                      onChange={e => setForm(f => ({ ...f, items: f.items.map((it, ii) => ii === iIdx ? { ...it, itemName: e.target.value } : it) }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={lbl}>الوحدة</label>
                    <SI value={item.unit} placeholder="قطعة"
                      onChange={e => setForm(f => ({ ...f, items: f.items.map((it, ii) => ii === iIdx ? { ...it, unit: e.target.value } : it) }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={lbl}>الكمية</label>
                    <SI ltr type="number" value={item.quantity} placeholder="0"
                      onChange={e => setForm(f => ({ ...f, items: f.items.map((it, ii) => ii === iIdx ? { ...it, quantity: e.target.value } : it) }))} />
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, ii) => ii !== iIdx) }))}
                    style={{ background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 8, cursor: "pointer", color: "#dc2626", padding: "7px 10px", display: "flex", alignItems: "center" }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {form.entries.map((entry, eIdx) => {
                    const priceObj = item.prices.find(p => p.entryIndex === eIdx);
                    return (
                      <div key={eIdx} style={{ minWidth: 120, flex: "1 1 120px" }}>
                        <label style={{ ...lbl, color: entry.isUs ? GD : "#64748b" }}>
                          {entry.isUs ? "◀ نحن" : (entry.companyName || `شركة ${eIdx + 1}`)}
                        </label>
                        <SI ltr type="number" step="0.001"
                          style={{ background: entry.isUs ? "#fffbeb" : "white" }}
                          value={priceObj?.unitPrice ?? ""}
                          placeholder="سعر/وحدة"
                          onChange={ev => setForm(f => {
                            const newItems = [...f.items];
                            const prices = [...newItems[iIdx].prices];
                            const pi = prices.findIndex(p => p.entryIndex === eIdx);
                            if (ev.target.value) {
                              if (pi >= 0) prices[pi] = { entryIndex: eIdx, unitPrice: ev.target.value };
                              else prices.push({ entryIndex: eIdx, unitPrice: ev.target.value });
                            } else { if (pi >= 0) prices.splice(pi, 1); }
                            newItems[iIdx] = { ...newItems[iIdx], prices };
                            return { ...f, items: newItems };
                          })} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              onClick={() => setForm(f => ({ ...f, items: [...f.items, { itemName: "", itemType: "", unit: "", quantity: "", prices: [] }] }))}
              style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 9, border: "1.5px dashed #cbd5e1", background: "white", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "#64748b", fontWeight: 700 }}>
              <Plus size={13} /> إضافة بند
            </button>
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "4px 0" }}>
        <button onClick={() => setEditing(false)}
          style={{ padding: "10px 22px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", background: "white", border: "1.5px solid #e2e8f0", color: "#475569", fontFamily: "inherit" }}
          onMouseEnter={ev => (ev.currentTarget.style.background = "#f8fafc")}
          onMouseLeave={ev => (ev.currentTarget.style.background = "white")}>
          إلغاء
        </button>
        <button onClick={handleSave} disabled={saveMutation.isPending}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 3px 14px ${G}40`, opacity: saveMutation.isPending ? 0.8 : 1, minWidth: 140 }}>
          {saveMutation.isPending ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />}
          {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الجلسة"}
        </button>
      </div>
    </div>
  );
}
