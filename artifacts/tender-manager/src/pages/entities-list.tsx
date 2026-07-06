import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entitiesApi } from "@/lib/api";
import { Building2, Plus, Pencil, Trash2, X, Check, Download, Search, Phone, Mail, MapPin, User } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportEntitiesToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

const ENTITY_TYPES = ["وزارة", "هيئة", "شركة حكومية", "جامعة", "أخرى"];
const emptyForm = { name: "", type: "", contactPerson: "", phone: "", email: "", address: "", notes: "" };

const TYPE_COLORS: Record<string, string> = {
  "وزارة":          "#1d4ed8",
  "هيئة":           "#7c3aed",
  "شركة حكومية":    "#0891b2",
  "جامعة":          "#059669",
  "أخرى":           "#6b7280",
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
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: `1.5px solid #e5dfc8`, borderRadius: 12, padding: "8px 14px", width: 280 },
  tableCard: { background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" },
  thead: { background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" },
  th: { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td: { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
  emptyCell: { padding: 48, textAlign: "center" as const, color: "#94a3b8", fontSize: 14 },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40, backdropFilter: "blur(2px)" },
  drawer: { position: "fixed" as const, top: 0, right: 0, bottom: 0, width: 480, background: "white", zIndex: 50, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" as const, overflowY: "auto" as const },
  drawerHeader: { padding: "20px 24px", borderBottom: "1px solid #f0ead8", background: `linear-gradient(135deg, #fffdf5, #fef9ec)`, display: "flex", justifyContent: "space-between", alignItems: "center" },
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

export default function EntitiesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["government-entities"],
    queryFn: () => entitiesApi.list(),
  });

  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  const createM = useMutation({ mutationFn: (d: any) => entitiesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["government-entities"] }); closeForm(); toast({ title: "✅ تم إضافة الجهة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => entitiesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["government-entities"] }); closeForm(); toast({ title: "✅ تم تحديث الجهة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: (id: number) => entitiesApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["government-entities"] }); toast({ title: "تم حذف الجهة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit = (e: any) => { setEditId(e.id); setForm({ name: e.name, type: e.type || "", contactPerson: e.contactPerson || "", phone: e.phone || "", email: e.email || "", address: e.address || "", notes: e.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.name.trim()) return; editId ? updateM.mutate({ id: editId, data: form }) : createM.mutate(form); };
  const f = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase());
  const filtered = (entities as any[]).filter((e: any) => f(e.name) || f(e.type || "") || f(e.contactPerson || ""));

  // stats
  const total = entities.length;
  const typeCount = new Set((entities as any[]).map((e: any) => e.type).filter(Boolean)).size;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.titleRow}>
            <div style={S.accentBar} />
            <h1 style={S.title}>الجهات الحكومية</h1>
          </div>
          <p style={S.subtitle}>إدارة الجهات الحكومية المتعاملة معها في المناقصات</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canDownload && (
            <button style={S.btnOutline} onClick={() => exportEntitiesToExcel(entities)}>
              <Download size={15} /> تصدير
            </button>
          )}
          {canEdit && (
            <button style={S.btnPrimary} onClick={() => { closeForm(); setShowForm(true); }}>
              <Plus size={15} /> إضافة جهة
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" as const }}>
        {[
          { label: "إجمالي الجهات", value: total, icon: Building2, color: G },
          { label: "أنواع مختلفة", value: typeCount, icon: Building2, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "16px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.04)", minWidth: 160 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.icon size={20} color={s.color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#132a18" }}>{isLoading ? "—" : s.value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ ...S.searchBar, marginBottom: 18 }}>
        <Search size={15} color="#9ca3af" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو النوع أو المسؤول..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1 }} />
        {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
      </div>

      {/* Table */}
      <div style={S.tableCard}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
            <thead style={S.thead}>
              <tr>
                {["اسم الجهة", "النوع", "المسؤول", "الهاتف", "البريد الإلكتروني", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: j === 0 ? 140 : 90, animation: "pulse 1.5s infinite" }} /></td>
                  ))}
                </tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={S.emptyCell}>
                  <Building2 size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ margin: 0 }}>{search ? "لا نتائج للبحث" : "لا توجد جهات حكومية مسجلة"}</p>
                </td></tr>
              ) : filtered.map((e: any, idx: number) => (
                <tr key={e.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f5f0e6" : "none", background: "white", transition: "background 0.1s" }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fffdf5"}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "white"}
                >
                  <td style={{ ...S.td, fontWeight: 700, color: "#132a18" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${TYPE_COLORS[e.type] || G}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Building2 size={15} color={TYPE_COLORS[e.type] || G} />
                      </div>
                      {e.name}
                    </div>
                  </td>
                  <td style={S.td}>
                    {e.type ? (
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${TYPE_COLORS[e.type] || G}18`, color: TYPE_COLORS[e.type] || GD, border: `1px solid ${TYPE_COLORS[e.type] || G}33` }}>{e.type}</span>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ ...S.td, color: "#4b5563" }}>
                    {e.contactPerson ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><User size={12} color="#9ca3af" />{e.contactPerson}</div> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ ...S.td, color: "#4b5563", direction: "ltr", textAlign: "right" as const }}>
                    {e.phone ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} color="#9ca3af" />{e.phone}</div> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ ...S.td, color: "#4b5563", fontSize: 12, direction: "ltr", textAlign: "right" as const }}>
                    {e.email ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Mail size={12} color="#9ca3af" />{e.email}</div> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ ...S.td, textAlign: "left" as const }}>
                    {canEdit && (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button style={S.iconBtn} onClick={() => openEdit(e)} title="تعديل"
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                          <Pencil size={14} color={GD} />
                        </button>
                        <button style={S.iconBtn} onClick={() => { if (confirm("هل تريد حذف هذه الجهة؟")) deleteM.mutate(e.id); }} title="حذف"
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fee2e2"}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                          <Trash2 size={14} color="#dc2626" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
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
              <span style={S.drawerTitle}>{editId ? "✏️ تعديل الجهة" : "🏛️ جهة حكومية جديدة"}</span>
              <button onClick={closeForm} style={{ ...S.iconBtn, color: "#6b7280" }}><X size={18} /></button>
            </div>
            <div style={S.drawerBody}>
              <form onSubmit={handleSubmit}>
                <div style={S.fieldGrid}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>اسم الجهة *</label>
                    <input style={S.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الجهة الحكومية" required />
                  </div>
                  <div>
                    <label style={S.label}>نوع الجهة</label>
                    <select style={S.select} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                      <option value="">اختر النوع</option>
                      {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
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
                    <input style={S.input} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="example@gov.kw" dir="ltr" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>العنوان</label>
                    <input style={S.input} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="العنوان" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>ملاحظات</label>
                    <textarea style={{ ...S.input, height: 80, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات إضافية" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" style={S.saveBtn} disabled={createM.isPending || updateM.isPending}>
                    <Check size={15} />{editId ? "حفظ التعديلات" : "إضافة الجهة"}
                  </button>
                  <button type="button" style={S.cancelBtn} onClick={closeForm}>إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}
