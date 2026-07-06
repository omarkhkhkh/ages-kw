import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { Link } from "wouter";
import {
  UserPlus, Trash2, Pencil, ShieldCheck, CheckCircle2, XCircle,
  Eye, Download, Upload, FilePenLine, Save, X, Activity,
  Users, KeyRound, LayoutGrid, Lock, Unlock,
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
  accessRfq: boolean; accessPo: boolean;
  isActive: boolean; createdAt: string; lastLogin: string | null;
}

const MODULES = [
  { key: "accessTenders",    label: "المناقصات",              icon: "📋" },
  { key: "accessEntities",   label: "الجهات الحكومية",        icon: "🏛" },
  { key: "accessSuppliers",  label: "الموردون",               icon: "🤝" },
  { key: "accessProjects",   label: "المشاريع",               icon: "📁" },
  { key: "accessGuarantees", label: "الكفالات البنكية",       icon: "🛡" },
  { key: "accessContracts",  label: "العقود",                  icon: "📝" },
  { key: "accessRfq",        label: "طلبات عروض الأسعار",    icon: "📊" },
  { key: "accessPo",         label: "أوامر الشراء المباشر",  icon: "🛒" },
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
  accessRfq: true, accessPo: true,
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

/* ── User Card ── */
function UserCard({ u, me, onEdit, onDelete }: { u: UserRow; me: any; onEdit: () => void; onDelete: () => void }) {
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
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<UserRow | null>(null);
  const [form,    setForm]      = useState({ ...defaultForm });
  const [newPass, setNewPass]   = useState("");

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

      {/* Modal */}
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
            />
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
