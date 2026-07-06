import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guaranteesApi } from "@/lib/api";
import { ShieldCheck, Plus, Pencil, Trash2, X, Check, AlertTriangle, Download, Search, Landmark, Clock } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportGuaranteesToExcel } from "@/lib/export";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  active:   { label: "فعّالة",      bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  expired:  { label: "منتهية",     bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  released: { label: "مُفرج عنها", bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
};

const GUARANTEE_TYPES = ["ابتدائية", "نهائية", "دفعة مقدمة", "ضمان صيانة", "أخرى"];
const emptyForm = { tenderId: "", guaranteeNumber: "", type: "", bankName: "", amount: "", issueDate: "", expiryDate: "", status: "active", notes: "" };

function daysLeft(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.round((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

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

export default function GuaranteesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: guarantees = [], isLoading } = useQuery({ queryKey: ["guarantees", tab], queryFn: () => guaranteesApi.list(statusFilter) });
  const { data: tenders = [] } = useListTenders({});

  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;
  const canDownload = isAdmin || !!user?.canDownload;

  const createM = useMutation({ mutationFn: guaranteesApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantees"] }); closeForm(); toast({ title: "✅ تم إضافة الكفالة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => guaranteesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantees"] }); closeForm(); toast({ title: "✅ تم تحديث الكفالة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: guaranteesApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantees"] }); toast({ title: "تم حذف الكفالة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const openEdit = (g: any) => { setEditId(g.id); setForm({ tenderId: g.tenderId || "", guaranteeNumber: g.guaranteeNumber || "", type: g.type || "", bankName: g.bankName || "", amount: g.amount || "", issueDate: g.issueDate || "", expiryDate: g.expiryDate || "", status: g.status, notes: g.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.type) return; const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, amount: form.amount ? Number(form.amount) : null }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const filtered = (guarantees as any[]).filter(g => !search || (g.guaranteeNumber || "").includes(search) || (g.bankName || "").toLowerCase().includes(search.toLowerCase()) || (g.type || "").includes(search));
  const expiring = (guarantees as any[]).filter((g: any) => { const d = daysLeft(g.expiryDate); return d !== null && d > 0 && d <= 30 && g.status === "active"; });
  const tabs = [{ id: "all", label: "الجميع" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: v.label }))];
  const totalAmount = (guarantees as any[]).filter((g: any) => g.status === "active").reduce((sum: number, g: any) => sum + (Number(g.amount) || 0), 0);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.titleRow}>
            <div style={S.accentBar} />
            <h1 style={S.title}>الكفالات البنكية</h1>
          </div>
          <p style={S.subtitle}>إدارة الكفالات البنكية المرتبطة بالمناقصات</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canDownload && (
            <button style={S.btnOutline} onClick={() => exportGuaranteesToExcel(guarantees as any[])}>
              <Download size={15} /> تصدير
            </button>
          )}
          {canEdit && (
            <button style={S.btnPrimary} onClick={() => { closeForm(); setShowForm(true); }}>
              <Plus size={15} /> كفالة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" as const }}>
        {[
          { label: "إجمالي الكفالات", value: (guarantees as any[]).length, color: G, icon: ShieldCheck },
          { label: "فعّالة", value: (guarantees as any[]).filter((g: any) => g.status === "active").length, color: "#059669", icon: ShieldCheck },
          { label: "قيمة الفعّالة", value: formatCurrency(totalAmount), color: "#1d4ed8", icon: Landmark },
          { label: "تنتهي قريباً", value: expiring.length, color: "#f59e0b", icon: Clock },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: `1.5px solid ${s.label === "تنتهي قريباً" && expiring.length > 0 ? "#fbbf24" : "#f0ead8"}`, borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.icon size={17} color={s.color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.label === "تنتهي قريباً" && expiring.length > 0 ? "#92400e" : "#132a18" }}>{isLoading ? "—" : s.value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Expiry alert */}
      {expiring.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "#fffbeb", border: "1.5px solid #fbbf24", borderRadius: 14, marginBottom: 18, animation: "pulse-amber 2s infinite" }}>
          <AlertTriangle size={20} color="#d97706" />
          <div>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14 }}>⚠️ تنبيه: {expiring.length} كفالة تنتهي خلال 30 يوماً</div>
            <div style={{ fontSize: 12, color: "#a16207", marginTop: 2 }}>{expiring.map((g: any) => `${g.bankName || "بنك"} (${g.type})`).join(" — ")}</div>
          </div>
        </div>
      )}

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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الكفالة أو البنك..." style={{ border: "none", outline: "none", fontSize: 13, color: "#1e2a1e", background: "transparent", flex: 1 }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableCard}>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 13, textAlign: "right" as const }}>
            <thead style={S.thead}>
              <tr>
                {["رقم الكفالة", "النوع", "البنك", "المناقصة", "المبلغ", "تاريخ الانتهاء", "الحالة", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(3)].map((_, i) => (
                <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} style={S.td}><div style={{ height: 14, background: "#f3f0e6", borderRadius: 4, width: 80, animation: "pulse 1.5s infinite" }} /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: "center" as const, color: "#94a3b8" }}>
                  <ShieldCheck size={40} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                  <p style={{ margin: 0 }}>لا توجد كفالات بنكية</p>
                </td></tr>
              ) : filtered.map((g: any, idx: number) => {
                const st = STATUS_MAP[g.status] || STATUS_MAP.active;
                const dl = daysLeft(g.expiryDate);
                const nearExpiry = dl !== null && dl > 0 && dl <= 30 && g.status === "active";
                return (
                  <tr key={g.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f5f0e6" : "none", background: nearExpiry ? "#fffbeb" : "white", transition: "background 0.1s" }}
                    onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = nearExpiry ? "#fef3c7" : "#fffdf5"}
                    onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = nearExpiry ? "#fffbeb" : "white"}
                  >
                    <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: "#132a18" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {nearExpiry && <AlertTriangle size={13} color="#f59e0b" />}
                        {g.guaranteeNumber || `BG-${g.id}`}
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${G}18`, color: GD }}>{g.type || "—"}</span>
                    </td>
                    <td style={{ ...S.td, color: "#4b5563" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Landmark size={12} color="#9ca3af" />
                        {g.bankName || "—"}
                      </div>
                    </td>
                    <td style={{ ...S.td, color: "#4b5563", fontSize: 11 }}>{g.projectName || "—"}</td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#132a18" }}>{g.amount ? formatCurrency(g.amount) : "—"}</td>
                    <td style={{ ...S.td, whiteSpace: "nowrap" as const }}>
                      <div style={{ color: nearExpiry ? "#d97706" : "#4b5563", fontWeight: nearExpiry ? 700 : 400 }}>
                        {formatDate(g.expiryDate)}
                        {nearExpiry && <div style={{ fontSize: 10, color: "#f59e0b" }}>بعد {dl} يوم</div>}
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>{st.label}</span>
                    </td>
                    <td style={{ ...S.td, textAlign: "left" as const }}>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button style={S.iconBtn} onClick={() => openEdit(g)}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = `${G}18`}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}>
                            <Pencil size={14} color={GD} />
                          </button>
                          <button style={S.iconBtn} onClick={() => { if (confirm("حذف الكفالة؟")) deleteM.mutate(g.id); }}
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
              <span style={S.drawerTitle}>{editId ? "✏️ تعديل الكفالة" : "🛡️ كفالة بنكية جديدة"}</span>
              <button onClick={closeForm} style={S.iconBtn}><X size={18} color="#6b7280" /></button>
            </div>
            <div style={S.drawerBody}>
              <form onSubmit={handleSubmit}>
                <div style={S.fieldGrid}>
                  <div>
                    <label style={S.label}>نوع الكفالة *</label>
                    <select style={S.select} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} required>
                      <option value="">اختر النوع</option>
                      {GUARANTEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>رقم الكفالة</label>
                    <input style={S.input} value={form.guaranteeNumber} onChange={e => setForm(p => ({ ...p, guaranteeNumber: e.target.value }))} placeholder="رقم الكفالة" dir="ltr" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>المناقصة المرتبطة</label>
                    <select style={S.select} value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))}>
                      <option value="">اختر المناقصة</option>
                      {(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} — {t.projectName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>اسم البنك</label>
                    <input style={S.input} value={form.bankName} onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))} placeholder="اسم البنك" />
                  </div>
                  <div>
                    <label style={S.label}>المبلغ (د.ك)</label>
                    <input style={S.input} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} min="0" dir="ltr" />
                  </div>
                  <div>
                    <label style={S.label}>الحالة</label>
                    <select style={S.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>تاريخ الإصدار</label>
                    <input style={S.input} type="date" value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>تاريخ الانتهاء</label>
                    <input style={S.input} type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>ملاحظات</label>
                    <textarea style={{ ...S.input, height: 70, resize: "vertical" as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button type="submit" style={S.saveBtn} disabled={createM.isPending || updateM.isPending}>
                    <Check size={15} />{editId ? "حفظ التعديلات" : "إضافة الكفالة"}
                  </button>
                  <button type="button" style={S.cancelBtn} onClick={closeForm}>إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes pulse-amber{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,0.3)}50%{box-shadow:0 0 0 6px rgba(251,191,36,0)}}`}</style>
    </div>
  );
}
