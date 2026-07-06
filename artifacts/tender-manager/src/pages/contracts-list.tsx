import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractsApi, entitiesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileSignature, Plus, Pencil, Trash2, X, Check, Download,
  Building2, Banknote, CalendarDays, CheckCircle2, XCircle, Clock,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportContractsToExcel } from "@/lib/export";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

/* ── brand ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active:     { label: "ساري",    color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
  completed:  { label: "منتهي",  color: "#2563eb", bg: "#eff6ff", icon: Clock        },
  terminated: { label: "مُفسوخ", color: "#dc2626", bg: "#fff1f2", icon: XCircle      },
};

const TABS = [
  { id: "all",       label: "الجميع",  icon: FileSignature, color: "#64748b" },
  { id: "active",    label: "سارية",   icon: CheckCircle2,  color: "#16a34a" },
  { id: "completed", label: "منتهية",  icon: Clock,         color: "#2563eb" },
  { id: "terminated",label: "مُفسوخة", icon: XCircle,       color: "#dc2626" },
];

const emptyForm = {
  tenderId: "", contractNumber: "", governmentEntityId: "",
  contractValue: "", signDate: "", startDate: "", endDate: "",
  status: "active", notes: "",
};

export default function ContractsList() {
  const { user }   = useAuth();
  const qc         = useQueryClient();
  const { toast }  = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [form,     setForm]     = useState({ ...emptyForm });
  const [tab,      setTab]      = useState("all");

  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: contracts = [], isLoading } = useQuery({ queryKey: ["contracts", tab], queryFn: () => contractsApi.list(statusFilter) });
  const { data: entities  = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list() });
  const { data: tenders   = [] } = useListTenders({});

  const createM = useMutation({ mutationFn: contractsApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); closeForm(); toast({ title: "تم إضافة العقد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => contractsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); closeForm(); toast({ title: "تم تحديث العقد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: contractsApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast({ title: "تم حذف العقد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const handleEdit = (c: any) => {
    setEditId(c.id);
    setForm({ tenderId: c.tenderId || "", contractNumber: c.contractNumber, governmentEntityId: c.governmentEntityId || "", contractValue: c.contractValue || "", signDate: c.signDate || "", startDate: c.startDate || "", endDate: c.endDate || "", status: c.status, notes: c.notes || "" });
    setShowForm(true);
  };
  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.contractNumber) return;
    const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, governmentEntityId: form.governmentEntityId ? Number(form.governmentEntityId) : null, contractValue: form.contractValue ? Number(form.contractValue) : null };
    editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data);
  };

  const activeTabCfg = TABS.find(t => t.id === tab)!;

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "9px 12px", borderRadius: 10,
    border: "1.5px solid #e5e7eb", fontSize: 13, color: "#1e2a1e",
    background: "#fafaf8", outline: "none", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>العقود</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
            {isLoading ? "جارٍ التحميل..." : `${(contracts as any[]).length} عقد مسجّل`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {(user?.role === "admin" || user?.canDownload) && (
            <button onClick={() => exportContractsToExcel(contracts as any[])}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit", transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = G)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
            >
              <Download size={15} /> تصدير
            </button>
          )}
          {(user?.role === "admin" || user?.canEdit) && (
            <button onClick={() => { closeForm(); setShowForm(true); }}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}
            >
              <Plus size={15} /> عقد جديد
            </button>
          )}
        </div>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div style={{ background: "white", borderRadius: 18, border: `1.5px solid ${G}30`, boxShadow: `0 8px 32px rgba(212,165,52,0.12)`, overflow: "hidden" }}>
          {/* Form header */}
          <div style={{ padding: "16px 24px", background: "#fdf8ec", borderBottom: `1.5px solid ${G}20`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${G}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileSignature size={18} color={GD} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: GR }}>{editId ? "تعديل العقد" : "عقد جديد"}</span>
            </div>
            <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>رقم العقد *</label>
                <input value={form.contractNumber} onChange={e => setForm(p => ({ ...p, contractNumber: e.target.value }))} placeholder="رقم العقد" dir="ltr" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>الحالة</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...inputStyle, height: 40 }}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>المناقصة</label>
                <select value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))} style={{ ...inputStyle, height: 40 }}>
                  <option value="">اختر المناقصة</option>
                  {(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} - {t.projectName}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>الجهة الحكومية</label>
                <select value={form.governmentEntityId} onChange={e => setForm(p => ({ ...p, governmentEntityId: e.target.value }))} style={{ ...inputStyle, height: 40 }}>
                  <option value="">اختر الجهة</option>
                  {(entities as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>قيمة العقد (د.ك)</label>
                <input type="number" value={form.contractValue} onChange={e => setForm(p => ({ ...p, contractValue: e.target.value }))} min="0" dir="ltr" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>تاريخ التوقيع</label>
                <input type="date" value={form.signDate} onChange={e => setForm(p => ({ ...p, signDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>تاريخ البداية</label>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>تاريخ الانتهاء</label>
                <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>ملاحظات</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={createM.isPending || updateM.isPending}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit" }}>
                <Check size={15} /> حفظ
              </button>
              <button type="button" onClick={closeForm}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
                <X size={15} /> إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "12px 16px", display: "flex", gap: 6, flexWrap: "wrap", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        {TABS.map(t => {
          const active = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: active ? `1.5px solid ${t.color}22` : "1.5px solid transparent", background: active ? `${t.color}12` : "transparent", color: active ? t.color : "#6b7280" }}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {/* Table header bar */}
        <div style={{ padding: "12px 20px", background: "#fdf8ec", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", gap: 8 }}>
          <activeTabCfg.icon size={15} color={activeTabCfg.color} />
          <span style={{ fontSize: 13, fontWeight: 700, color: GR }}>{activeTabCfg.label}</span>
          {!isLoading && (
            <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 700, background: `${activeTabCfg.color}15`, color: activeTabCfg.color, border: `1px solid ${activeTabCfg.color}25`, borderRadius: 20, padding: "2px 10px" }}>
              {(contracts as any[]).length}
            </span>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
            <thead>
              <tr style={{ background: "#fafaf8" }}>
                {[
                  { label: "رقم العقد",       icon: FileSignature },
                  { label: "الجهة الحكومية",  icon: Building2     },
                  { label: "المناقصة",         icon: null          },
                  { label: "قيمة العقد",      icon: Banknote      },
                  { label: "تاريخ التوقيع",   icon: CalendarDays  },
                  { label: "تاريخ الانتهاء",  icon: CalendarDays  },
                  { label: "الحالة",           icon: null          },
                  { label: "إجراءات",          icon: null          },
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
                    {[...Array(8)].map((_, j) => (
                      <td key={j} style={{ padding: 16 }}>
                        <div style={{ height: 14, background: "#f1f5f9", borderRadius: 6, width: 80, animation: "pulse 1.5s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !(contracts as any[]).length ? (
                <tr>
                  <td colSpan={8} style={{ padding: "56px 0", textAlign: "center" }}>
                    <FileSignature size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                    <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 4px", fontWeight: 600 }}>لا توجد عقود مسجّلة</p>
                    <p style={{ color: "#cbd5e1", fontSize: 12, margin: 0 }}>أضف عقداً جديداً بالضغط على "عقد جديد"</p>
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
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: GD }}>{c.contractNumber}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Building2 size={13} color="#9ca3af" />
                          {c.entityName || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
                        {c.tenderNumber || "—"}
                      </td>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#374151" }}>
                        {c.contractValue ? formatCurrency(c.contractValue) : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>{formatDate(c.signDate)}</td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>{formatDate(c.endDate)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: st.bg, color: st.color,
                          border: `1px solid ${st.color}22`,
                        }}>
                          <st.icon size={11} />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {(user?.role === "admin" || user?.canEdit) && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleEdit(c)}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }}>
                              <Pencil size={11} /> تعديل
                            </button>
                            <button onClick={() => { if (confirm("حذف العقد؟")) deleteM.mutate(c.id); }}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}>
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
