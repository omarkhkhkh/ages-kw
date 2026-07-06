import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractsApi, entitiesApi } from "@/lib/api";
import {
  FileSignature, Plus, Pencil, Trash2, X, Check, Download,
  Building2, Banknote, CalendarDays, CheckCircle2, XCircle, Clock,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportContractsToExcel } from "@/lib/export";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active:     { label: "ساري",    color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
  completed:  { label: "منتهي",  color: "#2563eb", bg: "#eff6ff", icon: Clock        },
  terminated: { label: "مُفسوخ", color: "#dc2626", bg: "#fff1f2", icon: XCircle      },
};

const STAT_CARDS = [
  { id: "all",        label: "جميع العقود",  icon: LayoutGrid,   color: "#64748b", bg: "#f8fafc" },
  { id: "active",     label: "سارية",         icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4" },
  { id: "completed",  label: "منتهية",        icon: Clock,        color: "#2563eb", bg: "#eff6ff" },
  { id: "terminated", label: "مُفسوخة",       icon: XCircle,      color: "#dc2626", bg: "#fff1f2" },
];

const emptyForm = {
  tenderId: "", contractNumber: "", governmentEntityId: "",
  contractValue: "", signDate: "", startDate: "", endDate: "",
  status: "active", notes: "",
};

/* ─── Modal ─── */
function ContractModal({ open, editId, form, setForm, onClose, onSubmit, isPending, entities, tenders }: any) {
  if (!open) return null;

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s,box-shadow 0.15s" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };
  const focus = (e: any) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.15)`; };
  const blur  = (e: any) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; };
  const f = (field: string) => (e: any) => setForm((p: any) => ({ ...p, [field]: e.target.value }));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 700, background: "white", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,0.3),0 0 0 1px rgba(212,165,52,0.15)", overflow: "hidden", animation: "slideUp 0.25s ease", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,165,52,0.2)", border: "1px solid rgba(212,165,52,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileSignature size={20} color={G} />
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 17, fontWeight: 800, margin: 0 }}>{editId ? "تعديل بيانات العقد" : "إضافة عقد جديد"}</h2>
              <p style={{ color: "rgba(212,165,52,0.6)", fontSize: 12, margin: "2px 0 0" }}>{editId ? "قم بتعديل البيانات وحفظها" : "أدخل بيانات العقد الجديد"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Basic info */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>البيانات الأساسية</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={lbl}>رقم العقد <span style={{ color: "#dc2626" }}>*</span></label><input value={form.contractNumber} onChange={f("contractNumber")} placeholder="CONT-2025-001" dir="ltr" required style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>الحالة</label><select value={form.status} onChange={f("status")} style={{ ...inp, height: 42 }} onFocus={focus} onBlur={blur}>{Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label style={lbl}>المناقصة المرتبطة</label><select value={form.tenderId} onChange={f("tenderId")} style={{ ...inp, height: 42 }} onFocus={focus} onBlur={blur}><option value="">— اختر المناقصة —</option>{(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} · {t.projectName}</option>)}</select></div>
              <div><label style={lbl}>الجهة الحكومية</label><select value={form.governmentEntityId} onChange={f("governmentEntityId")} style={{ ...inp, height: 42 }} onFocus={focus} onBlur={blur}><option value="">— اختر الجهة —</option>{(entities as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><label style={lbl}>قيمة العقد (د.ك)</label><input type="number" value={form.contractValue} onChange={f("contractValue")} min="0" dir="ltr" placeholder="0.000" style={inp} onFocus={focus} onBlur={blur} /></div>
            </div>
          </div>
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f0ead8,transparent)", marginBottom: 22 }} />
          {/* Dates */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>التواريخ</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div><label style={lbl}>تاريخ التوقيع</label><input type="date" value={form.signDate} onChange={f("signDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>تاريخ البداية</label><input type="date" value={form.startDate} onChange={f("startDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
              <div><label style={lbl}>تاريخ الانتهاء</label><input type="date" value={form.endDate} onChange={f("endDate")} style={inp} onFocus={focus} onBlur={blur} /></div>
            </div>
          </div>
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f0ead8,transparent)", marginBottom: 22 }} />
          {/* Notes */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>ملاحظات</span>
            </div>
            <textarea value={form.notes} onChange={f("notes")} placeholder="أي ملاحظات إضافية..." rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} onFocus={focus} onBlur={blur} />
          </div>
          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4, borderTop: "1px solid #f5f0e6" }}>
            <button type="submit" disabled={isPending} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 28px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: isPending ? "not-allowed" : "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 6px 20px rgba(212,165,52,0.4)`, opacity: isPending ? 0.7 : 1 }}>
              <Check size={16} />{isPending ? "جارٍ الحفظ..." : (editId ? "حفظ التعديلات" : "إضافة العقد")}
            </button>
            <button type="button" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
              <X size={15} /> إلغاء
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(32px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ContractsList() {
  const { user }  = useAuth();
  const qc        = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [form,     setForm]     = useState({ ...emptyForm });
  const [tab,      setTab]      = useState("all");

  /* fetch all for counts, then filter */
  const { data: allContracts = [] } = useQuery({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list(undefined) });
  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: contracts = [], isLoading } = useQuery({ queryKey: ["contracts", tab], queryFn: () => contractsApi.list(statusFilter) });
  const { data: entities  = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list() });
  const { data: tenders   = [] } = useListTenders({});

  const getCount = (id: string) => {
    if (id === "all") return (allContracts as any[]).length;
    return (allContracts as any[]).filter((c: any) => c.status === id).length;
  };

  const createM = useMutation({ mutationFn: contractsApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); closeForm(); toast({ title: "✅ تم إضافة العقد بنجاح" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => contractsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); closeForm(); toast({ title: "✅ تم تحديث العقد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: contractsApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast({ title: "🗑 تم حذف العقد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit  = (c: any) => { setEditId(c.id); setForm({ tenderId: c.tenderId || "", contractNumber: c.contractNumber, governmentEntityId: c.governmentEntityId || "", contractValue: c.contractValue || "", signDate: c.signDate || "", startDate: c.startDate || "", endDate: c.endDate || "", status: c.status, notes: c.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.contractNumber) return; const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, governmentEntityId: form.governmentEntityId ? Number(form.governmentEntityId) : null, contractValue: form.contractValue ? Number(form.contractValue) : null }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const activeCard = STAT_CARDS.find(c => c.id === tab)!;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      <ContractModal open={showForm} editId={editId} form={form} setForm={setForm} onClose={closeForm} onSubmit={handleSubmit} isPending={createM.isPending || updateM.isPending} entities={entities} tenders={tenders} />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>إدارة العقود</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>اختر تصنيفاً أدناه لعرض العقود</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {(user?.role === "admin" || user?.canDownload) && (
            <button onClick={() => exportContractsToExcel(contracts as any[])} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit", transition: "border-color 0.15s" }} onMouseEnter={e => (e.currentTarget.style.borderColor = G)} onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
              <Download size={15} /> تصدير
            </button>
          )}
          {(user?.role === "admin" || user?.canEdit) && (
            <button onClick={() => { closeForm(); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)`, transition: "transform 0.1s" }} onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")} onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
              <Plus size={15} /> عقد جديد
            </button>
          )}
        </div>
      </div>

      {/* ── Square stat/filter cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
        {STAT_CARDS.map(card => {
          const active = tab === card.id;
          const count  = getCount(card.id);
          return (
            <button key={card.id} onClick={() => setTab(card.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                gap: 14, padding: "20px 20px 18px",
                borderRadius: 18, cursor: "pointer", fontFamily: "inherit",
                textAlign: "right", position: "relative", overflow: "hidden",
                background: active ? card.bg : "white",
                border: active ? `2px solid ${card.color}40` : "1.5px solid #f0ead8",
                boxShadow: active ? `0 6px 24px ${card.color}22` : "0 2px 10px rgba(0,0,0,0.04)",
                transform: active ? "translateY(-2px)" : "translateY(0)",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.09)`; e.currentTarget.style.borderColor = `${card.color}30`; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#f0ead8"; } }}
            >
              {/* Icon */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: active ? `${card.color}18` : `${card.color}0f`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${card.color}${active ? "30" : "18"}`, transition: "all 0.18s" }}>
                <card.icon size={20} color={card.color} strokeWidth={1.8} />
              </div>
              {/* Count & label */}
              <div style={{ width: "100%" }}>
                <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: active ? card.color : "#1e293b", transition: "color 0.18s" }}>{count}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: active ? card.color : "#6b7280", transition: "color 0.18s" }}>{card.label}</div>
              </div>
              {/* Bottom bar */}
              {active && <div style={{ position: "absolute", bottom: 0, right: 0, left: 0, height: 3, borderRadius: "0 0 18px 18px", background: `linear-gradient(90deg,${card.color}40,${card.color},${card.color}40)` }} />}
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", background: "#fdf8ec", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", gap: 8 }}>
          <activeCard.icon size={15} color={activeCard.color} />
          <span style={{ fontSize: 13, fontWeight: 700, color: GR }}>{activeCard.label}</span>
          {!isLoading && <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 700, background: `${activeCard.color}15`, color: activeCard.color, border: `1px solid ${activeCard.color}25`, borderRadius: 20, padding: "2px 10px" }}>{(contracts as any[]).length}</span>}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
            <thead>
              <tr style={{ background: "#fafaf8" }}>
                {[
                  { label: "رقم العقد",      icon: FileSignature },
                  { label: "الجهة الحكومية", icon: Building2     },
                  { label: "المناقصة",        icon: null          },
                  { label: "قيمة العقد",     icon: Banknote      },
                  { label: "تاريخ التوقيع",  icon: CalendarDays  },
                  { label: "تاريخ الانتهاء", icon: CalendarDays  },
                  { label: "الحالة",          icon: null          },
                  { label: "إجراءات",         icon: null          },
                ].map((h, i) => (
                  <th key={i} style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {h.icon && <h.icon size={12} color="#9ca3af" />}
                      {h.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    {[...Array(8)].map((_, j) => <td key={j} style={{ padding: 16 }}><div style={{ height: 14, background: "#f1f5f9", borderRadius: 6, width: 80, animation: "pulse 1.5s infinite" }} /></td>)}
                  </tr>
                ))
              ) : !(contracts as any[]).length ? (
                <tr>
                  <td colSpan={8} style={{ padding: "64px 0", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 72, height: 72, borderRadius: 20, background: "#fdf8ec", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileSignature size={30} color="#e2d5b0" />
                      </div>
                      <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, fontWeight: 600 }}>لا توجد عقود في هذا التصنيف</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (contracts as any[]).map((c: any, idx: number) => {
                  const st = STATUS_MAP[c.status] || STATUS_MAP.active;
                  return (
                    <tr key={c.id}
                      style={{ borderBottom: idx < (contracts as any[]).length - 1 ? "1px solid #f5f0e6" : "none", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fffdf5"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}
                    >
                      <td style={{ padding: "14px 16px" }}><span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: GD }}>{c.contractNumber}</span></td>
                      <td style={{ padding: "14px 16px", color: "#374151", fontSize: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Building2 size={13} color="#9ca3af" />{c.entityName || "—"}</div></td>
                      <td style={{ padding: "14px 16px", fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{c.tenderNumber || "—"}</td>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#374151" }}>{c.contractValue ? formatCurrency(c.contractValue) : "—"}</td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>{formatDate(c.signDate)}</td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>{formatDate(c.endDate)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}22` }}>
                          <st.icon size={11} />{st.label}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {(user?.role === "admin" || user?.canEdit) && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => openEdit(c)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }} onMouseEnter={e => (e.currentTarget.style.background = "#dcfce7")} onMouseLeave={e => (e.currentTarget.style.background = "#f0fdf4")}>
                              <Pencil size={11} /> تعديل
                            </button>
                            <button onClick={() => { if (confirm("هل تريد حذف هذا العقد؟")) deleteM.mutate(c.id); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }} onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")} onMouseLeave={e => (e.currentTarget.style.background = "#fff1f2")}>
                              <Trash2 size={11} /> حذف
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
