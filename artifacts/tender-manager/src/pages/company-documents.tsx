import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileCheck, Plus, Search, Pencil, Trash2, X,
  CheckCircle2, AlertTriangle, Clock, AlertCircle, ExternalLink,
  FileText, Calendar, User, Building2, Hash, Bell, Paperclip,
  Upload, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import FileUpload, { objectPathToUrl } from "@/components/file-upload";
import { useUpload } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";
import { CompanyChips } from "@/components/company-switcher";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

/* ── expiry status ── */
function getExpiryStatus(expiryDate: string | null) {
  if (!expiryDate) return { label: "غير محدد", color: "#6b7280", bg: "#f9fafb", dot: "⚪", days: null };
  const diff = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return { label: "منتهية",          color: "#dc2626", bg: "#fff1f2", dot: "🔴", days: diff };
  if (diff <= 30)  return { label: `${diff} يوم`,     color: "#ea580c", bg: "#fff7ed", dot: "🟠", days: diff };
  if (diff <= 90)  return { label: `${diff} يوم`,     color: "#d97706", bg: "#fffbeb", dot: "🟡", days: diff };
  return           { label: `${diff} يوم`,            color: "#16a34a", bg: "#f0fdf4", dot: "🟢", days: diff };
}

const PREDEFINED = [
  "الرخصة التجارية", "الرخصة", "السجل التجاري", "شهادة غرفة التجارة",
  "اعتماد التوقيع", "الوكالات التجارية", "شهادة الزكاة والضريبة", "الضريبة",
  "شهادة الجودة ISO", "عقد التأسيس", "النظام الأساسي",
  "نسبة العمالة", "المعلومات المدنية", "شهادة الجهاز المركزي",
  "براءة ذمة الكهرباء",
  "أخرى",
];

const emptyForm = {
  name: "", documentNumber: "", issuingBody: "",
  issueDate: "", expiryDate: "", fileUrl: "",
  notes: "", responsibleEmployee: "",
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

export default function CompanyDocuments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;

  const [search, setSearch]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]    = useState<number | null>(null);
  const [form, setForm]        = useState({ ...emptyForm });
  const [customName, setCustomName] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);

  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["companies-list"], queryFn: () => apiFetch("/api/company-documents/companies") });

  useEffect(() => {
    if (activeCompanyId === null && companies.length > 0) setActiveCompanyId(companies[0].id);
    if (activeCompanyId !== null && !companies.some((c: any) => c.id === activeCompanyId)) setActiveCompanyId(companies[0]?.id ?? null);
  }, [companies, activeCompanyId]);

  const { data: stats } = useQuery<any>({
    queryKey: ["company-docs-stats", activeCompanyId],
    queryFn: () => apiFetch(`/api/company-documents/stats?companyId=${activeCompanyId}`),
    enabled: !!activeCompanyId,
    refetchInterval: 60000,
  });

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["company-docs", activeCompanyId, search],
    queryFn: () => apiFetch(`/api/company-documents?companyId=${activeCompanyId}` + (search ? `&search=${encodeURIComponent(search)}` : "")),
    enabled: !!activeCompanyId,
  });

  const upsert = useMutation({
    mutationFn: (data: any) => editId
      ? apiFetch(`/api/company-documents/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      : apiFetch("/api/company-documents",           { method: "POST",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-docs"] }); qc.invalidateQueries({ queryKey: ["company-docs-stats"] }); qc.invalidateQueries({ queryKey: ["companies-list"] }); closeForm(); },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/company-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-docs"] }); qc.invalidateQueries({ queryKey: ["company-docs-stats"] }); qc.invalidateQueries({ queryKey: ["companies-list"] }); },
  });

  const openAdd  = () => { setEditId(null); setForm({ ...emptyForm }); setCustomName(false); setShowForm(true); };
  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({ name: d.name || "", documentNumber: d.documentNumber || "", issuingBody: d.issuingBody || "", issueDate: d.issueDate || "", expiryDate: d.expiryDate || "", fileUrl: d.fileUrl || "", notes: d.notes || "", responsibleEmployee: d.responsibleEmployee || "" });
    setCustomName(!PREDEFINED.includes(d.name));
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    upsert.mutate({
      companyId: activeCompanyId,
      name: form.name || null, documentNumber: form.documentNumber || null,
      issuingBody: form.issuingBody || null, issueDate: form.issueDate || null,
      expiryDate: form.expiryDate || null, fileUrl: form.fileUrl || null,
      notes: form.notes || null, responsibleEmployee: form.responsibleEmployee || null,
    });
  };

  /* alerts: docs expiring ≤ 90 days or expired */
  const alerts = rows.filter(d => {
    if (!d.expiryDate) return false;
    const diff = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86400000);
    return diff <= 90;
  }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const statCards = [
    { label: "إجمالي الوثائق",          value: stats?.total      ?? "—", color: "#64748b", bg: "#f8fafc", icon: FileCheck },
    { label: "سارية المفعول",            value: stats?.active     ?? "—", color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
    { label: "تنتهي خلال 90 يوم",       value: (stats?.expiring90 ?? 0) + (stats?.expiring30 ?? 0), color: "#d97706", bg: "#fffbeb", icon: Clock },
    { label: "تنتهي خلال 30 يوم",       value: stats?.expiring30 ?? "—", color: "#ea580c", bg: "#fff7ed", icon: AlertTriangle },
    { label: "منتهية",                   value: stats?.expired    ?? "—", color: "#dc2626", bg: "#fff1f2", icon: AlertCircle },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>وثائق الشركة الرسمية</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>تتبع صلاحية التراخيص والشهادات الرسمية</p>
        </div>
        {canEdit && activeCompanyId && (
          <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}>
            <Plus size={15} /> إضافة وثيقة
          </button>
        )}
      </div>

      {/* Companies */}
      <div style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>الشركات</div>
        <CompanyChips activeId={activeCompanyId} onSelect={setActiveCompanyId} canEdit={canEdit} isAdmin={isAdmin} />
      </div>

      {companies.length === 0 ? (
        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", padding: 60, textAlign: "center" }}>
          <Building2 size={40} style={{ margin: "0 auto 12px", display: "block", opacity: 0.25 }} />
          <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>لا توجد شركات مضافة بعد</p>
          <p style={{ color: "#9ca3af", fontSize: 12.5, margin: 0 }}>أضف شركة من الأعلى لتبدأ بإدارة وثائقها الرسمية</p>
        </div>
      ) : (
      <>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ padding: "16px 18px", borderRadius: 14, border: "1.5px solid #e5e7eb", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <c.icon size={16} color={c.color} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts panel */}
      {alerts.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Bell size={16} color="#d97706" />
            <span style={{ fontWeight: 800, color: "#92400e", fontSize: 14 }}>تنبيهات الوثائق ({alerts.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {alerts.map(d => {
              const st = getExpiryStatus(d.expiryDate);
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 9, background: "white", border: `1px solid ${st.color}22` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{st.dot}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: st.color, background: st.bg, padding: "2px 10px", borderRadius: 8 }}>
                    {st.days !== null && st.days < 0 ? "منتهية" : `تنتهي خلال ${st.label}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم أو الجهة أو الموظف..." style={{ ...S.input, border: "none", background: "transparent", flex: 1 }} />
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["الوثيقة", "رقم الوثيقة", "الجهة المصدرة", "تاريخ الإصدار", "تاريخ الانتهاء", "الحالة", "الأيام المتبقية", "المسؤول", ""].map((h, i) => (
                  <th key={i} style={{ ...S.td, fontWeight: 800, fontSize: 12, color: "#374151", borderBottom: "none", background: "transparent", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 40 }}>جاري التحميل...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 48 }}>
                  <FileCheck size={36} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                  لا توجد وثائق
                </td></tr>
              ) : rows.map(d => {
                const st = getExpiryStatus(d.expiryDate);
                return (
                  <tr key={d.id} style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ ...S.td, fontWeight: 800, color: GR }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{st.dot}</span>
                        {d.name}
                      </div>
                    </td>
                    <td style={{ ...S.td, fontFamily: "monospace", color: G, fontWeight: 700 }}>{d.documentNumber || "—"}</td>
                    <td style={{ ...S.td, color: "#374151" }}>{d.issuingBody || "—"}</td>
                    <td style={{ ...S.td, color: "#6b7280", whiteSpace: "nowrap" }}>{d.issueDate ? new Date(d.issueDate).toLocaleDateString("ar-KW") : "—"}</td>
                    <td style={{ ...S.td, color: "#6b7280", whiteSpace: "nowrap" }}>{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString("ar-KW") : "—"}</td>
                    <td style={{ ...S.td }}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>
                        {st.days !== null && st.days < 0 ? "🔴 منتهية" : st.days !== null && st.days <= 30 ? "🟠 تنتهي قريباً" : st.days !== null && st.days <= 90 ? "🟡 قريب الانتهاء" : "🟢 سارية"}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: st.color, whiteSpace: "nowrap" }}>
                      {st.days === null ? "—" : st.days < 0 ? `انتهت منذ ${Math.abs(st.days)} يوم` : `${st.days} يوم`}
                    </td>
                    <td style={{ ...S.td, color: "#374151" }}>
                      {d.responsibleEmployee ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <User size={12} color="#9ca3af" /> {d.responsibleEmployee}
                        </div>
                      ) : "—"}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "nowrap" }} >
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <QuickUpload
                          id={d.id}
                          fileUrl={d.fileUrl || null}
                          apiPath="/api/company-documents"
                          queryKeys={[["company-docs"], ["company-docs-stats"]]}
                          canEdit={canEdit}
                        />
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(d)} style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: "inherit" }}>
                              <Pencil size={12} /> تعديل
                            </button>
                            {isAdmin && (
                              <button onClick={() => { if (confirm("هل تريد حذف هذه الوثيقة؟")) del.mutate(d.id); }}
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
          <div style={{ width: 500, background: "white", overflowY: "auto", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(135deg,${GR},#1a3a20)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FileCheck size={18} color={G} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{editId ? "تعديل الوثيقة" : "إضافة وثيقة جديدة"}</span>
              </div>
              <button onClick={closeForm} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "white", display: "flex" }}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1 }}>

              {/* name */}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>اسم الوثيقة *</label>
                {!customName ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <select required style={{ ...S.select, flex: 1 }} value={form.name}
                      onChange={e => { if (e.target.value === "أخرى") { setCustomName(true); setForm(p => ({ ...p, name: "" })); } else setForm(p => ({ ...p, name: e.target.value })); }}>
                      <option value="">— اختر نوع الوثيقة —</option>
                      {PREDEFINED.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input required style={{ ...S.input, flex: 1 }} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الوثيقة" />
                    <button type="button" onClick={() => { setCustomName(false); setForm(p => ({ ...p, name: "" })); }}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 11, fontFamily: "inherit", color: "#6b7280" }}>قائمة</button>
                  </div>
                )}
              </div>

              <div>
                <label style={S.label}><Hash size={10} style={{ display: "inline" }} /> رقم الوثيقة</label>
                <input style={S.input} value={form.documentNumber} onChange={e => setForm(p => ({ ...p, documentNumber: e.target.value }))} placeholder="رقم الوثيقة" />
              </div>
              <div>
                <label style={S.label}><Building2 size={10} style={{ display: "inline" }} /> الجهة المصدرة</label>
                <input style={S.input} value={form.issuingBody} onChange={e => setForm(p => ({ ...p, issuingBody: e.target.value }))} placeholder="مثال: وزارة التجارة" />
              </div>
              <div>
                <label style={S.label}><Calendar size={10} style={{ display: "inline" }} /> تاريخ الإصدار</label>
                <input type="date" style={S.input} value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} />
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
                <label style={S.label}><Paperclip size={10} style={{ display: "inline" }} /> الملف المرفق</label>
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
                  {upsert.isPending ? "جاري الحفظ..." : (editId ? "حفظ التعديلات" : "إضافة الوثيقة")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
