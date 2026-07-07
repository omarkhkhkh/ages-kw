import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guaranteesApi } from "@/lib/api";
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Check, AlertTriangle,
  Download, Search, Landmark, Clock, FileCheck2, Shield, ShieldAlert,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportGuaranteesToExcel } from "@/lib/export";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

/* ─── palette ─── */
const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

/* ─── STATUS ─── */
const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  active:   { label: "فعّالة",       bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  expired:  { label: "منتهية",      bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  released: { label: "مُفرج عنها",  bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
};

/* ─── TYPE TABS ─── */
type TypeTab = "all" | "شيك مصدق" | "ابتدائية" | "نهائية";
interface TypeDef {
  id: TypeTab;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  emptyMsg: string;
}
const TYPE_TABS: TypeDef[] = [
  { id: "all",       label: "الجميع",           icon: ShieldCheck, color: GD,        bg: "#fdf8ec", border: "#f0ead8", emptyMsg: "لا توجد كفالات" },
  { id: "شيك مصدق", label: "شيكات مصدقة",      icon: FileCheck2,  color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", emptyMsg: "لا توجد شيكات مصدقة" },
  { id: "ابتدائية", label: "كفالات أولية",      icon: ShieldAlert, color: "#d97706", bg: "#fffbeb", border: "#fde68a", emptyMsg: "لا توجد كفالات أولية" },
  { id: "نهائية",   label: "كفالات نهائية",     icon: Shield,      color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", emptyMsg: "لا توجد كفالات نهائية" },
];

/* ─── FORM TYPES (all selectable) ─── */
const GUARANTEE_TYPES = ["شيك مصدق", "ابتدائية", "نهائية", "دفعة مقدمة", "ضمان صيانة", "أخرى"];
const emptyForm = {
  tenderId: "", guaranteeNumber: "", type: "",
  bankName: "", amount: "", issueDate: "", expiryDate: "",
  status: "active", notes: "",
};

/* ─── helpers ─── */
function daysLeft(d: string | null): number | null {
  if (!d) return null;
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000);
}

/* ─── shared styles ─── */
const S = {
  page:    { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg,${GL},${GD})`, flexShrink: 0 },
  title:   { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40, backdropFilter: "blur(2px)" },
  drawer:  { position: "fixed" as const, top: 0, right: 0, bottom: 0, width: 500, background: "white", zIndex: 50, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" as const, overflowY: "auto" as const },
  label:   { display: "block", fontSize: 12, fontWeight: 700, color: "#4a3f1a", marginBottom: 5 },
  input:   { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e" },
  select:  { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e", height: 38 },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },
  th:      { padding: "13px 16px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td:      { padding: "12px 16px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
};

/* ════════════════════════════════════════════════════
   GUARANTEE TABLE — shared between tabs
════════════════════════════════════════════════════ */
function GuaranteeTable({
  rows, isLoading, emptyMsg, canEdit, onEdit, onDelete, typeDef,
}: {
  rows: any[]; isLoading: boolean; emptyMsg: string;
  canEdit: boolean; onEdit: (g: any) => void; onDelete: (id: number) => void;
  typeDef: TypeDef;
}) {
  return (
    <div style={{ background: "white", borderRadius: 16, border: `1.5px solid ${typeDef.border}`, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
          <thead style={{ background: typeDef.bg, borderBottom: `1.5px solid ${typeDef.border}` }}>
            <tr>
              {["رقم الكفالة / الشيك", "الجهة / البنك", "الموضوع", "المبلغ (د.ك)", "تاريخ الإصدار", "تاريخ الانتهاء", "الحالة", ""].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} style={S.td}>
                        <div style={{ height: 13, background: "#f3f0e6", borderRadius: 4, width: j === 2 ? 160 : 80, animation: "pulse 1.5s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.length === 0
              ? (
                <tr>
                  <td colSpan={8} style={{ padding: 52, textAlign: "center", color: "#94a3b8" }}>
                    <typeDef.icon size={42} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                    <p style={{ margin: 0, fontSize: 14 }}>{emptyMsg}</p>
                  </td>
                </tr>
              )
              : rows.map((g: any, idx: number) => {
                  const st = STATUS_MAP[g.status] || STATUS_MAP.active;
                  const dl = daysLeft(g.expiryDate);
                  const near = dl !== null && dl >= 0 && dl <= 30 && g.status === "active";
                  const notesShort = g.notes ? g.notes.slice(0, 80) + (g.notes.length > 80 ? "…" : "") : "—";
                  return (
                    <tr key={g.id}
                      style={{ borderBottom: idx < rows.length - 1 ? "1px solid #f5f0e6" : "none", background: near ? "#fffbeb" : "white", transition: "background 0.1s" }}
                      onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = near ? "#fef3c7" : "#fffdf5"}
                      onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = near ? "#fffbeb" : "white"}
                    >
                      {/* number */}
                      <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: "#132a18" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {near && <AlertTriangle size={12} color="#f59e0b" />}
                          {g.guaranteeNumber || `BG-${g.id}`}
                        </div>
                      </td>
                      {/* bank/entity */}
                      <td style={{ ...S.td, color: "#4b5563" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Landmark size={12} color="#9ca3af" />
                          <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{g.bankName || "—"}</span>
                        </div>
                      </td>
                      {/* notes/subject */}
                      <td style={{ ...S.td, color: "#6b7280", fontSize: 11, maxWidth: 260 }}>
                        <span title={g.notes || ""} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notesShort}</span>
                      </td>
                      {/* amount */}
                      <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: typeDef.color, whiteSpace: "nowrap" }}>
                        {g.amount ? formatCurrency(g.amount) : "—"}
                      </td>
                      {/* issue date */}
                      <td style={{ ...S.td, color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(g.issueDate) || "—"}</td>
                      {/* expiry */}
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                        <div style={{ color: near ? "#d97706" : g.status === "expired" ? "#dc2626" : "#4b5563", fontWeight: near ? 700 : 400 }}>
                          {formatDate(g.expiryDate) || "—"}
                          {near && <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 1 }}>بعد {dl} يوم</div>}
                        </div>
                      </td>
                      {/* status */}
                      <td style={S.td}>
                        <span style={{ padding: "3px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.text, border: `1px solid ${st.border}`, whiteSpace: "nowrap" }}>
                          {st.label}
                        </span>
                      </td>
                      {/* actions */}
                      <td style={{ ...S.td, textAlign: "left" }}>
                        {canEdit && (
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button style={S.iconBtn} onClick={() => onEdit(g)}
                              onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                              onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                              <Pencil size={14} color={GD} />
                            </button>
                            <button style={S.iconBtn} onClick={() => { if (confirm("حذف هذا السجل؟")) onDelete(g.id); }}
                              onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fee2e2"}
                              onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                              <Trash2 size={14} color="#dc2626" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>

          {/* footer total */}
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${typeDef.border}`, background: typeDef.bg }}>
                <td colSpan={3} style={{ ...S.td, fontWeight: 800, color: "#374151", fontSize: 12 }}>
                  المجموع ({rows.length} سجل)
                </td>
                <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 900, color: typeDef.color, whiteSpace: "nowrap" }}>
                  {formatCurrency(rows.reduce((s: number, g: any) => s + (Number(g.amount) || 0), 0))}
                </td>
                <td colSpan={4} style={{ ...S.td }}>
                  <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
                    {Object.entries(STATUS_MAP).map(([k, v]) => {
                      const cnt = rows.filter((g: any) => g.status === k).length;
                      if (!cnt) return null;
                      return <span key={k} style={{ color: v.text, fontWeight: 700, background: v.bg, padding: "2px 8px", borderRadius: 8, border: `1px solid ${v.border}` }}>{v.label}: {cnt}</span>;
                    })}
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════ */
export default function GuaranteesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  /* state */
  const [typeTab,     setTypeTab]     = useState<TypeTab>("all");
  const [statusTab,   setStatusTab]   = useState("all");
  const [search,      setSearch]      = useState("");
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<number | null>(null);
  const [form,        setForm]        = useState({ ...emptyForm });
  const [expandNotes, setExpandNotes] = useState<number | null>(null);

  /* data */
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["guarantees"],
    queryFn: () => guaranteesApi.list(),
  });
  const { data: tenders = [] } = useListTenders({});

  const isAdmin    = user?.role === "admin";
  const canEdit    = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  /* mutations */
  const inv = () => qc.invalidateQueries({ queryKey: ["guarantees"] });
  const createM = useMutation({ mutationFn: guaranteesApi.create,                                   onSuccess: () => { inv(); closeForm(); toast({ title: "✅ تم الإضافة بنجاح" }); },              onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => guaranteesApi.update(id, data), onSuccess: () => { inv(); closeForm(); toast({ title: "✅ تم التحديث بنجاح" }); },             onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: guaranteesApi.delete,                                   onSuccess: () => { inv(); toast({ title: "تم الحذف" }); },                                     onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit  = (g: any) => {
    setEditId(g.id);
    setForm({ tenderId: g.tenderId || "", guaranteeNumber: g.guaranteeNumber || "", type: g.type || "", bankName: g.bankName || "", amount: g.amount || "", issueDate: g.issueDate || "", expiryDate: g.expiryDate || "", status: g.status, notes: g.notes || "" });
    setShowForm(true);
  };
  const openAdd = (preType?: string) => {
    closeForm();
    if (preType && preType !== "all") setForm(f => ({ ...f, type: preType }));
    setShowForm(true);
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.type) return;
    const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, amount: form.amount ? Number(form.amount) : null };
    editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data);
  };

  /* derived */
  const allArr = all as any[];

  // filter by type tab
  const byType = typeTab === "all" ? allArr : allArr.filter(g => g.type === typeTab);

  // filter by status tab
  const byStatus = statusTab === "all" ? byType : byType.filter(g => g.status === statusTab);

  // filter by search
  const filtered = byStatus.filter(g =>
    !search ||
    (g.guaranteeNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (g.bankName        || "").toLowerCase().includes(search.toLowerCase()) ||
    (g.notes           || "").toLowerCase().includes(search.toLowerCase())
  );

  // expiring soon across ALL
  const expiring = allArr.filter(g => { const d = daysLeft(g.expiryDate); return d !== null && d >= 0 && d <= 30 && g.status === "active"; });

  const currentTypeDef = TYPE_TABS.find(t => t.id === typeTab)!;

  /* per-type counts for tab badges */
  const countOf = (t: TypeTab) => t === "all" ? allArr.length : allArr.filter(g => g.type === t).length;
  const amountOf = (t: TypeTab) => {
    const src = t === "all" ? allArr : allArr.filter(g => g.type === t);
    return src.filter(g => g.status === "active").reduce((s: number, g: any) => s + (Number(g.amount) || 0), 0);
  };

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={S.accentBar} />
            <h1 style={S.title}>إدارة الكفالات والشيكات</h1>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>متابعة الكفالات البنكية والشيكات المصدقة المرتبطة بالمناقصات</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canDownload && (
            <button onClick={() => exportGuaranteesToExcel(filtered)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "white", color: GD, border: `1.5px solid ${G}66`, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              <Download size={14} /> تصدير
            </button>
          )}
          {canEdit && (
            <button onClick={() => openAdd(typeTab)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${GL},${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` }}>
              <Plus size={14} />
              {typeTab === "شيك مصدق" ? "شيك جديد" : typeTab === "ابتدائية" ? "كفالة أولية جديدة" : typeTab === "نهائية" ? "كفالة نهائية جديدة" : "إضافة جديدة"}
            </button>
          )}
        </div>
      </div>

      {/* ── Expiry alert ── */}
      {expiring.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", background: "#fffbeb", border: "1.5px solid #fbbf24", borderRadius: 14, marginBottom: 18 }}>
          <AlertTriangle size={20} color="#d97706" />
          <div>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14 }}>⚠️ {expiring.length} كفالة/شيك تنتهي خلال 30 يوماً</div>
            <div style={{ fontSize: 11, color: "#a16207", marginTop: 2 }}>{expiring.map((g: any) => `${g.guaranteeNumber || "BG-"+g.id} — ${g.bankName || ""}`).join(" · ")}</div>
          </div>
        </div>
      )}

      {/* ── TYPE TABS (big cards) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {TYPE_TABS.map(t => {
          const Icon  = t.icon;
          const cnt   = countOf(t.id);
          const amt   = amountOf(t.id);
          const active = typeTab === t.id;
          return (
            <button key={t.id} onClick={() => { setTypeTab(t.id); setStatusTab("all"); setSearch(""); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 16, border: `2px solid ${active ? t.color : t.border}`, background: active ? t.bg : "white", cursor: "pointer", fontFamily: "inherit", textAlign: "right", transition: "all 0.15s", boxShadow: active ? `0 4px 18px ${t.color}25` : "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: active ? `${t.color}20` : "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={20} color={active ? t.color : "#9ca3af"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: active ? t.color : "#6b7280", marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 19, fontWeight: 900, color: active ? t.color : "#132a18" }}>{isLoading ? "—" : cnt}</div>
                {amt > 0 && <div style={{ fontSize: 10, color: active ? t.color : "#9ca3af", marginTop: 2, direction: "ltr", textAlign: "right" }}>{formatCurrency(amt)}</div>}
              </div>
              {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* ── Status sub-tabs + Search ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        {/* status pills */}
        <div style={{ display: "flex", gap: 4, background: "white", border: "1.5px solid #f0ead8", borderRadius: 12, padding: "4px 5px" }}>
          {[{ id: "all", label: `الكل (${byType.length})` }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: `${v.label} (${byType.filter(g => g.status === k).length})` }))].map(t => (
            <button key={t.id} onClick={() => setStatusTab(t.id)}
              style={{ padding: "6px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.12s", background: statusTab === t.id ? `${currentTypeDef.color}18` : "transparent", color: statusTab === t.id ? currentTypeDef.color : "#6b7280", fontFamily: "inherit" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", minWidth: 260 }}>
          <Search size={14} color="#9ca3af" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالرقم أو الجهة أو الموضوع..."
            style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1, fontFamily: "inherit" }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
      </div>

      {/* ── Table ── */}
      <GuaranteeTable
        rows={filtered}
        isLoading={isLoading}
        emptyMsg={currentTypeDef.emptyMsg}
        canEdit={canEdit}
        onEdit={openEdit}
        onDelete={id => deleteM.mutate(id)}
        typeDef={currentTypeDef}
      />

      {/* ── Notes expansion panel (click any row note to expand) ── */}

      {/* ── FORM DRAWER ── */}
      {showForm && (
        <>
          <div style={S.overlay} onClick={closeForm} />
          <div style={S.drawer}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0ead8", background: `linear-gradient(135deg,#fffdf5,${currentTypeDef.bg})`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#132a18" }}>
                  {editId ? "✏️ تعديل السجل" : "➕ إضافة كفالة / شيك"}
                </div>
                {!editId && form.type && (
                  <div style={{ fontSize: 12, color: currentTypeDef.color, marginTop: 3, fontWeight: 600 }}>{form.type}</div>
                )}
              </div>
              <button onClick={closeForm} style={S.iconBtn}><X size={18} color="#6b7280" /></button>
            </div>

            <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

                  {/* type */}
                  <div>
                    <label style={S.label}>النوع *</label>
                    <select style={S.select} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} required>
                      <option value="">اختر النوع</option>
                      {GUARANTEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* number */}
                  <div>
                    <label style={S.label}>الرقم المرجعي</label>
                    <input style={S.input} value={form.guaranteeNumber} onChange={e => setForm(p => ({ ...p, guaranteeNumber: e.target.value }))} placeholder="رقم الكفالة أو الشيك" dir="ltr" />
                  </div>

                  {/* tender */}
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={S.label}>المناقصة المرتبطة</label>
                    <select style={S.select} value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))}>
                      <option value="">— غير مرتبط بمناقصة —</option>
                      {(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} — {t.projectName}</option>)}
                    </select>
                  </div>

                  {/* bank */}
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={S.label}>{form.type === "شيك مصدق" ? "البنك المُصدِر" : "الجهة الحكومية / البنك"}</label>
                    <input style={S.input} value={form.bankName} onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))} placeholder={form.type === "شيك مصدق" ? "اسم البنك" : "وزارة التربية / البنك الأهلي..."} />
                  </div>

                  {/* amount */}
                  <div>
                    <label style={S.label}>المبلغ (د.ك)</label>
                    <input style={{ ...S.input, direction: "ltr" }} type="number" step="0.001" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.000" min="0" />
                  </div>

                  {/* status */}
                  <div>
                    <label style={S.label}>الحالة</label>
                    <select style={S.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  {/* issue date */}
                  <div>
                    <label style={S.label}>تاريخ الإصدار</label>
                    <input style={{ ...S.input, direction: "ltr" }} type="date" value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} />
                  </div>

                  {/* expiry date */}
                  <div>
                    <label style={S.label}>تاريخ الانتهاء</label>
                    <input style={{ ...S.input, direction: "ltr" }} type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} />
                  </div>

                  {/* notes */}
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={S.label}>الموضوع / الملاحظات</label>
                    <textarea style={{ ...S.input, height: 90, resize: "vertical" } as any}
                      value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="وصف العقد أو الممارسة المرتبطة..." />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid #f0ead8" }}>
                  <button type="submit" disabled={createM.isPending || updateM.isPending}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${GL},${GD})`, color: "white", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {(createM.isPending || updateM.isPending) ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
                    {editId ? "حفظ التعديلات" : "إضافة"}
                  </button>
                  <button type="button" onClick={closeForm}
                    style={{ background: "transparent", color: "#6b7280", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
