import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rfqApi, suppliersApi, companiesApi } from "@/lib/api";
import { ClipboardList, Plus, Pencil, Trash2, X, Check, Search, Clock, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  pending:  { label: "بانتظار الرد",  bg: "#fef9c3", text: "#854d0e", border: "#fde047", icon: Clock },
  received: { label: "تم الاستلام",  bg: "#dcfce7", text: "#166534", border: "#bbf7d0", icon: CheckCircle2 },
  rejected: { label: "مرفوض",        bg: "#fee2e2", text: "#991b1b", border: "#fecaca", icon: XCircle },
};

const emptyForm = { tenderId: "", supplierId: "", companyId: "", rfqNumber: "", itemDescription: "", requestDate: "", responseDeadline: "", quotedPrice: "", status: "pending", notes: "" };

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", width: 280 },
  tableCard: { background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" },
  thead: { background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" },
  th: { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td: { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40, backdropFilter: "blur(2px)" },
  drawer: { position: "fixed" as const, top: 0, right: 0, bottom: 0, width: 500, background: "white", zIndex: 50, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" as const, overflowY: "auto" as const },
  drawerHeader: { padding: "20px 24px", borderBottom: "1px solid #f0ead8", background: "linear-gradient(135deg, #fffdf5, #fef9ec)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  drawerTitle: { fontSize: 17, fontWeight: 800, color: "#132a18" },
  drawerBody: { padding: 24, flex: 1 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#4a3f1a", marginBottom: 5 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e" },
  select: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, background: "white", boxSizing: "border-box" as const, outline: "none", color: "#1e2a1e", height: 38 },
  fieldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  saveBtn: { background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  cancelBtn: { background: "transparent", color: "#6b7280", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },
};

export default function RfqList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const { data: rfqs = [], isLoading } = useQuery({ queryKey: ["rfq-requests"], queryFn: () => rfqApi.list() });
  const { data: tenders = [] } = useListTenders({});
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });
  const { data: companies = [] } = useQuery({ queryKey: ["companies-list"], queryFn: () => companiesApi.list() });

  const createM = useMutation({ mutationFn: rfqApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["rfq-requests"] }); closeForm(); toast({ title: "✅ تم إضافة طلب العرض" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => rfqApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["rfq-requests"] }); closeForm(); toast({ title: "✅ تم تحديث الطلب" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: rfqApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["rfq-requests"] }); toast({ title: "تم حذف الطلب" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit = (r: any) => { setEditId(r.id); setForm({ tenderId: r.tenderId || "", supplierId: r.supplierId || "", companyId: r.companyId || "", rfqNumber: r.rfqNumber || "", itemDescription: r.itemDescription || "", requestDate: r.requestDate || "", responseDeadline: r.responseDeadline || "", quotedPrice: r.quotedPrice || "", status: r.status, notes: r.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.itemDescription.trim()) return; const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, supplierId: form.supplierId ? Number(form.supplierId) : null, companyId: form.companyId ? Number(form.companyId) : null, quotedPrice: form.quotedPrice ? Number(form.quotedPrice) : null }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const filtered = (rfqs as any[]).filter(r => {
    const matchTab = tab === "all" || r.status === tab;
    const matchSearch = !search || (r.rfqNumber || "").includes(search) || (r.itemDescription || "").toLowerCase().includes(search.toLowerCase()) || (r.supplierName || "").includes(search);
    return matchTab && matchSearch;
  });

  const tabs = [{ id: "all", label: "الجميع" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: v.label }))];
  const pending = (rfqs as any[]).filter((r: any) => r.status === "pending").length;
  const received = (rfqs as any[]).filter((r: any) => r.status === "received").length;
  const totalQuoted = (rfqs as any[]).filter((r: any) => r.quotedPrice).reduce((s: number, r: any) => s + Number(r.quotedPrice), 0);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.titleRow}>
            <div style={S.accentBar} />
            <h1 style={S.title}>طلبات عروض الأسعار</h1>
          </div>
          <p style={S.subtitle}>تتبع طلبات الأسعار المرسلة للموردين لكل مناقصة</p>
        </div>
        <button style={S.btnPrimary} onClick={() => { closeForm(); setShowForm(true); }}>
          <Plus size={15} /> طلب عرض جديد
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" as const }}>
        {[
          { label: "إجمالي الطلبات", value: (rfqs as any[]).length, color: G, icon: ClipboardList },
          { label: "بانتظار الرد", value: pending, color: "#d97706", icon: Clock },
          { label: "تم الاستلام", value: received, color: "#059669", icon: CheckCircle2 },
          { label: "إجمالي الأسعار", value: formatCurrency(totalQuoted), color: "#1d4ed8", icon: ClipboardList },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.icon size={17} color={s.color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#132a18" }}>{isLoading ? "—" : s.value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" as const, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "white", border: "1.5px solid #f0ead8", borderRadius: 12, padding: "5px 6px" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.15s", background: tab === t.id ? `linear-gradient(135deg, ${GL}55, ${GD}44)` : "transparent", color: tab === t.id ? GD : "#6b7280" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={S.searchBar}>
          <Search size={15} color="#9ca3af" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الطلب أو الوصف..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1 }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableCard}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
            <thead style={S.thead}>
              <tr>
                {["رقم الطلب", "وصف البند", "المورد", "تاريخ الطلب", "آخر موعد للرد", "السعر المقدم", "الحالة", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(3)].map((_, i) => (
                <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: 80, animation: "pulse 1.5s infinite" }} /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: "center" as const, color: "#94a3b8" }}>
                  <ClipboardList size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ margin: 0 }}>لا توجد طلبات عروض أسعار</p>
                </td></tr>
              ) : filtered.map((r: any, idx: number) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                const overdue = r.responseDeadline && new Date(r.responseDeadline) < new Date() && r.status === "pending";
                return (
                  <tr key={r.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f5f0e6" : "none", background: overdue ? "#fff7ed" : "white", transition: "background 0.1s" }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = overdue ? "#ffedd5" : "#fffdf5"}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = overdue ? "#fff7ed" : "white"}
                  >
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: "#132a18" }}>{r.rfqNumber || `RFQ-${r.id}`}</td>
                    <td style={{ ...S.td, maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontWeight: 600, color: "#132a18" }}>{r.itemDescription}</div>
                    </td>
                    <td style={{ ...S.td, color: "#4b5563" }}>{r.supplierName || "—"}</td>
                    <td style={{ ...S.td, color: "#4b5563", whiteSpace: "nowrap" as const }}>{formatDate(r.requestDate)}</td>
                    <td style={{ ...S.td, color: overdue ? "#c2410c" : "#4b5563", fontWeight: overdue ? 700 : 400, whiteSpace: "nowrap" as const }}>{formatDate(r.responseDeadline)}</td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#132a18" }}>{r.quotedPrice ? formatCurrency(r.quotedPrice) : "—"}</td>
                    <td style={S.td}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.text, border: `1px solid ${st.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <st.icon size={11} /> {st.label}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: "left" as const }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button style={S.iconBtn} onClick={() => openEdit(r)}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                          <Pencil size={14} color={GD} />
                        </button>
                        <button style={S.iconBtn} onClick={() => { if (confirm("حذف هذا الطلب؟")) deleteM.mutate(r.id); }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fee2e2"}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                          <Trash2 size={14} color="#dc2626" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {showForm && (
        <>
          <div style={S.overlay} onClick={closeForm} />
          <div style={S.drawer}>
            <div style={S.drawerHeader}>
              <span style={S.drawerTitle}>{editId ? "✏️ تعديل طلب العرض" : "📋 طلب عرض سعر جديد"}</span>
              <button onClick={closeForm} style={S.iconBtn}><X size={18} color="#6b7280" /></button>
            </div>
            <div style={S.drawerBody}>
              <form onSubmit={handleSubmit}>
                <div style={S.fieldGrid}>
                  <div>
                    <label style={S.label}>المناقصة</label>
                    <select style={S.select} value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))}>
                      <option value="">اختر المناقصة</option>
                      {(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} — {t.projectName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>المورد</label>
                    <select style={S.select} value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))}>
                      <option value="">اختر المورد</option>
                      {(suppliers as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>رقم الطلب</label>
                    <input style={S.input} value={form.rfqNumber} onChange={e => setForm(p => ({ ...p, rfqNumber: e.target.value }))} placeholder="رقم طلب العرض" />
                  </div>
                  <div>
                    <label style={S.label}>الشركة المشاركة</label>
                    <select style={S.select} value={form.companyId} onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))}>
                      <option value="">— بدون —</option>
                      {(companies as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>الحالة</label>
                    <select style={S.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>وصف البند / الخدمة *</label>
                    <textarea style={{ ...S.input, height: 70, resize: "vertical" as const }} value={form.itemDescription} onChange={e => setForm(p => ({ ...p, itemDescription: e.target.value }))} placeholder="وصف البند أو الخدمة المطلوبة" required />
                  </div>
                  <div>
                    <label style={S.label}>تاريخ الطلب</label>
                    <input style={S.input} type="date" value={form.requestDate} onChange={e => setForm(p => ({ ...p, requestDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>آخر موعد للرد</label>
                    <input style={S.input} type="date" value={form.responseDeadline} onChange={e => setForm(p => ({ ...p, responseDeadline: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>السعر المقدم (د.ك)</label>
                    <input style={S.input} type="number" value={form.quotedPrice} onChange={e => setForm(p => ({ ...p, quotedPrice: e.target.value }))} min="0" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>ملاحظات</label>
                    <input style={S.input} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" style={S.saveBtn} disabled={createM.isPending || updateM.isPending}>
                    <Check size={15} />{editId ? "حفظ التعديلات" : "إضافة الطلب"}
                  </button>
                  <button type="button" style={S.cancelBtn} onClick={closeForm}>إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
