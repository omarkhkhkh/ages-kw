import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Download, ClipboardCheck, X, Trash2, Loader2,
  FileText, AlertCircle, Trophy, Banknote, Percent, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_ARABIC } from "@/lib/constants";
import { exportToExcel } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import EntityDirectoryPicker from "@/components/entity-directory-picker";
import { companiesApi } from "@/lib/api";

/* ─── colours ─── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

/* دورة حياة المناقصات نفسها — بألوان لكل حالة */
const STATUS_HEX: Record<string, { color: string; bg: string; border: string }> = {
  new:                 { color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" },
  studying:            { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  requesting_quotes:   { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  preparing_technical: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  preparing_financial: { color: "#9333ea", bg: "#faf5ff", border: "#e9d5ff" },
  management_review:   { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  ready_to_submit:     { color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
  submitted:           { color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
  under_evaluation:    { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  won:                 { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  lost:                { color: "#dc2626", bg: "#fff1f2", border: "#fecaca" },
  cancelled:           { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
};

const ACTIVE_STATUSES = ["new", "studying", "requesting_quotes", "preparing_technical", "preparing_financial", "management_review", "ready_to_submit", "under_evaluation"];

const STATUS_TABS = [
  { id: "all", label: "الجميع" },
  { id: "new", label: "جديدة" },
  { id: "studying", label: "جاري الدراسة" },
  { id: "under_evaluation", label: "تحت التقييم" },
  { id: "won", label: "رست علينا" },
  { id: "lost", label: "رست على منافس" },
];

const emptyForm = {
  practiceNumber: "", projectName: "", description: "",
  governmentEntityId: null as number | null, departmentId: null as number | null, contactId: null as number | null,
  companyId: "", announcementDate: "", deadline: "",
  status: "new", expectedValue: "", responsibleEmployee: "", notes: "",
};

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", headers: opts?.body ? { "Content-Type": "application/json" } : undefined, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

const S = {
  label: { fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 5, display: "block" } as any,
  input: { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", background: "white", boxSizing: "border-box" } as any,
  td: { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, verticalAlign: "middle", textAlign: "right" } as any,
  th: { padding: "12px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" } as any,
};

function isPracticeUrgent(p: any) {
  if (!p.deadline || !ACTIVE_STATUSES.includes(p.status)) return false;
  const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86_400_000);
  return days >= 0 && days <= 7;
}

/* ═══════════════════════════════════════════════════════════ */
export default function PracticesList() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const canEdit = isAdmin || !!user?.canEdit;

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: practices = [], isLoading } = useQuery<any[]>({
    queryKey: ["practices", statusTab],
    queryFn: () => apiFetch(`/api/practices${statusTab !== "all" ? `?status=${statusTab}` : ""}`),
  });
  const { data: stats } = useQuery<any>({
    queryKey: ["practices-stats"],
    queryFn: () => apiFetch("/api/practices/stats"),
  });
  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["companies"], queryFn: () => companiesApi.list() });

  const createM = useMutation({
    mutationFn: (data: any) => apiFetch("/api/practices", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["practices"] });
      qc.invalidateQueries({ queryKey: ["practices-stats"] });
      setShowForm(false);
      setForm({ ...emptyForm });
      toast({ title: "✅ تمت إضافة الممارسة" });
      navigate(`/practices/${row.id}`);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/practices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practices"] });
      qc.invalidateQueries({ queryKey: ["practices-stats"] });
      toast({ title: "تم حذف الممارسة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = practices.filter((p) =>
    !search ||
    (p.practiceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.projectName || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.governmentEntity || "").includes(search),
  );

  const handleCreate = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.practiceNumber.trim() || !form.projectName.trim()) return;
    createM.mutate({
      practiceNumber: form.practiceNumber,
      projectName: form.projectName,
      description: form.description || null,
      governmentEntityId: form.governmentEntityId || null,
      departmentId: form.departmentId || null,
      contactId: form.contactId || null,
      companyId: form.companyId ? Number(form.companyId) : null,
      announcementDate: form.announcementDate || null,
      deadline: form.deadline || null,
      status: form.status,
      expectedValue: form.expectedValue ? String(form.expectedValue) : null,
      responsibleEmployee: form.responsibleEmployee || null,
      notes: form.notes || null,
    });
  };

  const handleExport = () => {
    exportToExcel(
      filtered.map((p) => ({
        practiceNumber: p.practiceNumber, projectName: p.projectName,
        entity: p.governmentEntity || "", status: STATUS_ARABIC[p.status] ?? p.status,
        deadline: p.deadline || "", offerValue: p.offerValue || "",
        responsible: p.responsibleEmployee || "",
      })),
      [
        { key: "practiceNumber", header: "رقم الممارسة" },
        { key: "projectName", header: "المشروع" },
        { key: "entity", header: "الجهة" },
        { key: "status", header: "الحالة" },
        { key: "deadline", header: "آخر موعد" },
        { key: "offerValue", header: "قيمة العرض" },
        { key: "responsible", header: "المسؤول" },
      ],
      "الممارسات",
    );
  };

  const statCards = [
    { title: "إجمالي الممارسات", value: stats?.total ?? 0, icon: FileText, accent: G, bg: "#fdf8ec", sub: "ممارسة مسجّلة" },
    { title: "ممارسات عاجلة", value: stats?.urgentCount ?? 0, icon: AlertCircle, accent: "#dc2626", bg: "#fff1f2", sub: "الموعد خلال 7 أيام" },
    { title: "رست علينا", value: stats?.wonCount ?? 0, icon: Trophy, accent: "#16a34a", bg: "#f0fdf4", sub: "ممارسة ناجحة" },
    { title: "قيمة العروض", value: formatCurrency(stats?.totalOfferValue), icon: Banknote, accent: "#0891b2", bg: "#ecfeff", sub: "د.ك إجمالي" },
    { title: "نسبة النجاح", value: `${stats?.winRate ?? 0}%`, icon: Percent, accent: "#7c3aed", bg: "#f5f3ff", sub: "من المحسومة" },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 4, height: 30, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardCheck size={20} color={GD} /> الممارسات
            </h1>
            <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>
              دورة حياة كاملة مثل المناقصات — من الإعلان حتى الترسية
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExport}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "white", color: GD, border: `1.5px solid ${G}66`, borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            <Download size={14} /> تصدير
          </button>
          {canEdit && (
            <button onClick={() => setShowForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg,${G},${GD})`, color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 12px ${G}44` }}>
              <Plus size={15} /> ممارسة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Stat cards (نفس بطاقات المناقصات) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div key={s.title} style={{ background: "white", border: `1.5px solid ${s.bg}`, borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{s.title}</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={16} color={s.accent} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>{s.sub}</div>
            <div style={{ height: 3, borderRadius: 2, marginTop: 10, background: `linear-gradient(90deg,${s.accent},transparent)` }} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1.5px solid #e2e8f0", borderRadius: 11, padding: "8px 13px", width: 270 }}>
          <Search size={15} color="#94a3b8" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الممارسة، المشروع، الجهة..."
            style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_TABS.map((t) => {
            const active = statusTab === t.id;
            const hex = STATUS_HEX[t.id];
            return (
              <button key={t.id} onClick={() => setStatusTab(t.id)}
                style={{
                  padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  background: active ? (hex ? hex.color : GR) : "white",
                  color: active ? "white" : "#64748b",
                  border: `1.5px solid ${active ? "transparent" : "#e2e8f0"}`,
                }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #eef2f7", boxShadow: "0 2px 14px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 50, textAlign: "center" }}><Loader2 size={24} color={G} style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 50, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>لا توجد ممارسات مطابقة</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={S.th}>رقم الممارسة</th>
                  <th style={S.th}>المشروع</th>
                  <th style={S.th}>الجهة</th>
                  <th style={S.th}>آخر موعد</th>
                  <th style={S.th}>قيمة العرض</th>
                  <th style={S.th}>الحالة</th>
                  <th style={S.th}>المسؤول</th>
                  {isAdmin && <th style={S.th}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const hex = STATUS_HEX[p.status] ?? STATUS_HEX.new;
                  const urgent = isPracticeUrgent(p);
                  return (
                    <tr key={p.id} onClick={() => navigate(`/practices/${p.id}`)}
                      style={{ cursor: "pointer", background: urgent ? "#fffbeb" : "white", transition: "background 0.1s" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#fdfaf1")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = urgent ? "#fffbeb" : "white")}>
                      <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: GD, whiteSpace: "nowrap" }}>{p.practiceNumber}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: "#132a18", maxWidth: 260 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.projectName}</div>
                      </td>
                      <td style={{ ...S.td, color: "#64748b", maxWidth: 170 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.governmentEntity || "—"}</div>
                      </td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, color: urgent ? "#dc2626" : "#374151", fontWeight: urgent ? 800 : 500 }}>
                          {urgent && <AlertTriangle size={12} />}
                          {p.deadline ? formatDate(p.deadline) : "—"}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontFamily: "monospace", whiteSpace: "nowrap" }}>{p.offerValue ? formatCurrency(p.offerValue) : "—"}</td>
                      <td style={S.td}>
                        <span style={{ padding: "3px 11px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: hex.bg, color: hex.color, border: `1px solid ${hex.border}`, whiteSpace: "nowrap" }}>
                          {STATUS_ARABIC[p.status] ?? p.status}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: "#64748b", whiteSpace: "nowrap" }}>{p.responsibleEmployee || "—"}</td>
                      {isAdmin && (
                        <td style={{ ...S.td, width: 44 }}>
                          <button onClick={(e) => { e.stopPropagation(); if (confirm("حذف هذه الممارسة؟")) deleteM.mutate(p.id); }}
                            style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
                            <Trash2 size={13} color="#dc2626" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Create drawer ══ */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(11,26,16,0.55)", display: "flex", justifyContent: "flex-start", backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} dir="rtl"
            style={{ width: "min(560px, 100vw)", height: "100dvh", background: "white", boxShadow: "12px 0 48px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ color: "white", fontSize: 15, fontWeight: 800, margin: 0 }}>ممارسة جديدة</h2>
              <button onClick={() => setShowForm(false)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} color="white" />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={S.label}>رقم الممارسة *</label><input style={S.input} value={form.practiceNumber} onChange={(e) => setForm(f => ({ ...f, practiceNumber: e.target.value }))} required dir="ltr" /></div>
                <div><label style={S.label}>الحالة</label>
                  <select style={{ ...S.input, cursor: "pointer" }} value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_ARABIC).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={S.label}>اسم المشروع *</label><input style={S.input} value={form.projectName} onChange={(e) => setForm(f => ({ ...f, projectName: e.target.value }))} required /></div>
              <div>
                <label style={S.label}>الجهة الحكومية / الاختصاص / المسؤول</label>
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
                <div><label style={S.label}>تاريخ الإعلان</label><input style={S.input} type="date" value={form.announcementDate} onChange={(e) => setForm(f => ({ ...f, announcementDate: e.target.value }))} /></div>
                <div><label style={S.label}>آخر موعد للتقديم</label><input style={S.input} type="date" value={form.deadline} onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
                <div><label style={S.label}>القيمة المتوقعة (د.ك)</label><input style={S.input} type="number" step="0.001" value={form.expectedValue} onChange={(e) => setForm(f => ({ ...f, expectedValue: e.target.value }))} dir="ltr" /></div>
                <div><label style={S.label}>الشركة المشاركة</label>
                  <select style={{ ...S.input, cursor: "pointer" }} value={form.companyId} onChange={(e) => setForm(f => ({ ...f, companyId: e.target.value }))}>
                    <option value="">— بدون —</option>
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={S.label}>الموظف المسؤول</label><input style={S.input} value={form.responsibleEmployee} onChange={(e) => setForm(f => ({ ...f, responsibleEmployee: e.target.value }))} /></div>
              <div><label style={S.label}>الوصف</label><textarea style={{ ...S.input, resize: "vertical", minHeight: 70 }} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><label style={S.label}>ملاحظات</label><textarea style={{ ...S.input, resize: "vertical", minHeight: 55 }} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>بعد الحفظ ستنتقل تلقائيًا لصفحة تفاصيل الممارسة لإكمال بقية البيانات والمستندات وفض الظروف.</p>
              <div style={{ display: "flex", gap: 10, paddingTop: 6 }}>
                <button type="submit" disabled={createM.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 24px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 4px 14px ${G}44` }}>
                  {createM.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
                  إضافة الممارسة
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
