import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi } from "@/lib/api";
import { Users, Plus, Pencil, Trash2, X, Check, Download, Search, Phone, Mail, Briefcase, Hash } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportSuppliersToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

const SUPPLIER_TYPES = ["مقاول", "مورد", "استشاري", "مصنّع", "أخرى"];
const emptyForm = { name: "", type: "", contactPerson: "", phone: "", email: "", address: "", specialization: "", commercialRegNo: "", notes: "" };

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "مقاول":    { bg: "#fef3c7", text: "#92400e" },
  "مورد":     { bg: "#dbeafe", text: "#1e40af" },
  "استشاري":  { bg: "#f3e8ff", text: "#6b21a8" },
  "مصنّع":    { bg: "#dcfce7", text: "#166534" },
  "أخرى":    { bg: "#f3f4f6", text: "#374151" },
};

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` },
  btnOutline: { display: "flex", alignItems: "center", gap: 6, background: "white", color: GD, border: `1.5px solid ${G}66`, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", width: 300 },
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

export default function SuppliersList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: suppliers = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });

  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  const createM = useMutation({ mutationFn: suppliersApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); closeForm(); toast({ title: "✅ تم إضافة المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => suppliersApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); closeForm(); toast({ title: "✅ تم تحديث المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: suppliersApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "تم حذف المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit = (s: any) => { setEditId(s.id); setForm({ name: s.name, type: s.type || "", contactPerson: s.contactPerson || "", phone: s.phone || "", email: s.email || "", address: s.address || "", specialization: s.specialization || "", commercialRegNo: s.commercialRegNo || "", notes: s.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.name.trim()) return; editId ? updateM.mutate({ id: editId, data: form }) : createM.mutate(form); };

  const filtered = (suppliers as any[]).filter((s: any) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.specialization || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || s.type === typeFilter;
    return matchSearch && matchType;
  });

  const typeCounts = SUPPLIER_TYPES.reduce((acc, t) => { acc[t] = (suppliers as any[]).filter((s: any) => s.type === t).length; return acc; }, {} as Record<string, number>);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.titleRow}>
            <div style={S.accentBar} />
            <h1 style={S.title}>الموردون والمقاولون</h1>
          </div>
          <p style={S.subtitle}>إدارة الموردين والمقاولين المشاركين في المناقصات</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canDownload && (
            <button style={S.btnOutline} onClick={() => exportSuppliersToExcel(suppliers)}>
              <Download size={15} /> تصدير
            </button>
          )}
          {canEdit && (
            <button style={S.btnPrimary} onClick={() => { closeForm(); setShowForm(true); }}>
              <Plus size={15} /> إضافة مورد
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        {[
          { label: "إجمالي الموردين", value: suppliers.length, color: G },
          ...SUPPLIER_TYPES.slice(0, 3).map((t, i) => ({ label: t, value: typeCounts[t] || 0, color: ["#1d4ed8", "#7c3aed", "#059669"][i] })),
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={17} color={s.color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#132a18" }}>{isLoading ? "—" : s.value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" as const, alignItems: "center" }}>
        <div style={S.searchBar}>
          <Search size={15} color="#9ca3af" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو التخصص..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1 }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
          {["all", ...SUPPLIER_TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1.5px solid", cursor: "pointer", transition: "all 0.15s", borderColor: typeFilter === t ? GD : "#e5dfc8", background: typeFilter === t ? `linear-gradient(135deg, ${GL}33, ${GD}22)` : "white", color: typeFilter === t ? GD : "#6b7280" }}>
              {t === "all" ? "الجميع" : t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableCard}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
            <thead style={S.thead}>
              <tr>
                {["اسم المورد", "النوع", "التخصص", "المسؤول", "الهاتف", "الإيميل", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: j === 0 ? 150 : 90, animation: "pulse 1.5s infinite" }} /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: "center" as const, color: "#94a3b8", fontSize: 14 }}>
                  <Users size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ margin: 0 }}>{search ? "لا نتائج للبحث" : "لا يوجد موردون مسجلون"}</p>
                </td></tr>
              ) : filtered.map((s: any, idx: number) => {
                const tc = TYPE_COLORS[s.type] || { bg: "#f3f4f6", text: "#374151" };
                return (
                  <tr key={s.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f5f0e6" : "none", background: "white", transition: "background 0.1s" }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fffdf5"}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "white"}
                  >
                    <td style={{ ...S.td, fontWeight: 700, color: "#132a18" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Users size={15} color={GD} />
                        </div>
                        <div>
                          <div>{s.name}</div>
                          {s.commercialRegNo && <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace", fontWeight: 400 }}>{s.commercialRegNo}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      {s.type ? <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.text }}>{s.type}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, color: "#4b5563" }}>
                      {s.specialization ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Briefcase size={12} color="#9ca3af" />{s.specialization}</div> : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, color: "#4b5563" }}>{s.contactPerson || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                    <td style={{ ...S.td, color: "#4b5563", direction: "ltr", textAlign: "right" as const }}>
                      {s.phone ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} color="#9ca3af" />{s.phone}</div> : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, color: "#4b5563", direction: "ltr", textAlign: "right" as const }}>
                      {s.email ? (
                        <a href={`mailto:${s.email}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "#2563eb", textDecoration: "none" }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.textDecoration = "underline"}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.textDecoration = "none"}>
                          <Mail size={12} color="#9ca3af" />{s.email}
                        </a>
                      ) : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, textAlign: "left" as const }}>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button style={S.iconBtn} onClick={() => openEdit(s)}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                            <Pencil size={14} color={GD} />
                          </button>
                          <button style={S.iconBtn} onClick={() => { if (confirm("هل تريد حذف هذا المورد؟")) deleteM.mutate(s.id); }}
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
          </table>
        </div>
      </div>

      {/* Drawer */}
      {showForm && (
        <>
          <div style={S.overlay} onClick={closeForm} />
          <div style={S.drawer}>
            <div style={S.drawerHeader}>
              <span style={S.drawerTitle}>{editId ? "✏️ تعديل المورد" : "🏢 مورد جديد"}</span>
              <button onClick={closeForm} style={S.iconBtn}><X size={18} color="#6b7280" /></button>
            </div>
            <div style={S.drawerBody}>
              <form onSubmit={handleSubmit}>
                <div style={S.fieldGrid}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>اسم المورد / الشركة *</label>
                    <input style={S.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الشركة أو المورد" required />
                  </div>
                  <div>
                    <label style={S.label}>النوع</label>
                    <select style={S.select} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                      <option value="">اختر النوع</option>
                      {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>التخصص</label>
                    <input style={S.input} value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} placeholder="مجال العمل" />
                  </div>
                  <div>
                    <label style={S.label}>السجل التجاري</label>
                    <input style={S.input} value={form.commercialRegNo} onChange={e => setForm(p => ({ ...p, commercialRegNo: e.target.value }))} placeholder="رقم السجل" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>الشخص المسؤول</label>
                    <input style={S.input} value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} placeholder="اسم المسؤول" />
                  </div>
                  <div>
                    <label style={S.label}>الهاتف</label>
                    <input style={S.input} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+965 XXXX XXXX" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>البريد الإلكتروني</label>
                    <input style={S.input} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" dir="ltr" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>العنوان</label>
                    <input style={S.input} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="العنوان" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>ملاحظات</label>
                    <textarea style={{ ...S.input, height: 70, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات إضافية" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" style={S.saveBtn} disabled={createM.isPending || updateM.isPending}>
                    <Check size={15} />{editId ? "حفظ التعديلات" : "إضافة المورد"}
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
