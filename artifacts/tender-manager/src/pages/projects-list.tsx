import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, companiesApi } from "@/lib/api";
import { FolderOpen, Plus, Pencil, Trash2, X, Check, Download, Search, TrendingUp, Clock, CheckCircle2, PauseCircle, Mail } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportProjectsToExcel } from "@/lib/export";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";
import CorrespondenceSheet from "@/components/correspondence/correspondence-sheet";
import EntityDirectoryPicker from "@/components/entity-directory-picker";
import LinkedTasks from "@/components/linked-tasks";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  active:    { label: "نشط",    bg: "#dcfce7", text: "#166534", border: "#bbf7d0", icon: TrendingUp },
  completed: { label: "مكتمل", bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe", icon: CheckCircle2 },
  suspended: { label: "موقوف", bg: "#fee2e2", text: "#991b1b", border: "#fecaca", icon: PauseCircle },
};

const emptyForm = { tenderId: "", projectNumber: "", name: "", governmentEntityId: "" as string | number | null, departmentId: "" as string | number | null, contactId: "" as string | number | null, companyId: "", contractValue: "", startDate: "", endDate: "", status: "active", projectManager: "", completionPercentage: "0", notes: "" };

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` },
  btnOutline: { display: "flex", alignItems: "center", gap: 6, background: "white", color: GD, border: `1.5px solid ${G}66`, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", width: 280 },
  tableCard: { background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" },
  thead: { background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" },
  th: { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td: { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40, backdropFilter: "blur(2px)" },
  drawer: { position: "fixed" as const, top: 0, right: 0, bottom: 0, width: 520, background: "white", zIndex: 50, boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" as const, overflowY: "auto" as const },
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

export default function ProjectsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [correspondenceFor, setCorrespondenceFor] = useState<{ id: number; label: string; governmentEntityId: number | null } | null>(null);

  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects", tab], queryFn: () => projectsApi.list(statusFilter) });
  const { data: companies = [] } = useQuery({ queryKey: ["companies-list"], queryFn: () => companiesApi.list() });
  const { data: tenders = [] } = useListTenders({ won: true } as any);

  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  const createM = useMutation({ mutationFn: projectsApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); closeForm(); toast({ title: "✅ تم إضافة المشروع" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => projectsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); closeForm(); toast({ title: "✅ تم تحديث المشروع" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: projectsApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast({ title: "تم حذف المشروع" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit = (p: any) => { setEditId(p.id); setForm({ tenderId: p.tenderId || "", projectNumber: p.projectNumber || "", name: p.name, governmentEntityId: p.governmentEntityId || "", departmentId: p.departmentId || "", contactId: p.contactId || "", companyId: p.companyId || "", contractValue: p.contractValue || "", startDate: p.startDate || "", endDate: p.endDate || "", status: p.status, projectManager: p.projectManager || "", completionPercentage: p.completionPercentage || "0", notes: p.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.name.trim()) return; const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, governmentEntityId: form.governmentEntityId ? Number(form.governmentEntityId) : null, departmentId: form.departmentId ? Number(form.departmentId) : null, contactId: form.contactId ? Number(form.contactId) : null, companyId: form.companyId ? Number(form.companyId) : null, contractValue: form.contractValue ? Number(form.contractValue) : null, completionPercentage: form.completionPercentage ? Number(form.completionPercentage) : 0 }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const filtered = (projects as any[]).filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.projectNumber || "").includes(search) || (p.entityName || "").includes(search));
  const tabs = [{ id: "all", label: "الجميع", count: (projects as any[]).length }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: v.label, count: (projects as any[]).filter((p: any) => p.status === k).length }))];

  // Stats
  const totalValue = (projects as any[]).reduce((sum: number, p: any) => sum + (Number(p.contractValue) || 0), 0);
  const avgCompletion = (projects as any[]).length ? Math.round((projects as any[]).reduce((sum: number, p: any) => sum + (Number(p.completionPercentage) || 0), 0) / (projects as any[]).length) : 0;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.titleRow}>
            <div style={S.accentBar} />
            <h1 style={S.title}>المشاريع</h1>
          </div>
          <p style={S.subtitle}>تتبع المشاريع المنبثقة عن المناقصات الرابحة</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canDownload && (
            <button style={S.btnOutline} onClick={() => exportProjectsToExcel(projects)}>
              <Download size={15} /> تصدير
            </button>
          )}
          {canEdit && (
            <button style={S.btnPrimary} onClick={() => { closeForm(); setShowForm(true); }}>
              <Plus size={15} /> مشروع جديد
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" as const }}>
        {[
          { label: "إجمالي المشاريع", value: (projects as any[]).length, color: G, suffix: "" },
          { label: "نشط", value: (projects as any[]).filter((p: any) => p.status === "active").length, color: "#059669", suffix: "" },
          { label: "قيمة إجمالية", value: formatCurrency(totalValue), color: "#1d4ed8", suffix: "" },
          { label: "متوسط الإنجاز", value: `${avgCompletion}%`, color: "#7c3aed", suffix: "" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderOpen size={17} color={s.color} strokeWidth={1.8} />
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
              {t.label} <span style={{ fontSize: 11, opacity: 0.7 }}>({t.count})</span>
            </button>
          ))}
        </div>
        <div style={S.searchBar}>
          <Search size={15} color="#9ca3af" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الجهة..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1 }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableCard}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
            <thead style={S.thead}>
              <tr>
                {["المشروع", "الجهة", "مدير المشروع", "قيمة العقد", "الإنجاز", "تاريخ الانتهاء", "الحالة", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(3)].map((_, i) => (
                <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: 80, animation: "pulse 1.5s infinite" }} /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: "center" as const, color: "#94a3b8" }}>
                  <FolderOpen size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ margin: 0 }}>لا توجد مشاريع</p>
                </td></tr>
              ) : filtered.map((p: any, idx: number) => {
                const st = STATUS_MAP[p.status] || STATUS_MAP.active;
                const pct = Math.min(100, Math.max(0, Number(p.completionPercentage) || 0));
                const pctColor = pct >= 80 ? "#059669" : pct >= 40 ? G : "#dc2626";
                return (
                  <tr key={p.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f5f0e6" : "none", background: "white", transition: "background 0.1s" }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = "#fffdf5"}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "white"}
                  >
                    <td style={{ ...S.td, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, color: "#132a18" }}>{p.name}</div>
                      {p.projectNumber && <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{p.projectNumber}</div>}
                    </td>
                    <td style={{ ...S.td, color: "#4b5563", maxWidth: 160 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.entityName || "—"}</div></td>
                    <td style={{ ...S.td, color: "#4b5563" }}>{p.projectManager || "—"}</td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#132a18" }}>{p.contractValue ? formatCurrency(p.contractValue) : "—"}</td>
                    <td style={{ ...S.td, minWidth: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "#f3f0e6", borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pctColor, borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pctColor, minWidth: 30 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, color: "#4b5563", whiteSpace: "nowrap" as const }}>{formatDate(p.endDate)}</td>
                    <td style={S.td}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.text, border: `1px solid ${st.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <st.icon size={11} /> {st.label}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: "left" as const }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button style={S.iconBtn} onClick={() => setCorrespondenceFor({ id: p.id, label: p.name, governmentEntityId: p.governmentEntityId ?? null })}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                          <Mail size={14} color={GD} />
                        </button>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                          <button style={S.iconBtn} onClick={() => openEdit(p)}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                            <Pencil size={14} color={GD} />
                          </button>
                          <button style={S.iconBtn} onClick={() => { if (confirm("حذف المشروع؟")) deleteM.mutate(p.id); }}
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
              <span style={S.drawerTitle}>{editId ? "✏️ تعديل المشروع" : "📁 مشروع جديد"}</span>
              <button onClick={closeForm} style={S.iconBtn}><X size={18} color="#6b7280" /></button>
            </div>
            <div style={S.drawerBody}>
              <form onSubmit={handleSubmit}>
                <div style={S.fieldGrid}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>اسم المشروع *</label>
                    <input style={S.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم المشروع" required />
                  </div>
                  <div>
                    <label style={S.label}>رقم المشروع</label>
                    <input style={S.input} value={form.projectNumber} onChange={e => setForm(p => ({ ...p, projectNumber: e.target.value }))} placeholder="رقم المشروع" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>الحالة</label>
                    <select style={S.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>المناقصة المرتبطة</label>
                    <select style={S.select} value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))}>
                      <option value="">اختر المناقصة</option>
                      {(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} — {t.projectName}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>الجهة الحكومية ← الاختصاص ← المسؤول</label>
                    <EntityDirectoryPicker
                      value={{ governmentEntityId: form.governmentEntityId, departmentId: form.departmentId, contactId: form.contactId }}
                      onChange={next => setForm(p => ({ ...p, ...next }))}
                    />
                  </div>
                  <div>
                    <label style={S.label}>الشركة المشاركة</label>
                    <select style={S.select} value={form.companyId} onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))}>
                      <option value="">— بدون —</option>
                      {(companies as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>قيمة العقد (د.ك)</label>
                    <input style={S.input} type="number" value={form.contractValue} onChange={e => setForm(p => ({ ...p, contractValue: e.target.value }))} min="0" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>مدير المشروع</label>
                    <input style={S.input} value={form.projectManager} onChange={e => setForm(p => ({ ...p, projectManager: e.target.value }))} placeholder="اسم مدير المشروع" />
                  </div>
                  <div>
                    <label style={S.label}>تاريخ البداية</label>
                    <input style={S.input} type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>تاريخ الانتهاء</label>
                    <input style={S.input} type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>نسبة الإنجاز ({form.completionPercentage}%)</label>
                    <input style={S.input} type="range" value={form.completionPercentage} onChange={e => setForm(p => ({ ...p, completionPercentage: e.target.value }))} min="0" max="100" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>ملاحظات</label>
                    <textarea style={{ ...S.input, height: 70, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" style={S.saveBtn} disabled={createM.isPending || updateM.isPending}>
                    <Check size={15} />{editId ? "حفظ التعديلات" : "إضافة المشروع"}
                  </button>
                  <button type="button" style={S.cancelBtn} onClick={closeForm}>إلغاء</button>
                </div>
              </form>
              {editId && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1.5px solid #f0ead8" }}>
                  <LinkedTasks entityType="project" entityId={editId} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {correspondenceFor && (
        <CorrespondenceSheet
          open={!!correspondenceFor}
          onOpenChange={(o) => !o && setCorrespondenceFor(null)}
          sourceType="project"
          sourceId={correspondenceFor.id}
          recordLabel={correspondenceFor.label}
          governmentEntityId={correspondenceFor.governmentEntityId}
        />
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
