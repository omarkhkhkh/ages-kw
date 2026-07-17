import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, permissionsApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { Link } from "wouter";
import {
  UserPlus, Trash2, Pencil, ShieldCheck, CheckCircle2, XCircle,
  Eye, Download, Upload, FilePenLine, Save, X, Activity,
  Users, KeyRound, LayoutGrid, Lock, Unlock,
  FileText, FolderOpen, FileSignature, TrendingUp, BarChart3,
  Loader2, DollarSign, Calendar, Building2,
  ShieldAlert, Search, EyeOff, ChevronDown,
} from "lucide-react";
import { formatKuwaitDateTime } from "@/lib/timezone";

/* ── brand ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

interface UserRow {
  id: number; username: string; fullName: string; role: string;
  canView: boolean; canDownload: boolean; canUpload: boolean; canEdit: boolean;
  accessTenders: boolean; accessEntities: boolean; accessSuppliers: boolean;
  accessProjects: boolean; accessGuarantees: boolean; accessContracts: boolean;
  accessRfq: boolean; accessPo: boolean; accessTransportation: boolean;
  accessFinance: boolean; accessCorrespondence: boolean; accessResidency: boolean;
  accessMaintenance: boolean;
  accessResearch: boolean;
  accessPricing: boolean;
  accessTasks: boolean;
  taskViewScope: string;
  taskCanApprove: boolean;
  correspondenceViewAll: boolean;
  isActive: boolean; createdAt: string; lastLogin: string | null;
}

const MODULES = [
  { key: "accessTenders",    label: "المناقصات",              icon: "📋" },
  { key: "accessEntities",   label: "الجهات الحكومية",        icon: "🏛" },
  { key: "accessSuppliers",  label: "الموردون",               icon: "🤝" },
  { key: "accessProjects",   label: "المشاريع",               icon: "📁" },
  { key: "accessGuarantees", label: "الكفالات البنكية",       icon: "🛡" },
  { key: "accessContracts",  label: "العقود",                  icon: "📝" },
  { key: "accessRfq",            label: "طلبات عروض الأسعار",    icon: "📊" },
  { key: "accessPo",             label: "أوامر الشراء المباشر",  icon: "🛒" },
  { key: "accessTransportation", label: "النقل والتوزيع",         icon: "🚚" },
  { key: "accessFinance",        label: "الإدارة المالية",         icon: "💰" },
  { key: "accessCorrespondence", label: "المراسلات",                icon: "✉️" },
  { key: "accessResidency",      label: "إدارة الإقامات",           icon: "🪪" },
  { key: "accessMaintenance",    label: "إدارة الصيانة",            icon: "🔧" },
  { key: "accessResearch",       label: "البحث والتطوير",           icon: "🔬" },
  { key: "accessPricing",        label: "التسعير",                    icon: "🧮" },
  { key: "accessTasks",          label: "المهام / مركز العمليات",    icon: "🗂" },
] as const;

const GLOBAL_PERMS = [
  { key: "canView",     label: "اطلاع على البيانات", icon: Eye,         color: "#2563eb" },
  { key: "canDownload", label: "تنزيل / تصدير",       icon: Download,    color: "#7c3aed" },
  { key: "canUpload",   label: "رفع الملفات",          icon: Upload,      color: "#d97706" },
  { key: "canEdit",     label: "تعديل وإضافة وحذف",   icon: FilePenLine, color: "#16a34a" },
] as const;

const defaultForm = {
  username: "", fullName: "", password: "", role: "employee",
  canView: true, canDownload: false, canUpload: false, canEdit: false,
  accessTenders: true, accessEntities: true, accessSuppliers: true,
  accessProjects: true, accessGuarantees: true, accessContracts: true,
  accessRfq: true, accessPo: true, accessTransportation: true, accessFinance: true,
  accessCorrespondence: true, accessResidency: true, accessMaintenance: true, accessResearch: true,
  accessPricing: true,
  accessTasks: true, taskViewScope: "own", taskCanApprove: false, correspondenceViewAll: false,
};

/* ── Toggle switch ── */
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none",
        background: checked ? `linear-gradient(135deg,${G},${GD})` : "#e2e8f0",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", transition: "background 0.2s",
        flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        right: checked ? 3 : undefined,
        left: checked ? undefined : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        transition: "left 0.2s, right 0.2s",
        display: "block",
      }} />
    </button>
  );
}

/* ── User Form Modal ── */
function UserModal({ open, editing, form, setForm, newPass, setNewPass, onClose, onSave, isPending }: any) {
  if (!open) return null;
  const isEdit = !!editing;
  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };
  const focus = (e: any) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.15)`; };
  const blur  = (e: any) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; };

  const data = isEdit ? editing : form;
  const set  = isEdit
    ? (key: string, val: any) => setForm((ed: any) => ed ? { ...ed, [key]: val } : ed)
    : (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 680, background: "white", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,0.3)", overflow: "hidden", animation: "slideUp 0.25s ease", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "20px 28px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,165,52,0.2)", border: "1px solid rgba(212,165,52,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserPlus size={20} color={G} />
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 17, fontWeight: 800, margin: 0 }}>{isEdit ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</h2>
              <p style={{ color: "rgba(212,165,52,0.55)", fontSize: 12, margin: "2px 0 0" }}>{isEdit ? data.fullName : "أدخل بيانات الموظف والصلاحيات"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Basic info */}
          <div>
            <SectionTitle>البيانات الأساسية</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {!isEdit && (
                <div>
                  <label style={lbl}>اسم المستخدم *</label>
                  <input value={data.username} onChange={e => set("username", e.target.value)} placeholder="username" dir="ltr" required style={inp} onFocus={focus} onBlur={blur} />
                </div>
              )}
              <div>
                <label style={lbl}>الاسم الكامل *</label>
                <input value={data.fullName} onChange={e => set("fullName", e.target.value)} placeholder="اسم الموظف" style={inp} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={lbl}>{isEdit ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور *"}</label>
                <input type="password" value={isEdit ? newPass : data.password}
                  onChange={e => isEdit ? setNewPass(e.target.value) : set("password", e.target.value)}
                  placeholder={isEdit ? "اتركها فارغة إذا لم تريد التغيير" : "كلمة المرور"}
                  dir="ltr" style={inp} onFocus={focus} onBlur={blur} />
              </div>
            </div>

            {/* Role */}
            <div style={{ marginTop: 16 }}>
              <label style={lbl}>الدور الوظيفي</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ v: "employee", label: "موظف", color: "#2563eb" }, { v: "admin", label: "مدير النظام", color: GD }].map(({ v, label, color }) => (
                  <button key={v} type="button" onClick={() => set("role", v)}
                    style={{ flex: 1, padding: "10px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.15s", border: `2px solid ${data.role === v ? color : "#e5e7eb"}`, background: data.role === v ? `${color}12` : "white", color: data.role === v ? color : "#6b7280" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active */}
            {isEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <Toggle checked={data.isActive} onChange={v => set("isActive", v)} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GR }}>الحساب {data.isActive ? "نشط" : "موقوف"}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{data.isActive ? "الموظف يستطيع الدخول للنظام" : "الموظف لا يستطيع الدخول"}</div>
                </div>
              </div>
            )}
          </div>

          <Divider />

          {/* Global permissions */}
          <div>
            <SectionTitle>الصلاحيات العامة</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {GLOBAL_PERMS.map(({ key, label, icon: Icon, color }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: (data as any)[key] ? `${color}08` : "#f9fafb", border: `1.5px solid ${(data as any)[key] ? `${color}25` : "#e5e7eb"}`, transition: "all 0.15s" }}>
                  <Toggle checked={(data as any)[key]} onChange={v => set(key, v)} />
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: (data as any)[key] ? `${color}15` : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color={(data as any)[key] ? color : "#9ca3af"} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: (data as any)[key] ? color : "#9ca3af" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* Module access */}
          <div>
            <SectionTitle>الوحدات المتاحة</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MODULES.map(({ key, label, icon }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: (data as any)[key] ? "#f0fdf4" : "#f9fafb", border: `1.5px solid ${(data as any)[key] ? "#bbf7d0" : "#e5e7eb"}`, transition: "all 0.15s" }}>
                  <Toggle checked={(data as any)[key]} onChange={v => set(key, v)} />
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: (data as any)[key] ? "#16a34a" : "#9ca3af" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* Operations Center permissions */}
          <div>
            <SectionTitle>صلاحيات مركز إدارة العمليات</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>نطاق عرض المهام</label>
                <select value={(data as any).taskViewScope ?? "own"} onChange={e => set("taskViewScope", e.target.value)} style={inp} onFocus={focus} onBlur={blur}>
                  <option value="own">مهامي فقط</option>
                  <option value="department">مهام القسم</option>
                  <option value="all">جميع المهام</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: (data as any).taskCanApprove ? "#f0fdf4" : "#f9fafb", border: `1.5px solid ${(data as any).taskCanApprove ? "#bbf7d0" : "#e5e7eb"}` }}>
                <Toggle checked={(data as any).taskCanApprove} onChange={v => set("taskCanApprove", v)} />
                <span style={{ fontSize: 12, fontWeight: 600, color: (data as any).taskCanApprove ? "#16a34a" : "#9ca3af" }}>صلاحية اعتماد المهام</span>
              </div>
            </div>
          </div>

          <Divider />

          {/* Correspondence privacy */}
          <div>
            <SectionTitle>خصوصية المراسلات</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: (data as any).correspondenceViewAll ? "#f0fdf4" : "#f9fafb", border: `1.5px solid ${(data as any).correspondenceViewAll ? "#bbf7d0" : "#e5e7eb"}` }}>
              <Toggle checked={(data as any).correspondenceViewAll} onChange={v => set("correspondenceViewAll", v)} />
              <span style={{ fontSize: 12, fontWeight: 600, color: (data as any).correspondenceViewAll ? "#16a34a" : "#9ca3af" }}>
                الاطلاع على كتب جميع الموظفين
              </span>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 2px 0" }}>
              بدون هذه الصلاحية يرى الموظف كتبه (التي أنشأها) فقط — المدير يرى الجميع دائمًا.
            </p>
          </div>

          {/* Save */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4, borderTop: "1px solid #f5f0e6" }}>
            <button type="button" onClick={onSave} disabled={isPending}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 28px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: isPending ? "not-allowed" : "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 6px 20px rgba(212,165,52,0.4)`, opacity: isPending ? 0.7 : 1 }}>
              <Save size={16} /> {isPending ? "جارٍ الحفظ..." : (isEdit ? "حفظ التعديلات" : "إضافة الموظف")}
            </button>
            <button type="button" onClick={onClose}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
              <X size={15} /> إلغاء
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(32px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>{children}</span>
    </div>
  );
}
function Divider() {
  return <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f0ead8,transparent)" }} />;
}

/* ════════════════════════════════════════════════════
   EMPLOYEE PROFILE MODAL
════════════════════════════════════════════════════ */
const kwd = (v: string | number | null | undefined) =>
  v == null || v === "" ? "—"
  : `${Number(v).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ar-KW", { year: "numeric", month: "short", day: "numeric" }) : "—";

const TENDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "مسودة",    color: "#6b7280", bg: "#f9fafb" },
  submitted: { label: "مقدّمة",   color: "#2563eb", bg: "#eff6ff" },
  won:       { label: "رابحة",    color: "#16a34a", bg: "#f0fdf4" },
  lost:      { label: "خاسرة",   color: "#dc2626", bg: "#fff1f2" },
  cancelled: { label: "ملغاة",   color: "#9ca3af", bg: "#f3f4f6" },
  pending:   { label: "انتظار",  color: "#d97706", bg: "#fffbeb" },
};
const CONTRACT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "فعّال",    color: "#16a34a", bg: "#f0fdf4" },
  completed: { label: "مكتمل",   color: "#2563eb", bg: "#eff6ff" },
  terminated:{ label: "منتهي",   color: "#dc2626", bg: "#fff1f2" },
};
const PROJECT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  planning:    { label: "تخطيط",    color: "#6b7280", bg: "#f9fafb" },
  active:      { label: "نشط",      color: "#16a34a", bg: "#f0fdf4" },
  on_hold:     { label: "متوقف",    color: "#d97706", bg: "#fffbeb" },
  completed:   { label: "مكتمل",    color: "#2563eb", bg: "#eff6ff" },
  cancelled:   { label: "ملغي",     color: "#dc2626", bg: "#fff1f2" },
};

interface ProfileData {
  user: UserRow;
  tenders: any[];
  contracts: any[];
  projects: any[];
  income: any[];
  sales: any[];
}

function EmployeeProfileModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [tab, setTab] = useState<"tenders"|"contracts"|"projects"|"income"|"sales">("tenders");

  const { data, isLoading, isError, refetch } = useQuery<ProfileData>({
    queryKey: ["employee-profile", userId],
    queryFn: () => apiFetch(`/api/admin/users/${userId}/profile`),
    retry: 1,
  });

  const totalIncome = (data?.income ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalProfit = (data?.sales ?? []).reduce((s, r) => s + Number(r.profitAmount ?? 0), 0);

  const TABS = [
    { key: "tenders",   label: "المناقصات",  icon: FileText,       count: data?.tenders.length },
    { key: "contracts", label: "العقود",     icon: FileSignature,  count: data?.contracts.length },
    { key: "projects",  label: "المشاريع",   icon: FolderOpen,     count: data?.projects.length },
    { key: "income",    label: "الإيرادات",  icon: TrendingUp,     count: data?.income.length },
    { key: "sales",     label: "المبيعات",   icon: BarChart3,      count: data?.sales.length },
  ] as const;

  const thStyle: React.CSSProperties = { padding: "11px 14px", textAlign: "right", fontWeight: 800, color: "#374151", fontSize: 12, whiteSpace: "nowrap", background: "#fdf8ec", borderBottom: "2px solid #f0ead8" };
  const tdStyle: React.CSSProperties = { padding: "11px 14px", fontSize: 12, color: "#374151", borderBottom: "1px solid #f5f0e6" };
  const badge = (label: string, color: string, bg: string) => (
    <span style={{ padding: "3px 10px", borderRadius: 10, background: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const }}>{label}</span>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(11,26,16,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(5px)", animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 900, background: "white", borderRadius: 24, boxShadow: "0 40px 100px rgba(0,0,0,0.35)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh", animation: "slideUp 0.25s ease" }}>

        {/* Header */}
        <div style={{ padding: "20px 28px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white" }}>
              {data?.user.fullName.charAt(0) ?? "?"}
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: 800, margin: 0 }}>{data?.user.fullName ?? "..."}</h2>
              <p style={{ color: "rgba(212,165,52,0.6)", fontSize: 12, margin: "3px 0 0" }}>ملف الموظف الشخصي · عرض جميع الأعمال المرتبطة</p>
            </div>
          </div>
          {/* Summary badges */}
          {data && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {[
                { label: "إيرادات", value: kwd(totalIncome), color: "#16a34a" },
                { label: "أرباح",   value: kwd(totalProfit), color: G },
              ].map(b => (
                <div key={b.label} style={{ textAlign: "center", background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 14px" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{b.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: b.color, direction: "ltr" }}>{b.value}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)", marginRight: 8 }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "10px 20px 0", background: "#f9f7f2", borderBottom: "1.5px solid #f0ead8", flexShrink: 0, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: "10px 10px 0 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", transition: "all 0.15s", background: tab === t.key ? "white" : "transparent", color: tab === t.key ? GR : "#6b7280", borderBottom: tab === t.key ? `2px solid ${G}` : "2px solid transparent", whiteSpace: "nowrap" }}>
              <t.icon size={14} color={tab === t.key ? G : "#9ca3af"} />
              {t.label}
              {t.count !== undefined && (
                <span style={{ minWidth: 20, height: 18, borderRadius: 9, background: tab === t.key ? `${G}20` : "#f3f4f6", color: tab === t.key ? GD : "#6b7280", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
              <Loader2 size={28} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : isError || !data ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#fff1f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={24} color="#dc2626" />
              </div>
              <p style={{ color: "#dc2626", fontSize: 14, fontWeight: 700, margin: 0 }}>تعذّر تحميل بيانات الملف الشخصي</p>
              <button onClick={() => refetch()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <>
              {/* TENDERS */}
              {tab === "tenders" && (
                data.tenders.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 50, gap: 10 }}>
                    <FileText size={36} color="#e2d5b0" />
                    <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد مناقصات مرتبطة بهذا الموظف</p>
                    <p style={{ color: "#d1d5db", fontSize: 12, margin: 0 }}>يتم البحث بالاسم في حقول: المهندس المسؤول، مدير المناقصة، مسؤول المشتريات، المسؤول المالي، مسؤول النقل، مسؤول الموافقة</p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      {["رقم المناقصة","المشروع","الجهة","الحالة","قيمة العطاء","قيمة العقد","دوره"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.tenders.map((t: any, i: number) => {
                        const st = TENDER_STATUS[t.status] ?? { label: t.status, color: "#6b7280", bg: "#f9fafb" };
                        // Determine the employee's roles in this tender
                        const roles: string[] = [];
                        const n = data.user.fullName.toLowerCase();
                        if (t.responsibleEngineer?.toLowerCase().includes(n)) roles.push("مهندس مسؤول");
                        if (t.tenderManager?.toLowerCase().includes(n))       roles.push("مدير مناقصة");
                        if (t.procurementOfficer?.toLowerCase().includes(n))  roles.push("مشتريات");
                        if (t.financialOfficer?.toLowerCase().includes(n))    roles.push("مالي");
                        if (t.transportOfficer?.toLowerCase().includes(n))    roles.push("نقل");
                        if (t.approvalManager?.toLowerCase().includes(n))     roles.push("موافقة");
                        return (
                          <tr key={t.id} style={{ background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                            <td style={{ ...tdStyle, fontWeight: 700, color: GR }}>{t.tenderNumber ?? "—"}</td>
                            <td style={{ ...tdStyle, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.projectName ?? "—"}</td>
                            <td style={{ ...tdStyle, color: "#6b7280" }}>{t.governmentEntity ?? "—"}</td>
                            <td style={tdStyle}>{badge(st.label, st.color, st.bg)}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right" }}>{kwd(t.offerValue)}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{kwd(t.contractValue)}</td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {roles.map(r => <span key={r} style={{ padding: "2px 8px", borderRadius: 8, background: `${G}15`, color: GD, fontSize: 11, fontWeight: 700 }}>{r}</span>)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}

              {/* CONTRACTS */}
              {tab === "contracts" && (
                data.contracts.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 50, gap: 10 }}>
                    <FileSignature size={36} color="#e2d5b0" />
                    <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد عقود مرتبطة بمناقصات هذا الموظف</p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      {["رقم العقد","الجهة الحكومية","قيمة العقد","الحالة","تاريخ التوقيع","تاريخ البداية","تاريخ النهاية"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.contracts.map((c: any, i: number) => {
                        const st = CONTRACT_STATUS[c.status] ?? { label: c.status, color: "#6b7280", bg: "#f9fafb" };
                        return (
                          <tr key={c.id} style={{ background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                            <td style={{ ...tdStyle, fontWeight: 700, color: GR }}>{c.contractNumber}</td>
                            <td style={{ ...tdStyle, color: "#6b7280" }}>{c.governmentEntity ?? "—"}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>{kwd(c.contractValue)}</td>
                            <td style={tdStyle}>{badge(st.label, st.color, st.bg)}</td>
                            <td style={tdStyle}>{fmtDate(c.signDate)}</td>
                            <td style={tdStyle}>{fmtDate(c.startDate)}</td>
                            <td style={tdStyle}>{fmtDate(c.endDate)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}

              {/* PROJECTS */}
              {tab === "projects" && (
                data.projects.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 50, gap: 10 }}>
                    <FolderOpen size={36} color="#e2d5b0" />
                    <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد مشاريع مرتبطة بهذا الموظف</p>
                    <p style={{ color: "#d1d5db", fontSize: 12, margin: 0 }}>يتم البحث في حقل "مدير المشروع"</p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      {["رقم المشروع","اسم المشروع","الجهة","الحالة","قيمة العقد","الإنجاز %","البداية","النهاية"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.projects.map((p: any, i: number) => {
                        const st = PROJECT_STATUS[p.status] ?? { label: p.status, color: "#6b7280", bg: "#f9fafb" };
                        const pct = Number(p.completionPercentage ?? 0);
                        return (
                          <tr key={p.id} style={{ background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                            <td style={{ ...tdStyle, fontWeight: 700, color: GR }}>{p.projectNumber ?? "—"}</td>
                            <td style={{ ...tdStyle, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                            <td style={{ ...tdStyle, color: "#6b7280" }}>{p.governmentEntity ?? "—"}</td>
                            <td style={tdStyle}>{badge(st.label, st.color, st.bg)}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{kwd(p.contractValue)}</td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: pct >= 100 ? "#16a34a" : pct > 50 ? G : "#2563eb", borderRadius: 3, transition: "width 0.4s" }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", minWidth: 32 }}>{pct}%</span>
                              </div>
                            </td>
                            <td style={tdStyle}>{fmtDate(p.startDate)}</td>
                            <td style={tdStyle}>{fmtDate(p.endDate)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}

              {/* INCOME */}
              {tab === "income" && (
                data.income.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 50, gap: 10 }}>
                    <TrendingUp size={36} color="#e2d5b0" />
                    <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد إيرادات مسجلة لهذا الموظف</p>
                  </div>
                ) : (
                  <>
                    {/* Income total */}
                    <div style={{ padding: "14px 20px", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 10 }}>
                      <TrendingUp size={16} color="#16a34a" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>إجمالي الإيرادات: </span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: "#16a34a", direction: "ltr" }}>{kwd(totalIncome)}</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr>
                        {["التاريخ","الوصف","المبلغ","الفئة","الملاحظات"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {data.income.map((r: any, i: number) => (
                          <tr key={r.id} style={{ background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                            <td style={tdStyle}>{fmtDate(r.date)}</td>
                            <td style={{ ...tdStyle, fontWeight: 700, color: GR }}>{r.description}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>{kwd(r.amount)}</td>
                            <td style={tdStyle}><span style={{ padding: "2px 10px", borderRadius: 10, background: "#f0fdf4", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>{r.category}</span></td>
                            <td style={{ ...tdStyle, color: "#9ca3af" }}>{r.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )
              )}

              {/* SALES */}
              {tab === "sales" && (
                data.sales.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 50, gap: 10 }}>
                    <BarChart3 size={36} color="#e2d5b0" />
                    <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد مبيعات مسجلة لهذا الموظف</p>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "14px 20px", background: "#fffbeb", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 14 }}>
                      <BarChart3 size={16} color={GD} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#78350f" }}>إجمالي الأرباح: </span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: GD, direction: "ltr" }}>{kwd(totalProfit)}</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr>
                        {["التاريخ","الوصف","إجمالي العقد","نسبة الربح %","مبلغ الربح","رقم العقد","الملاحظات"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {data.sales.map((s: any, i: number) => (
                          <tr key={s.id} style={{ background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                            <td style={tdStyle}>{fmtDate(s.saleDate)}</td>
                            <td style={{ ...tdStyle, fontWeight: 700, color: GR }}>{s.description}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right" }}>{kwd(s.totalContractAmount)}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right" }}>{s.profitPercentage ? `${Number(s.profitPercentage).toFixed(2)}%` : "—"}</td>
                            <td style={{ ...tdStyle, direction: "ltr", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>{kwd(s.profitAmount)}</td>
                            <td style={{ ...tdStyle, color: "#6b7280" }}>{s.contractNumber ?? "—"}</td>
                            <td style={{ ...tdStyle, color: "#9ca3af" }}>{s.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(32px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   RECORD PERMISSIONS MODAL
════════════════════════════════════════════════════ */
const TENDER_STATUS_AR: Record<string, { label: string; color: string }> = {
  new:                  { label: "جديدة",            color: "#2563eb" },
  studying:             { label: "قيد الدراسة",      color: "#7c3aed" },
  requesting_quotes:    { label: "طلب عروض",         color: "#d97706" },
  preparing_technical:  { label: "إعداد تقني",       color: "#0891b2" },
  preparing_financial:  { label: "إعداد مالي",       color: "#0891b2" },
  management_review:    { label: "مراجعة الإدارة",  color: "#6b7280" },
  ready_to_submit:      { label: "جاهزة للتقديم",   color: "#16a34a" },
  submitted:            { label: "مقدّمة",            color: "#16a34a" },
  under_evaluation:     { label: "قيد التقييم",      color: "#d97706" },
  won:                  { label: "رست علينا",         color: "#16a34a" },
  lost:                 { label: "خسرناها",           color: "#dc2626" },
  cancelled:            { label: "ملغاة",             color: "#6b7280" },
};

function PermissionsModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tenders" | "contracts">("tenders");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["record-permissions", user.id],
    queryFn: () => permissionsApi.getRecord(user.id),
    staleTime: 0,
  });

  /* optimistic toggle state — starts from server data */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const key = (type: "t" | "c", id: number) => `${type}:${id}`;

  const setMut = useMutation({
    mutationFn: ({ type, recordId, canView }: { type: "tender" | "contract"; recordId: number; canView: boolean }) =>
      permissionsApi.setRecord(user.id, type, recordId, canView),
    onMutate: ({ type, recordId, canView }) => {
      // Optimistic update
      const k = key(type === "tender" ? "t" : "c", recordId);
      setOverrides(prev => ({ ...prev, [k]: canView }));
      return { k, prev: overrides[k] };
    },
    onError: (_err, _vars, ctx: any) => {
      // Roll back on failure
      if (ctx?.k !== undefined) {
        setOverrides(prev => {
          const next = { ...prev };
          if (ctx.prev === undefined) delete next[ctx.k];
          else next[ctx.k] = ctx.prev;
          return next;
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["record-permissions", user.id] }),
  });

  function toggle(type: "tender" | "contract", recordId: number, current: boolean) {
    setMut.mutate({ type, recordId, canView: !current });
  }

  function getCanView(type: "t" | "c", id: number, serverVal: boolean): boolean {
    const k = key(type, id);
    return k in overrides ? overrides[k] : serverVal;
  }

  const tenders   = useMemo(() => (data?.tenders ?? []).filter((t: any) => !search || t.tenderNumber?.includes(search) || t.projectName?.toLowerCase().includes(search.toLowerCase()) || t.governmentEntity?.includes(search)), [data, search]);
  const contracts = useMemo(() => (data?.contracts ?? []).filter((c: any) => !search || c.contractNumber?.includes(search) || c.governmentEntity?.includes(search)), [data, search]);

  const visibleTenders   = tenders.filter((t: any) => getCanView("t", t.id, t.canView));
  const blockedTenders   = tenders.filter((t: any) => !getCanView("t", t.id, t.canView));
  const visibleContracts = contracts.filter((c: any) => getCanView("c", c.id, c.canView));
  const blockedContracts = contracts.filter((c: any) => !getCanView("c", c.id, c.canView));

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 38px 9px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, background: "#fafaf8", fontFamily: "inherit", outline: "none", color: "#132a18" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(11,26,16,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, background: "white", borderRadius: 24, boxShadow: "0 40px 100px rgba(0,0,0,0.35)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh", animation: "slideUp 0.25s ease" }}>

        {/* Header */}
        <div style={{ padding: "18px 24px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,165,52,0.2)", border: "1px solid rgba(212,165,52,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={20} color={G} />
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 16, fontWeight: 800, margin: 0 }}>صلاحيات السجلات — {user.fullName}</h2>
              <p style={{ color: "rgba(212,165,52,0.55)", fontSize: 12, margin: "2px 0 0" }}>حدّد المناقصات والعقود التي يمكن للموظف الاطلاع عليها</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Summary pills */}
            {data && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "3px 12px", borderRadius: 20, background: "#f0fdf4", color: "#16a34a", fontSize: 11, fontWeight: 800 }}>
                  ✓ {visibleTenders.length + visibleContracts.length} مرئي
                </span>
                <span style={{ padding: "3px 12px", borderRadius: 20, background: "#fff1f2", color: "#dc2626", fontSize: 11, fontWeight: 800 }}>
                  ✕ {blockedTenders.length + blockedContracts.length} محجوب
                </span>
              </div>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs + Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "10px 20px 0", background: "#f9f7f2", borderBottom: "1.5px solid #f0ead8", flexShrink: 0, flexWrap: "wrap" }}>
          {[
            { key: "tenders",   label: "المناقصات",  icon: FileText,      visible: visibleTenders.length,   blocked: blockedTenders.length },
            { key: "contracts", label: "العقود",      icon: FileSignature, visible: visibleContracts.length, blocked: blockedContracts.length },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key as any); setSearch(""); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: "10px 10px 0 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: tab === t.key ? "white" : "transparent", color: tab === t.key ? GR : "#6b7280", borderBottom: tab === t.key ? `2px solid ${G}` : "2px solid transparent", whiteSpace: "nowrap" }}>
              <t.icon size={14} color={tab === t.key ? G : "#9ca3af"} />
              {t.label}
              {t.visible > 0 && <span style={{ padding: "1px 7px", borderRadius: 8, background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 800 }}>{t.visible}</span>}
              {t.blocked > 0 && <span style={{ padding: "1px 7px", borderRadius: 8, background: "#fff1f2", color: "#dc2626", fontSize: 10, fontWeight: 800 }}>محجوب {t.blocked}</span>}
            </button>
          ))}
          {/* Search */}
          <div style={{ marginRight: "auto", position: "relative", marginBottom: 6 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." style={{ ...inp, width: 200, paddingRight: 34 }} />
            <Search size={14} color="#9ca3af" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
              <Loader2 size={28} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : isError ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ color: "#dc2626", fontWeight: 700 }}>تعذّر تحميل البيانات</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fdf8ec", borderBottom: "2px solid #f0ead8" }}>
                  {tab === "tenders"
                    ? ["رقم المناقصة", "المشروع", "الجهة", "الحالة", "الوصول"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 800, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>)
                    : ["رقم العقد", "الجهة", "الحالة", "الوصول"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 800, color: "#6b7280" }}>{h}</th>)
                  }
                </tr>
              </thead>
              <tbody>
                {tab === "tenders" && tenders.map((t: any) => {
                  const canView = getCanView("t", t.id, t.canView);
                  const st = TENDER_STATUS_AR[t.status] ?? { label: t.status, color: "#6b7280" };
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f5f0e6", background: canView ? "white" : "#fef2f2", opacity: setMut.isPending ? 0.85 : 1 }}>
                      <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 700, color: "#132a18", whiteSpace: "nowrap" }}>{t.tenderNumber ?? "—"}</td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#374151", maxWidth: 200 }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.projectName ?? "—"}</span>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{t.governmentEntity ?? "—"}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: 10, background: `${st.color}12`, color: st.color, fontSize: 10, fontWeight: 700 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <button onClick={() => toggle("tender", t.id, canView)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, transition: "all 0.15s", background: canView ? "#f0fdf4" : "#fff1f2", color: canView ? "#16a34a" : "#dc2626" }}>
                          {canView ? <Eye size={13} /> : <EyeOff size={13} />}
                          {canView ? "يطلع" : "محجوب"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {tab === "contracts" && contracts.map((c: any) => {
                  const canView = getCanView("c", c.id, c.canView);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f5f0e6", background: canView ? "white" : "#fef2f2", opacity: setMut.isPending ? 0.85 : 1 }}>
                      <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 700, color: "#132a18", whiteSpace: "nowrap" }}>{c.contractNumber ?? "—"}</td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#6b7280" }}>{c.governmentEntity ?? "—"}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: 10, background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 700 }}>{c.status ?? "—"}</span>
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <button onClick={() => toggle("contract", c.id, canView)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, transition: "all 0.15s", background: canView ? "#f0fdf4" : "#fff1f2", color: canView ? "#16a34a" : "#dc2626" }}>
                          {canView ? <Eye size={13} /> : <EyeOff size={13} />}
                          {canView ? "يطلع" : "محجوب"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {((tab === "tenders" && tenders.length === 0) || (tab === "contracts" && contracts.length === 0)) && (
                  <tr><td colSpan={5} style={{ padding: 48, textAlign: "center", color: "#d1d5db", fontSize: 13 }}>
                    {search ? "لا نتائج للبحث" : tab === "tenders" ? "لا توجد مناقصات" : "لا توجد عقود"}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #f0ead8", background: "#fafaf8", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, direction: "rtl" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "block" }} />
            <span style={{ fontSize: 11, color: "#6b7280" }}>يطلع — الموظف يرى هذا السجل</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "block" }} />
            <span style={{ fontSize: 11, color: "#6b7280" }}>محجوب — الموظف لا يرى هذا السجل</span>
          </div>
          <span style={{ marginRight: "auto", fontSize: 11, color: "#d1d5db" }}>الإعداد الافتراضي: يطلع على الجميع</span>
        </div>
      </div>
    </div>
  );
}

/* ── User Card ── */
function UserCard({ u, me, onEdit, onDelete, onViewProfile, onViewPermissions }: { u: UserRow; me: any; onEdit: () => void; onDelete: () => void; onViewProfile: () => void; onViewPermissions: () => void }) {
  const isAdmin = u.role === "admin";

  return (
    <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>

      {/* Card header */}
      <div style={{ padding: "16px 20px", background: "#fdf8ec", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Avatar */}
          <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "white", flexShrink: 0 }}>
            {u.fullName.charAt(0)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: GR }}>{u.fullName}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: isAdmin ? `${G}15` : "#eff6ff", color: isAdmin ? GD : "#2563eb", border: `1px solid ${isAdmin ? G + "30" : "#bfdbfe"}` }}>
                {isAdmin ? "مدير النظام" : "موظف"}
              </span>
              {u.isActive
                ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#16a34a", fontWeight: 600 }}><CheckCircle2 size={12} /> نشط</span>
                : <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#dc2626", fontWeight: 600 }}><XCircle size={12} /> موقوف</span>
              }
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
              @{u.username} · آخر دخول: {u.lastLogin ? formatKuwaitDateTime(u.lastLogin) : "لم يدخل بعد"}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={onViewProfile} title="ملف الموظف"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fffbeb", color: GD, border: `1px solid ${G}40`, cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={e => (e.currentTarget.style.background = `${G}18`)}
            onMouseLeave={e => (e.currentTarget.style.background = "#fffbeb")}>
            <Eye size={13} /> الملف
          </button>
          {u.role !== "admin" && (
            <button onClick={onViewPermissions} title="صلاحيات السجلات"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", cursor: "pointer", fontFamily: "inherit" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#ede9fe")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f5f3ff")}>
              <ShieldAlert size={13} /> الصلاحيات
            </button>
          )}
          <Link href={`/admin/activity-log?userId=${u.id}`}>
            <button title="سجل الحركات"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit" }}>
              <Activity size={13} /> سجل
            </button>
          </Link>
          <button onClick={onEdit}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#dcfce7")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f0fdf4")}>
            <Pencil size={12} /> تعديل
          </button>
          {u.id !== me?.id && (
            <button onClick={onDelete}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff1f2")}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Permissions grid */}
      <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Global perms */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>الصلاحيات العامة</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GLOBAL_PERMS.map(({ key, label, icon: Icon, color }) => {
              const on = (u as any)[key];
              return (
                <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: on ? `${color}10` : "#f9fafb", color: on ? color : "#cbd5e1", border: `1px solid ${on ? color + "25" : "#e5e7eb"}` }}>
                  <Icon size={11} /> {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Module access */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>الوحدات المتاحة</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {MODULES.map(({ key, label, icon }) => {
              const on = (u as any)[key];
              return (
                <span key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: on ? "#16a34a" : "#d1d5db" }}>
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  <span style={{ textDecoration: on ? "none" : "line-through" }}>{label}</span>
                </span>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showForm,      setShowForm]      = useState(false);
  const [editing,       setEditing]       = useState<UserRow | null>(null);
  const [form,          setForm]          = useState({ ...defaultForm });
  const [newPass,       setNewPass]       = useState("");
  const [profileUserId,     setProfileUserId]     = useState<number | null>(null);
  const [permissionsUser,   setPermissionsUser]   = useState<UserRow | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); closeAll(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); closeAll(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const closeAll = () => { setShowForm(false); setEditing(null); setForm({ ...defaultForm }); setNewPass(""); };

  const handleSave = () => {
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        data: {
          fullName: editing.fullName, role: editing.role, isActive: editing.isActive,
          canView: editing.canView, canDownload: editing.canDownload, canUpload: editing.canUpload, canEdit: editing.canEdit,
          accessTenders: editing.accessTenders, accessEntities: editing.accessEntities,
          accessSuppliers: editing.accessSuppliers, accessProjects: editing.accessProjects,
          accessGuarantees: editing.accessGuarantees, accessContracts: editing.accessContracts,
          accessRfq: editing.accessRfq, accessPo: editing.accessPo,
          accessTransportation: editing.accessTransportation,
          accessFinance: editing.accessFinance,
          accessCorrespondence: editing.accessCorrespondence,
          accessResidency: editing.accessResidency,
          accessMaintenance: editing.accessMaintenance,
          accessResearch: editing.accessResearch,
          accessPricing: editing.accessPricing,
          accessTasks: editing.accessTasks,
          taskViewScope: editing.taskViewScope,
          taskCanApprove: editing.taskCanApprove,
          correspondenceViewAll: (editing as any).correspondenceViewAll ?? false,
          ...(newPass ? { password: newPass } : {}),
        },
      });
    } else {
      createMut.mutate(form);
    }
  };

  if (me?.role !== "admin") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
        <Lock size={40} color="#e2d5b0" />
        <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>ليس لديك صلاحية الوصول</p>
      </div>
    );
  }

  const activeCount   = users.filter(u => u.isActive).length;
  const adminCount    = users.filter(u => u.role === "admin").length;
  const employeeCount = users.filter(u => u.role === "employee").length;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Employee profile modal */}
      {profileUserId !== null && (
        <EmployeeProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}

      {/* Record permissions modal */}
      {permissionsUser !== null && (
        <PermissionsModal user={permissionsUser} onClose={() => setPermissionsUser(null)} />
      )}

      {/* User form modal */}
      <UserModal
        open={showForm || !!editing}
        editing={editing} form={form}
        setForm={editing ? setEditing : setForm}
        newPass={newPass} setNewPass={setNewPass}
        onClose={closeAll} onSave={handleSave}
        isPending={createMut.isPending || updateMut.isPending}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>إدارة المستخدمين</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>إنشاء الحسابات وتخصيص الصلاحيات والوحدات المتاحة</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/activity-log">
            <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit", transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = G)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
              <Activity size={15} /> سجل الحركات
            </button>
          </Link>
          <button onClick={() => { closeAll(); setShowForm(true); }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)`, transition: "transform 0.1s" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
            <UserPlus size={15} /> إضافة موظف
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        {[
          { label: "إجمالي المستخدمين", value: users.length,   icon: Users,        color: "#64748b", bg: "#f8fafc" },
          { label: "نشطون",              value: activeCount,    icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4" },
          { label: "مديرو النظام",       value: adminCount,     icon: ShieldCheck,  color: GD,        bg: "#fffbeb" },
          { label: "موظفون",             value: employeeCount,  icon: KeyRound,     color: "#2563eb", bg: "#eff6ff" },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, borderRadius: 18, border: `1.5px solid ${card.color}18`, padding: "18px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${card.color}15`, border: `1px solid ${card.color}25`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <card.icon size={20} color={card.color} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: card.color, lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: card.color, marginTop: 4, opacity: 0.8 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Users list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", height: 160, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
          <Users size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>لا يوجد مستخدمون مسجّلون</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {users.map(u => (
            <UserCard key={u.id} u={u} me={me}
              onEdit={() => { closeAll(); setEditing({ ...u }); }}
              onDelete={() => { if (confirm(`حذف ${u.fullName}؟`)) deleteMut.mutate(u.id); }}
              onViewProfile={() => setProfileUserId(u.id)}
              onViewPermissions={() => setPermissionsUser(u)}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
