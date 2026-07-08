/**
 * BidResultPanel — مكوّن إدخال وعرض نتائج فض العطاء
 * يُضمَّن في تفاصيل المناقصة وفي الصف الموسّع للممارسات
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Save, Pencil, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Loader2, X, Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";

/* ── colours ── */
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
  if (pct === null) return "#9ca3af";
  if (pct < -1) return "#16a34a";    // أرخص منّا ← خطر
  if (pct < 1)  return "#d97706";    // فرق ضئيل
  return "#dc2626";                   // أغلى منّا ← جيد
}
function diffLabel(pct: number | null) {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/* ── Competitor autocomplete with inline-add ── */
function CompetitorInput({
  value, onChange,
}: { value: string; onChange: (name: string, id?: number | null) => void }) {
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
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Show "add new" only when trimmed query doesn't exactly match any result
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
      // refresh search cache so it appears next time
      qc.invalidateQueries({ queryKey: ["competitors-search"] });
      setQ(newComp.name);
      onChange(newComp.name, newComp.id);
      setOpen(false);
    } catch {
      // name conflict or server error — still accept as free-text
      onChange(trimmed, null);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  }

  const hasDropdown = open && (results.length > 0 || showAddNew);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none" }}
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="اسم الشركة..."
        dir="rtl"
      />
      {hasDropdown && (
        <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: "white", border: "1.5px solid #e5e7eb", borderRadius: 8, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto" }}>
          {results.map((c: any) => (
            <div key={c.id}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6" }}
              onMouseDown={() => { setQ(c.name); onChange(c.name, c.id); setOpen(false); }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {c.name}
              {c.shortName && <span style={{ color: "#9ca3af", fontSize: 11, marginRight: 8 }}>{c.shortName}</span>}
            </div>
          ))}
          {showAddNew && (
            <div
              onMouseDown={handleAddNew}
              style={{
                padding: "8px 12px", cursor: adding ? "default" : "pointer", fontSize: 13,
                display: "flex", alignItems: "center", gap: 7,
                borderTop: results.length > 0 ? "1.5px dashed #e5e7eb" : "none",
                color: "#A87C20", fontWeight: 700, background: "#fffbeb",
              }}
              onMouseEnter={e => { if (!adding) e.currentTarget.style.background = "#fef3c7"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fffbeb"; }}>
              {adding
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جاري الإضافة...</>
                : <><Plus size={13} /> إضافة &ldquo;{trimmed}&rdquo; كشركة جديدة</>
              }
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
  ourPrice?:  string | number | null;  // offer_value or contract_value
  ourName?:   string;                  // company name for "is_us" row
}

export default function BidResultPanel({ sourceType, sourceId, ourPrice, ourName = "شركتنا" }: Props) {
  const { user }   = useAuth();
  const { toast }  = useToast();
  const qc         = useQueryClient();
  const isAdmin    = user?.role === "admin";
  const canEdit    = isAdmin || !!user?.canEdit;

  const queryKey = ["bid-result", sourceType, sourceId];

  const { data: session, isLoading } = useQuery<any>({
    queryKey,
    queryFn: () => apiFetch(`/api/bid-results?${sourceType}_id=${sourceId}`),
    staleTime: 60_000,
  });

  const [editing, setEditing] = useState(false);
  const [showItems, setShowItems] = useState(false);

  /* ── form state ── */
  const emptyEntry = () => ({ competitorId: null as number | null, companyName: "", totalPrice: "", isWinner: false, isUs: false, notes: "" });
  const [form, setForm] = useState({
    openingDate: "",
    notes: "",
    entries: [{ ...emptyEntry(), companyName: ourName, isUs: true, totalPrice: ourPrice ? String(ourPrice) : "" }],
    items: [] as { itemName: string; itemType: string; unit: string; quantity: string; prices: { entryIndex: number; unitPrice: string }[] }[],
  });

  // When session loads and we open edit, pre-fill form
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
      if (session) {
        return apiFetch(`/api/bid-results/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("/api/bid-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["tenders"] });
      setEditing(false);
      toast({ title: "تم الحفظ بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/bid-results/${session.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["tenders"] });
      toast({ title: "تم حذف الجلسة" });
    },
  });

  const handleSave = () => {
    const payload = {
      sourceType,
      [`${sourceType}Id`]: sourceId,
      openingDate: form.openingDate || null,
      notes: form.notes || null,
      entries: form.entries.map(e => ({
        competitorId: e.competitorId,
        companyName:  e.companyName,
        totalPrice:   e.totalPrice,
        isWinner:     e.isWinner,
        isUs:         e.isUs,
        notes:        e.notes || null,
      })),
      items: form.items.map(item => ({
        itemName: item.itemName,
        itemType: item.itemType || null,
        unit:     item.unit || null,
        quantity: item.quantity || null,
        prices:   item.prices,
      })),
    };
    saveMutation.mutate(payload);
  };

  const setEntryField = (idx: number, field: string, val: any) => {
    setForm(f => ({
      ...f,
      entries: f.entries.map((e, i) => i === idx ? { ...e, [field]: val } : e),
    }));
  };

  const addEntry = () => setForm(f => ({ ...f, entries: [...f.entries, emptyEntry()] }));
  const removeEntry = (idx: number) => setForm(f => ({ ...f, entries: f.entries.filter((_, i) => i !== idx) }));

  /* ── S styles ── */
  const S = {
    inp: { padding: "6px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" } as any,
    label: { fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 3 } as any,
    th: { padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" } as any,
    td: { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", textAlign: "right" } as any,
    tbl: { borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as any,
  };

  const rankBadge = (rank: number | null) => {
    const colors: Record<number, [string, string]> = { 1: [G, "#7c4b00"], 2: ["#94a3b8", "#1e293b"], 3: ["#cd7c2f", "#431407"] };
    const [bg, text] = colors[rank ?? 0] ?? ["#e2e8f0", "#64748b"];
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: bg, color: text, fontSize: 11, fontWeight: 900 }}>
        {rank ?? "—"}
      </span>
    );
  };

  /* ════════════ LOADING ════════════ */
  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
      </div>
    );
  }

  /* ════════════ NO SESSION + NO EDIT MODE ════════════ */
  if (!session && !editing) {
    return (
      <div style={{ padding: 32, textAlign: "center", background: "#fafafa", borderRadius: 12, border: "1.5px dashed #e5e7eb" }}>
        <Trophy size={32} style={{ margin: "0 auto 10px", display: "block", color: "#d1d5db" }} />
        <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>لم تُسجَّل نتائج فض العطاء بعد</p>
        <p style={{ color: "#9ca3af", fontSize: 12, margin: "0 0 16px" }}>أدخل نتائج الجلسة لتفعيل تحليل المنافسين</p>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
            <Plus size={14} /> تسجيل نتائج جلسة الفض
          </button>
        )}
      </div>
    );
  }

  /* ════════════ VIEW MODE ════════════ */
  if (session && !editing) {
    const usEntry  = session.entries.find((e: any) => e.isUs);
    const ourPriceNum = usEntry ? Number(usEntry.totalPrice) : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Trophy size={16} color={G} />
            <span style={{ fontWeight: 700, fontSize: 14, color: GR }}>
              جلسة فض العطاء
              {session.openingDate && <span style={{ color: "#6b7280", fontWeight: 500, fontSize: 12, marginRight: 8 }}>— {new Date(session.openingDate).toLocaleDateString("ar-KW")}</span>}
            </span>
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditing(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: "#374151" }}>
                <Pencil size={12} /> تعديل
              </button>
              {isAdmin && (
                <button
                  onClick={() => { if (confirm("هل تريد حذف هذه الجلسة؟")) deleteMutation.mutate(); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1.5px solid #fee2e2", background: "#fff5f5", cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: "#dc2626" }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Entries table */}
        <div style={S.tbl}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "الشركة", "السعر الكلي", "الفرق عن سعرنا", "الفائز"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...session.entries].sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99)).map((e: any, ri: number) => {
                const diffPct = ourPriceNum && !e.isUs
                  ? Math.round((Number(e.totalPrice) / ourPriceNum - 1) * 1000) / 10
                  : null;
                const rowBg = e.isUs ? "#fffdf0" : e.isWinner ? "#f0fdf4" : ri % 2 === 0 ? "white" : "#fafbfc";
                const borderLeft = e.isUs ? `3px solid ${G}` : e.isWinner ? "3px solid #16a34a" : "3px solid transparent";
                return (
                  <tr key={e.id} style={{ background: rowBg, borderRight: borderLeft, transition: "background 0.15s" }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = e.isUs ? "#fef3c7" : e.isWinner ? "#dcfce7" : "#f0f9ff")}
                    onMouseLeave={ev => (ev.currentTarget.style.background = rowBg)}>
                    <td style={{ ...S.td, width: 44, textAlign: "center" }}>{rankBadge(e.rank)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: GR }}>
                      {e.isUs && (
                        <span style={{ fontSize: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", padding: "2px 7px", borderRadius: 10, marginLeft: 7, fontWeight: 800 }}>نحن</span>
                      )}
                      {e.companyName}
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, fontSize: 13.5 }}>{formatCurrency(e.totalPrice)}</td>
                    <td style={{ ...S.td }}>
                      {e.isUs
                        ? <span style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>مرجع</span>
                        : (
                          <span style={{
                            display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                            background: diffPct === null ? "#f1f5f9" : diffPct < -1 ? "#dcfce7" : diffPct < 1 ? "#fef9c3" : "#fee2e2",
                            color: diffColor(diffPct),
                          }}>
                            {diffLabel(diffPct)}
                          </span>
                        )}
                    </td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      {e.isWinner && !e.isUs && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: 20, fontWeight: 800 }}>
                          <Trophy size={11} /> فائز
                        </span>
                      )}
                      {e.isWinner && e.isUs && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: 20, fontWeight: 800 }}>
                          <Trophy size={11} /> فزنا
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Items toggle */}
        {session.items?.length > 0 && (
          <button
            onClick={() => setShowItems(v => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", padding: "6px 14px", fontWeight: 600 }}>
            {showItems ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showItems ? "إخفاء" : "عرض"} تفاصيل البنود
            <span style={{ background: "#e2e8f0", color: "#475569", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{session.items.length}</span>
          </button>
        )}

        {showItems && session.items?.length > 0 && (
          <div style={{ ...S.tbl, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={S.th}>البند</th>
                  <th style={S.th}>الوحدة</th>
                  <th style={S.th}>الكمية</th>
                  {session.entries.map((e: any) => (
                    <th key={e.id} style={{ ...S.th, color: e.isUs ? GD : "#64748b", background: e.isUs ? "#fffbeb" : undefined }}>
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
                    <td style={{ ...S.td, fontWeight: 700, color: GR }}>{item.itemName}</td>
                    <td style={{ ...S.td, color: "#64748b" }}>{item.unit ?? "—"}</td>
                    <td style={{ ...S.td, color: "#64748b" }}>{item.quantity ?? "—"}</td>
                    {session.entries.map((e: any) => {
                      const price = item.prices?.find((p: any) => p.bidEntryId === e.id);
                      return (
                        <td key={e.id} style={{ ...S.td, fontFamily: "monospace", fontWeight: 600, color: e.isUs ? GD : "#374151" }}>
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

        {session.notes && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: 10 }}>
            <span style={{ fontSize: 14, marginTop: 1 }}>📝</span>
            <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.6 }}>{session.notes}</p>
          </div>
        )}
      </div>
    );
  }

  /* ════════════ EDIT / CREATE MODE ════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} dir="rtl">

      {/* Session header */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={S.label}>تاريخ الجلسة</label>
          <input type="date" style={S.inp} value={form.openingDate}
            onChange={e => setForm(f => ({ ...f, openingDate: e.target.value }))} />
        </div>
        <div style={{ flex: 2, minWidth: 240 }}>
          <label style={S.label}>ملاحظات</label>
          <input style={S.inp} value={form.notes} placeholder="ملاحظات الجلسة..."
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>

      {/* Entries */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>الشركات المتنافسة</span>
          <button onClick={addEntry}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 7, border: `1.5px solid ${G}`, background: "white", cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: GD, fontWeight: 700 }}>
            <Plus size={12} /> إضافة شركة
          </button>
        </div>

        <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
            <thead>
              <tr>
                <th style={S.th}>الشركة</th>
                <th style={S.th}>السعر الكلي (د.ك)</th>
                <th style={{ ...S.th, textAlign: "center" }}>فائز</th>
                <th style={{ ...S.th, textAlign: "center" }}>شركتنا</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {form.entries.map((e, idx) => (
                <tr key={idx} style={{ background: e.isUs ? "#fffbeb" : "white" }}>
                  <td style={{ ...S.td, minWidth: 160 }}>
                    {e.isUs ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: GD }}>{e.companyName}</span>
                    ) : (
                      <CompetitorInput
                        value={e.companyName}
                        onChange={(name, id) => {
                          setEntryField(idx, "companyName", name);
                          setEntryField(idx, "competitorId", id ?? null);
                        }}
                      />
                    )}
                  </td>
                  <td style={{ ...S.td, minWidth: 130 }}>
                    <input
                      type="number" step="0.001" style={{ ...S.inp, textAlign: "left", direction: "ltr", fontFamily: "monospace" }}
                      value={e.totalPrice}
                      onChange={ev => setEntryField(idx, "totalPrice", ev.target.value)}
                      placeholder="0.000"
                    />
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <input type="checkbox" checked={e.isWinner}
                      onChange={ev => {
                        // Only one winner allowed
                        if (ev.target.checked) {
                          setForm(f => ({ ...f, entries: f.entries.map((en, i) => ({ ...en, isWinner: i === idx })) }));
                        } else {
                          setEntryField(idx, "isWinner", false);
                        }
                      }}
                    />
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <input type="checkbox" checked={e.isUs}
                      onChange={ev => setEntryField(idx, "isUs", ev.target.checked)}
                    />
                  </td>
                  <td style={{ ...S.td }}>
                    {!e.isUs && (
                      <button onClick={() => removeEntry(idx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items section */}
      <div>
        <button onClick={() => setShowItems(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#6b7280", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
          {showItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showItems ? "إخفاء البنود التفصيلية" : "+ إضافة بنود تفصيلية (اختياري)"}
        </button>

        {showItems && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {form.items.map((item, iIdx) => (
              <div key={iIdx} style={{ background: "#f9fafb", borderRadius: 10, padding: 12, border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <label style={S.label}>اسم البند *</label>
                    <input style={S.inp} value={item.itemName} placeholder="مثال: طاولة مكتبية"
                      onChange={e => setForm(f => ({ ...f, items: f.items.map((it, ii) => ii === iIdx ? { ...it, itemName: e.target.value } : it) }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={S.label}>الوحدة</label>
                    <input style={S.inp} value={item.unit} placeholder="قطعة"
                      onChange={e => setForm(f => ({ ...f, items: f.items.map((it, ii) => ii === iIdx ? { ...it, unit: e.target.value } : it) }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={S.label}>الكمية</label>
                    <input type="number" style={S.inp} value={item.quantity} placeholder="0"
                      onChange={e => setForm(f => ({ ...f, items: f.items.map((it, ii) => ii === iIdx ? { ...it, quantity: e.target.value } : it) }))} />
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, ii) => ii !== iIdx) }))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px 8px" }}>
                    <X size={14} />
                  </button>
                </div>
                {/* Prices per company */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {form.entries.map((entry, eIdx) => {
                    const priceObj = item.prices.find(p => p.entryIndex === eIdx);
                    return (
                      <div key={eIdx} style={{ minWidth: 110 }}>
                        <label style={{ ...S.label, color: entry.isUs ? GD : "#6b7280" }}>{entry.isUs ? "◀ نحن" : (entry.companyName || `شركة ${eIdx + 1}`)}</label>
                        <input type="number" step="0.001" style={{ ...S.inp, textAlign: "left", direction: "ltr", fontFamily: "monospace" }}
                          value={priceObj?.unitPrice ?? ""}
                          placeholder="سعر/وحدة"
                          onChange={ev => setForm(f => {
                            const newItems = [...f.items];
                            const prices = [...newItems[iIdx].prices];
                            const pi = prices.findIndex(p => p.entryIndex === eIdx);
                            if (ev.target.value) {
                              if (pi >= 0) prices[pi] = { entryIndex: eIdx, unitPrice: ev.target.value };
                              else prices.push({ entryIndex: eIdx, unitPrice: ev.target.value });
                            } else {
                              if (pi >= 0) prices.splice(pi, 1);
                            }
                            newItems[iIdx] = { ...newItems[iIdx], prices };
                            return { ...f, items: newItems };
                          })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { itemName: "", itemType: "", unit: "", quantity: "", prices: [] }] }))}
              style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1.5px dashed #d1d5db", background: "white", cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: "#6b7280" }}>
              <Plus size={12} /> إضافة بند
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button onClick={handleSave} disabled={saveMutation.isPending}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", opacity: saveMutation.isPending ? 0.7 : 1 }}>
          {saveMutation.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
          حفظ الجلسة
        </button>
        <button onClick={() => setEditing(false)}
          style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
