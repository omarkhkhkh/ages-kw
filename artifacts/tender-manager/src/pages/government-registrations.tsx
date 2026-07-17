import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark, Plus, Search, Pencil, Trash2, X,
  CheckCircle2, AlertTriangle, AlertCircle, Clock, Bell,
  Calendar, User, Hash, FileText, Paperclip, ExternalLink,
  Upload, Loader2, Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import FileUpload, { objectPathToUrl } from "@/components/file-upload";
import { useUpload } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";
import { CompanyChips } from "@/components/company-switcher";
import LinkedTasks from "@/components/linked-tasks";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const MINISTRIES = [
  "وزارة التربية", "وزارة الكهرباء والماء والطاقة المتجددة",
  "وزارة الصحة", "وزارة الداخلية", "وزارة الدفاع",
  "وزارة الأوقاف والشؤون الإسلامية", "وزارة العدل",
  "وزارة الأشغال العامة", "وزارة المالية", "وزارة الإعلام",
  "وزارة التجارة والصناعة", "الجهاز المركزي للمناقصات العامة",
  "الهيئة العامة للصناعة", "الهيئة العامة للتعليم التطبيقي والتدريب",
  "جامعة الكويت", "الهيئة العامة للرعاية السكنية", "بلدية الكويت",
  "المؤسسة العامة للرعاية السكنية", "المؤسسة العامة للتأمينات الاجتماعية",
  "الهيئة العامة للغذاء والتغذية", "الهيئة العامة للبيئة",
  "الإدارة العامة للجمارك", "قوة الإطفاء العام",
  "الهيئة العامة لشئون ذوي الإعاقة", "الهيئة العامة للزراعة والثروة السمكية",
  "أخرى",
];

function getExpiryStatus(expiryDate: string | null) {
  if (!expiryDate) return { label: "غير محدد", color: "#6b7280", bg: "#f9fafb", dot: "⚪", days: null };
  const diff = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return { label: "منتهي",         color: "#dc2626", bg: "#fff1f2", dot: "🔴", days: diff };
  if (diff <= 30)  return { label: `${diff} يوم`,   color: "#ea580c", bg: "#fff7ed", dot: "🟠", days: diff };
  if (diff <= 90)  return { label: `${diff} يوم`,   color: "#d97706", bg: "#fffbeb", dot: "🟡", days: diff };
  return           { label: `${diff} يوم`,          color: "#16a34a", bg: "#f0fdf4", dot: "🟢", days: diff };
}

const emptyForm = {
  entityName: "", registrationNumber: "", supplierNumber: "",
  fileNumber: "", registrationDate: "", expiryDate: "",
  status: "active", notes: "", responsibleEmployee: "", fileUrl: "",
};

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

const S = {
  label: { fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" } as any,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", background: "white", boxSizing: "border-box" } as any,
  select: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", background: "white", boxSizing: "border-box", cursor: "pointer" } as any,
  td: { padding: "12px 16px", borderBottom: "1px solid #f3f4f6", fontSize: 13, verticalAlign: "middle", textAlign: "right" } as any,
};

/* ── Inline quick-upload button for table rows ── */
function QuickUpload({ id, fileUrl, apiPath, queryKeys, canEdit }: {
  id: number; fileUrl: string | null; apiPath: string; queryKeys: string[][]; canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const patch = useMutation({
    mutationFn: (path: string) => fetch(`${apiPath}/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl: path }),
    }).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(t)))),
    onSuccess: () => queryKeys.forEach(k => qc.invalidateQueries({ queryKey: k })),
    onError: () => toast({ title: "فشل حفظ الملف", description: "تعذّر تحديث السجل، حاول مجدداً.", variant: "destructive" }),
  });

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res: { objectPath: string }) => patch.mutate(res.objectPath),
    onError: () => toast({ title: "فشل رفع الملف", description: "تحقق من حجم الملف (20MB كحد أقصى) ونوعه.", variant: "destructive" }),
  });

  const viewUrl = objectPathToUrl(fileUrl);

  if (isUploading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 7, background: "#fdf8ec", border: "1px solid #f0e4b0", minWidth: 80 }}>
      <Loader2 size={11} color={G} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, background: G, width: `${progress}%`, transition: "width 0.3s" }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {viewUrl && (
        <a href={viewUrl} target="_blank" rel="noreferrer"
          title="عرض الملف"
          style={{ padding: "5px 8px", borderRadius: 7, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", cursor: "pointer" }}>
          <ExternalLink size={12} />
        </a>
      )}
      {canEdit && (
        <>
          <button type="button" title={fileUrl ? "استبدال الملف" : "رفع ملف"}
            onClick={() => inputRef.current?.click()}
            style={{
              padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${fileUrl ? "#e5e7eb" : "rgba(212,165,52,0.5)"}`,
              background: fileUrl ? "white" : "rgba(212,165,52,0.08)",
              color: fileUrl ? "#6b7280" : G,
              display: "flex", alignItems: "center", gap: 4, fontSize: 12,
            }}>
            {fileUrl ? <Upload size={12} /> : <Paperclip size={12} />}
            {fileUrl ? "" : "إرفاق"}
          </button>
          <input ref={inputRef} type="file"
            accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
          />
        </>
      )}
    </div>
  );
}

export default function GovernmentRegistrations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;

  const [search, setSearch]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState({ ...emptyForm });
  const [customEntity, setCustomEntity] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);

  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["companies-list"], queryFn: () => apiFetch("/api/company-documents/companies") });

  useEffect(() => {
    if (activeCompanyId === null && companies.length > 0) setActiveCompanyId(companies[0].id);
    if (activeCompanyId !== null && !companies.some((c: any) => c.id === activeCompanyId)) setActiveCompanyId(companies[0]?.id ?? null);
  }, [companies, activeCompanyId]);

  const { data: stats } = useQuery<any>({
    queryKey: ["gov-reg-stats", activeCompanyId],
    queryFn: () => apiFetch(`/api/government-registrations/stats?companyId=${activeCompanyId}`),
    enabled: !!activeCompanyId,
    refetchInterval: 60000,
  });

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["gov-regs", activeCompanyId, search],
    queryFn: () => apiFetch(`/api/government-registrations?companyId=${activeCompanyId}` + (search ? `&search=${encodeURIComponent(search)}` : "")),
    enabled: !!activeCompanyId,
  });

  const upsert = useMutation({
    mutationFn: (data: any) => editId
      ? apiFetch(`/api/government-registrations/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      : apiFetch("/api/government-registrations",           { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-regs"] }); qc.invalidateQueries({ queryKey: ["gov-reg-stats"] }); closeForm(); },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/government-registrations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-regs"] }); qc.invalidateQueries({ queryKey: ["gov-reg-stats"] }); },
  });

  const openAdd = () => { setEditId(null); setForm({ ...emptyForm }); setCustomEntity(false); setShowForm(true); };
  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({ entityName: r.entityName || "", registrationNumber: r.registrationNumber || "", supplierNumber: r.supplierNumber || "", fileNumber: r.fileNumber || "", registrationDate: r.registrationDate || "", expiryDate: r.expiryDate || "", status: r.status || "active", notes: r.notes || "", responsibleEmployee: r.responsibleEmployee || "", fileUrl: r.fileUrl || "" });
    setCustomEntity(!MINISTRIES.includes(r.entityName));
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    upsert.mutate({
      companyId: activeCompanyId,
      entityName: form.entityName || null, registrationNumber: form.registrationNumber || null,
      supplierNumber: form.supplierNumber || null, fileNumber: form.fileNumber || null,
      registrationDate: form.registrationDate || null, expiryDate: form.expiryDate || null,
      status: form.status, notes: form.notes || null,
      responsibleEmployee: form.responsibleEmployee || null, fileUrl: form.fileUrl || null,
    });
  };

  const alerts = rows.filter(r => {
    if (!r.expiryDate) return false;
    return Math.ceil((new Date(r.expiryDate).getTime() - Date.now()) / 86400000) <= 90;
  }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const statCards = [
    { label: "إجمالي التسجيلات", value: stats?.total      ?? "—", color: "#64748b", bg: "#f8fafc", icon: Landmark },
    { label: "سارية",             value: stats?.active     ?? "—", color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
    { label: "تنتهي خلال 30 يوم",value: stats?.expiring30 ?? "—", color: "#ea580c", bg: "#fff7ed", icon: AlertTriangle },
    { label: "منتهية",            value: stats?.expired    ?? "—", color: "#dc2626", bg: "#fff1f2", icon: AlertCircle },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>تسجيلات الجهات الحكومية</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>تسجيلات الشركة لدى الوزارات والهيئات الحكومية</p>
        </div>
        {canEdit && activeCompanyId && (
          <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}>
            <Plus size={15} /> إضافة تسجيل
          </button>
        )}
      </div>

      {/* Companies */}
      <div style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>الشركات</div>
        <CompanyChips activeId={activeCompanyId} onSelect={setActiveCompanyId} canEdit={canEdit} isAdmin={isAdmin} showDocCount={false} />
      </div>

      {companies.length === 0 ? (
        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", padding: 60, textAlign: "center" }}>
          <Building2 size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.25 }} />
          <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>لا توجد شركات مضافة بعد</p>
          <p style={{ color: "#9ca3af", fontSize: 12.5, margin: 0 }}>أضف شركة من الأعلى لتبدأ بإدارة تسجيلاتها الحكومية</p>
        </div>
      ) : (
      <>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ padding: "16px 18px", borderRadius: 14, border: "1.5px solid #e5e7eb", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <c.icon size={16} color={c.color} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Bell size={16} color="#ea580c" />
            <span style={{ fontWeight: 800, color: "#9a3412", fontSize: 14 }}>تنبيهات التسجيلات ({alerts.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {alerts.slice(0, 8).map(r => {
              const st = getExpiryStatus(r.expiryDate);
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 9, background: "white", border: `1px solid ${st.color}22` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{st.dot}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>{r.entityName}</span>
                    {r.registrationNumber && <span style={{ fontSize: 11, color: "#9ca3af" }}>({r.registrationNumber})</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {r.responsibleEmployee && <span style={{ fontSize: 11, color: "#6b7280" }}>{r.responsibleEmployee}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: st.color, background: st.bg, padding: "2px 10px", borderRadius: 8 }}>
                      {st.days !== null && st.days < 0 ? "منتهي" : `${st.label}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالجهة أو رقم التسجيل أو الموظف..." style={{ ...S.input, border: "none", background: "transparent", flex: 1 }} />
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["الجهة", "رقم التسجيل", "رقم المورد", "تاريخ التسجيل", "تاريخ الانتهاء", "الحالة", "الأيام المتبقية", "المسؤول", ""].map((h, i) => (
                  <th key={i} style={{ ...S.td, fontWeight: 800, fontSize: 12, color: "#374151", borderBottom: "none", background: "transparent", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 40 }}>جاري التحميل...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 48 }}>
                  <Landmark size={36} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                  لا توجد تسجيلات
                </td></tr>
              ) : rows.map(r => {
                const st = getExpiryStatus(r.expiryDate);
                return (
                  <tr key={r.id} style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ ...S.td, fontWeight: 800, color: GR }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14 }}>{st.dot}</span>
                        {r.entityName}
                      </div>
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace", color: G, fontWeight: 700 }}>{r.registrationNumber || "—"}</td>
                    <td style={{ ...S.td, color: "#6b7280", fontFamily: "monospace" }}>{r.supplierNumber || "—"}</td>
                    <td style={{ ...S.td, color: "#6b7280", whiteSpace: "nowrap" }}>{r.registrationDate ? new Date(r.registrationDate).toLocaleDateString("ar-KW") : "—"}</td>
                    <td style={{ ...S.td, color: "#6b7280", whiteSpace: "nowrap" }}>{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString("ar-KW") : "—"}</td>
                    <td style={{ ...S.td }}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>
                        {st.days === null ? "⚪ غير محدد" : st.days < 0 ? "🔴 منتهي" : st.days <= 30 ? "🟠 ينتهي قريباً" : st.days <= 90 ? "🟡 قريب الانتهاء" : "🟢 ساري"}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: st.color, whiteSpace: "nowrap" }}>
                      {st.days === null ? "—" : st.days < 0 ? `انتهى منذ ${Math.abs(st.days)} يوم` : `${st.days} يوم`}
                    </td>
                    <td style={{ ...S.td, color: "#374151" }}>
                      {r.responsibleEmployee ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <User size={12} color="#9ca3af" /> {r.responsibleEmployee}
                        </div>
                      ) : "—"}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <QuickUpload
                          id={r.id}
                          fileUrl={r.fileUrl || null}
                          apiPath="/api/government-registrations"
                          queryKeys={[["gov-regs"], ["gov-reg-stats"]]}
                          canEdit={canEdit}
                        />
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(r)} style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: "inherit" }}>
                              <Pencil size={12} /> تعديل
                            </button>
                            {isAdmin && (
                              <button onClick={() => { if (confirm("هل تريد حذف هذا التسجيل؟")) del.mutate(r.id); }}
                                style={{ padding: "5px 8px", borderRadius: 7, border: "1.5px solid #fee2e2", background: "#fff5f5", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center" }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* ═══ DRAWER ═══ */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }} dir="rtl">
          <div onClick={closeForm} style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ width: 520, background: "white", overflowY: "auto", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(135deg,${GR},#1a3a20)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Landmark size={18} color={G} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{editId ? "تعديل التسجيل" : "إضافة تسجيل جديد"}</span>
              </div>
              <button onClick={closeForm} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "white", display: "flex" }}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1 }}>

              {/* entity */}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>الجهة الحكومية *</label>
                {!customEntity ? (
                  <select required style={S.select} value={form.entityName}
                    onChange={e => { if (e.target.value === "أخرى") { setCustomEntity(true); setForm(p => ({ ...p, entityName: "" })); } else setForm(p => ({ ...p, entityName: e.target.value })); }}>
                    <option value="">— اختر الجهة —</option>
                    {MINISTRIES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input required style={{ ...S.input, flex: 1 }} value={form.entityName} onChange={e => setForm(p => ({ ...p, entityName: e.target.value }))} placeholder="اسم الجهة الحكومية" />
                    <button type="button" onClick={() => { setCustomEntity(false); setForm(p => ({ ...p, entityName: "" })); }}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: "#6b7280" }}>قائمة</button>
                  </div>
                )}
              </div>

              <div>
                <label style={S.label}>رقم التسجيل</label>
                <input style={S.input} value={form.registrationNumber} onChange={e => setForm(p => ({ ...p, registrationNumber: e.target.value }))} placeholder="رقم التسجيل" />
              </div>
              <div>
                <label style={S.label}>رقم المورد</label>
                <input style={S.input} value={form.supplierNumber} onChange={e => setForm(p => ({ ...p, supplierNumber: e.target.value }))} placeholder="رقم المورد (إن وجد)" />
              </div>
              <div>
                <label style={S.label}>رقم الملف</label>
                <input style={S.input} value={form.fileNumber} onChange={e => setForm(p => ({ ...p, fileNumber: e.target.value }))} placeholder="رقم الملف (إن وجد)" />
              </div>
              <div>
                <label style={S.label}>حالة التسجيل</label>
                <select style={S.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">ساري</option>
                  <option value="pending">قيد التجديد</option>
                  <option value="expired">منتهي</option>
                </select>
              </div>
              <div>
                <label style={S.label}><Calendar size={10} style={{ display: "inline" }} /> تاريخ التسجيل</label>
                <input type="date" style={S.input} value={form.registrationDate} onChange={e => setForm(p => ({ ...p, registrationDate: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}><Calendar size={10} style={{ display: "inline" }} /> تاريخ الانتهاء</label>
                <input type="date" style={S.input} value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}><User size={10} style={{ display: "inline" }} /> الموظف المسؤول</label>
                <input style={S.input} value={form.responsibleEmployee} onChange={e => setForm(p => ({ ...p, responsibleEmployee: e.target.value }))} placeholder="اسم الموظف" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}><Paperclip size={10} style={{ display: "inline" }} /> ملف التسجيل المرفق</label>
                <FileUpload
                  objectPath={form.fileUrl || null}
                  onChange={path => setForm(p => ({ ...p, fileUrl: path ?? "" }))}
                  disabled={upsert.isPending}
                />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>ملاحظات</label>
                <textarea style={{ ...S.input, height: 72, resize: "vertical" } as any} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." />
              </div>

              <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 8 }}>
                <button type="button" onClick={closeForm} style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", color: "#374151" }}>إلغاء</button>
                <button type="submit" disabled={upsert.isPending} style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)`, opacity: upsert.isPending ? 0.7 : 1 }}>
                  {upsert.isPending ? "جاري الحفظ..." : (editId ? "حفظ التعديلات" : "إضافة التسجيل")}
                </button>
              </div>
            </form>
            {editId && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1.5px solid #f0ead8" }}>
                <LinkedTasks entityType="governmentRegistration" entityId={editId} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
