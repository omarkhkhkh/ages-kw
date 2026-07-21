import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, X, Loader2, Trash2, Compass, HandHelping,
  FileSearch, Calculator, Send, Trophy, XCircle, Timer, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { opportunitiesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import EntityDirectoryPicker from "@/components/entity-directory-picker";
import { AssignedEmployee } from "@/components/assigned-employee";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

export const OPP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:             { label: "جديدة",            color: "#2563eb", bg: "#eff6ff" },
  researching:     { label: "قيد البحث",        color: "#7c3aed", bg: "#f5f3ff" },
  pending_pricing: { label: "بانتظار التسعير",  color: "#d97706", bg: "#fffbeb" },
  priced:          { label: "تم التسعير",       color: "#0891b2", bg: "#ecfeff" },
  quotation_sent:  { label: "أُرسل العرض",      color: "#0d9488", bg: "#f0fdfa" },
  under_review:    { label: "تحت الدراسة",      color: "#f59e0b", bg: "#fffbeb" },
  won:             { label: "رست علينا",        color: "#16a34a", bg: "#f0fdf4" },
  lost:            { label: "رست على منافس",    color: "#dc2626", bg: "#fff1f2" },
  cancelled:       { label: "أُلغيت",           color: "#6b7280", bg: "#f9fafb" },
  retendered:      { label: "أُعيد الطرح",      color: "#9333ea", bg: "#faf5ff" },
};

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, background: "white", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 5 };

const emptyForm = {
  orderNumber: "", title: "", entityType: "",
  governmentEntityId: null as number | null, departmentId: null as number | null, contactId: null as number | null,
  issueDate: "", submissionDeadline: "", openingDate: "", bondValue: "", isUrgent: false, notes: "",
};

export default function OpportunitiesList() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["opportunities", statusTab],
    queryFn: () => opportunitiesApi.list(statusTab !== "all" ? { status: statusTab } : {}),
    refetchInterval: 15_000, // الفرص الجديدة تظهر للجميع خلال ثوانٍ
  });
  const { data: stats } = useQuery<any>({ queryKey: ["opportunities-stats"], queryFn: () => opportunitiesApi.stats(), refetchInterval: 30_000 });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); qc.invalidateQueries({ queryKey: ["opportunities-stats"] }); };

  const createMut = useMutation({
    mutationFn: (d: any) => opportunitiesApi.create(d),
    onSuccess: (row: any) => { invalidate(); setShowForm(false); setForm({ ...emptyForm }); toast({ title: "✅ أُضيفت الفرصة وأُشعر الفريق" }); navigate(`/opportunities/${row.id}`); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const claimMut = useMutation({
    mutationFn: (id: number) => opportunitiesApi.claim(id),
    onSuccess: (_r, id) => { invalidate(); toast({ title: "✅ استلمت المهمة — بالتوفيق!" }); navigate(`/opportunities/${id}`); },
    onError: (e: any) => { invalidate(); toast({ title: "تعذر الاستلام", description: e.message, variant: "destructive" }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => opportunitiesApi.delete(id),
    onSuccess: invalidate,
  });
  const reassignMut = useMutation({
    mutationFn: ({ id, claimedByUserId }: { id: number; claimedByUserId: number | null }) => opportunitiesApi.update(id, { claimedByUserId }),
    onSuccess: () => { invalidate(); toast({ title: "✅ تم تحديث الموظف المسؤول" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = rows.filter(r =>
    !search || (r.orderNumber ?? "").includes(search) || (r.title ?? "").includes(search) || (r.entityName ?? "").includes(search));

  const unclaimed = rows.filter(r => r.status === "new");

  const CARDS = [
    { label: "فرص جديدة", value: stats?.newCount ?? 0, icon: Compass, color: "#2563eb", bg: "#eff6ff" },
    { label: "قيد البحث", value: stats?.researchingCount ?? 0, icon: FileSearch, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "بانتظار التسعير", value: stats?.pendingPricingCount ?? 0, icon: Calculator, color: "#d97706", bg: "#fffbeb" },
    { label: "عروض مُرسلة", value: stats?.sentCount ?? 0, icon: Send, color: "#0d9488", bg: "#f0fdfa" },
    { label: "رست علينا", value: stats?.wonCount ?? 0, icon: Trophy, color: "#16a34a", bg: "#f0fdf4" },
    { label: "نسبة الفوز", value: `${stats?.winRate ?? 0}%`, icon: Timer, color: G, bg: "#fdf8ec" },
  ];

  const TABS = [
    { id: "all", label: "الجميع" }, { id: "new", label: "جديدة" },
    { id: "researching", label: "قيد البحث" }, { id: "pending_pricing", label: "بانتظار التسعير" },
    { id: "quotation_sent", label: "أُرسل العرض" }, { id: "won", label: "رست علينا" }, { id: "lost", label: "خسارة" },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 4, height: 30, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Compass size={20} color={GD} /> قسم البحث والتسعير
            </h1>
            <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>فرص أوامر الشراء الحكومية — من الاكتشاف حتى الترسية</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${G},${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 12px ${G}44` }}>
          <Plus size={15} /> فرصة شراء جديدة
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {CARDS.map(c => (
          <div key={c.label} style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7280" }}>{c.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <c.icon size={15} color={c.color} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* شريط الفرص الجديدة بانتظار الاستلام */}
      {unclaimed.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "1.5px solid #93c5fd", borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <HandHelping size={16} color="#1d4ed8" />
            <span style={{ fontWeight: 800, color: "#1e40af", fontSize: 13.5 }}>فرص جديدة بانتظار الاستلام ({unclaimed.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {unclaimed.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "white", borderRadius: 10, padding: "10px 14px", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: GD, marginLeft: 8 }}>{o.orderNumber}</span>
                  <span style={{ fontWeight: 700, color: GR }}>{o.title}</span>
                  {o.isUrgent && <span style={{ marginRight: 8, fontSize: 10.5, fontWeight: 800, background: "#ef4444", color: "white", padding: "1px 8px", borderRadius: 99 }}>مستعجل</span>}
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {o.entityName ?? "جهة غير محددة"}{o.submissionDeadline ? ` · آخر تسليم: ${new Date(o.submissionDeadline).toLocaleDateString("ar-KW")}` : ""}
                  </div>
                </div>
                <button onClick={() => claimMut.mutate(o.id)} disabled={claimMut.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#1d4ed8", color: "white", border: "none", borderRadius: 9, padding: "8px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  <HandHelping size={14} /> استلام المهمة
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1.5px solid #e2e8f0", borderRadius: 11, padding: "8px 13px", width: 260 }}>
          <Search size={15} color="#94a3b8" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الأمر أو العنوان أو الجهة..."
            style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setStatusTab(t.id)}
              style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: statusTab === t.id ? GR : "white", color: statusTab === t.id ? "white" : "#64748b", border: `1.5px solid ${statusTab === t.id ? "transparent" : "#e2e8f0"}` }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #eef2f7", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 50, textAlign: "center" }}><Loader2 size={24} color={G} style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 50, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>لا توجد فرص مطابقة</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["رقم الأمر", "العنوان", "الجهة", "آخر تسليم", "الفض", "المسؤول", "الحالة", ""].map(h => (
                    <th key={h} style={{ padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const st = OPP_STATUS[o.status] ?? OPP_STATUS.new;
                  const deadlineSoon = o.submissionDeadline && ["new", "researching", "pending_pricing", "priced"].includes(o.status)
                    && (new Date(o.submissionDeadline).getTime() - Date.now()) / 86_400_000 <= 3;
                  return (
                    <tr key={o.id} onClick={() => navigate(`/opportunities/${o.id}`)}
                      style={{ cursor: "pointer", background: o.isUrgent ? "#fffbeb" : "white", borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: GD, whiteSpace: "nowrap" }}>{o.orderNumber}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: GR, maxWidth: 260 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o.isUrgent && <AlertTriangle size={12} color="#dc2626" style={{ marginLeft: 4, verticalAlign: "middle" }} />}
                          {o.title}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748b", maxWidth: 160 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.entityName ?? "—"}</div></td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: deadlineSoon ? "#dc2626" : "#374151", fontWeight: deadlineSoon ? 800 : 500 }}>
                        {o.submissionDeadline ? new Date(o.submissionDeadline).toLocaleDateString("ar-KW") : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#64748b" }}>{o.openingDate ? new Date(o.openingDate).toLocaleDateString("ar-KW") : "—"}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#64748b" }} onClick={e => e.stopPropagation()}>
                        <AssignedEmployee value={o.claimedByUserId} displayName={o.claimedByName} compact
                          onReassign={(uid) => reassignMut.mutate({ id: o.id, claimedByUserId: uid })} />
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "3px 11px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>{st.label}</span>
                      </td>
                      <td style={{ padding: "10px 14px", width: 40 }}>
                        {isAdmin && (
                          <button onClick={e => { e.stopPropagation(); if (confirm("حذف الفرصة نهائيًا؟")) deleteMut.mutate(o.id); }}
                            style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 8, padding: 5, cursor: "pointer", display: "flex" }}>
                            <Trash2 size={12} color="#dc2626" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create drawer */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(11,26,16,0.55)", display: "flex", justifyContent: "flex-start", backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} dir="rtl" style={{ width: "min(560px, 100vw)", height: "100dvh", background: "white", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ color: "white", fontSize: 15, fontWeight: 800, margin: 0 }}>فرصة شراء جديدة</h2>
              <button onClick={() => setShowForm(false)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} color="white" /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              if (!form.orderNumber.trim() || !form.title.trim()) return;
              createMut.mutate({
                orderNumber: form.orderNumber, title: form.title,
                entityType: form.entityType || null,
                governmentEntityId: form.governmentEntityId, departmentId: form.departmentId, contactId: form.contactId,
                issueDate: form.issueDate || null, submissionDeadline: form.submissionDeadline || null,
                openingDate: form.openingDate || null, bondValue: form.bondValue ? String(form.bondValue) : null,
                isUrgent: form.isUrgent, notes: form.notes || null,
              });
            }} style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>رقم أمر الشراء *</label><input style={inp} value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} required dir="ltr" /></div>
                <div><label style={lbl}>نوع الجهة</label>
                  <select style={{ ...inp, cursor: "pointer" }} value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                    <option value="">— اختر —</option>
                    <option value="وزارة">وزارة</option><option value="هيئة">هيئة</option>
                    <option value="جامعة">جامعة</option><option value="مؤسسة">مؤسسة</option><option value="أخرى">أخرى</option>
                  </select></div>
              </div>
              <div><label style={lbl}>عنوان الأمر *</label><input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div>
                <label style={lbl}>الجهة الحكومية / الإدارة / المسؤول</label>
                <EntityDirectoryPicker
                  value={{ governmentEntityId: form.governmentEntityId, departmentId: form.departmentId, contactId: form.contactId }}
                  onChange={(v: any) => setForm(f => ({
                    ...f,
                    governmentEntityId: v.governmentEntityId != null ? Number(v.governmentEntityId) : null,
                    departmentId: v.departmentId != null ? Number(v.departmentId) : null,
                    contactId: v.contactId != null ? Number(v.contactId) : null,
                  }))}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>تاريخ الإصدار</label><input style={inp} type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} /></div>
                <div><label style={lbl}>آخر موعد للتسليم</label><input style={inp} type="date" value={form.submissionDeadline} onChange={e => setForm(f => ({ ...f, submissionDeadline: e.target.value }))} /></div>
                <div><label style={lbl}>تاريخ الفض</label><input style={inp} type="date" value={form.openingDate} onChange={e => setForm(f => ({ ...f, openingDate: e.target.value }))} /></div>
                <div><label style={lbl}>قيمة الكفالة (د.ك)</label><input style={inp} type="number" step="0.001" value={form.bondValue} onChange={e => setForm(f => ({ ...f, bondValue: e.target.value }))} dir="ltr" /></div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#b91c1c", cursor: "pointer" }}>
                <input type="checkbox" checked={form.isUrgent} onChange={e => setForm(f => ({ ...f, isUrgent: e.target.checked }))} />
                ⚡ حالة استعجال
              </label>
              <div><label style={lbl}>ملاحظات</label><textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>عند الحفظ يصل إشعار فوري لكل أعضاء القسم — بديل رسالة الواتساب — وتظهر الفرصة بانتظار الاستلام. المرفقات والبنود تُضاف من صفحة الفرصة.</p>
              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button type="submit" disabled={createMut.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 24px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit" }}>
                  {createMut.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} إضافة الفرصة
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
