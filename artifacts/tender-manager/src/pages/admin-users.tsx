import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, permissionsApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { positionsApi } from "@/lib/api";
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
import { generatePassword } from "@/pages/change-password";

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
  accessOpportunities: boolean;
  opportunityCanPrice: boolean;
  opportunityCanApprove: boolean;
  taskViewScope: string;
  taskCanApprove: boolean;
  correspondenceViewAll: boolean;
  permissions: PermMatrix | null;
  recordViewScope: string;
  isActive: boolean; createdAt: string; lastLogin: string | null;
}

/* ── مصفوفة الصلاحيات الدقيقة ── */
type PermActions = { view: boolean; add: boolean; edit: boolean; del: boolean };
type PermMatrix = Record<string, PermActions>;

const PERM_ACTIONS = [
  { key: "view", label: "عرض" },
  { key: "add",  label: "إضافة" },
  { key: "edit", label: "تعديل" },
  { key: "del",  label: "حذف" },
] as const;

function defaultMatrix(view = true, write = false): PermMatrix {
  const m: PermMatrix = {};
  for (const { key } of MODULES) m[key] = { view, add: write, edit: write, del: write };
  return m;
}

/** للمستخدمين القدامى بلا مصفوفة: تُشتق من accessX + canEdit (نفس منطق السيرفر) */
function matrixFromLegacy(u: Partial<UserRow>): PermMatrix {
  const write = !!u.canEdit;
  const m: PermMatrix = {};
  for (const { key } of MODULES) {
    const has = (u as any)[key] ?? true;
    m[key] = { view: !!has, add: !!has && write, edit: !!has && write, del: !!has && write };
  }
  return m;
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
  { key: "accessOpportunities",  label: "قسم البحث والتسعير",        icon: "🧭" },
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
  accessTasks: true, accessOpportunities: true, opportunityCanPrice: false, opportunityCanApprove: false,
  taskViewScope: "own", taskCanApprove: false, correspondenceViewAll: false,
  permissions: null as PermMatrix | null,
  recordViewScope: "own",
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
  // حزم القبعات — لعرض «الفرق عن الحزمة» بالألوان (hook قبل أي خروج مبكر)
  const { data: hatBundles } = useQuery<Record<string, any>>({ queryKey: ["position-bundles"], queryFn: () => positionsApi.bundles() });
  if (!open) return null;
  const isEdit = !!editing;
  const heldHatKeys: string[] = isEdit ? (((editing as any).hats ?? []) as any[]).map((h: any) => h.key) : [];
  // المصفوفة المتوقعة من اتحاد حزم قبعاته — الفرق عنها يُلوَّن في الجدول
  const expectedMatrix: PermMatrix | null = (isEdit && hatBundles && heldHatKeys.length)
    ? (() => {
        const m: any = {};
        for (const { key } of MODULES) m[key] = { view: false, add: false, edit: false, del: false };
        for (const hk of heldHatKeys) {
          const b = (hatBundles as any)[hk] ?? {};
          for (const [mod, acts] of Object.entries(b)) {
            if (!m[mod]) m[mod] = { view: false, add: false, edit: false, del: false };
            for (const a of ["view", "add", "edit", "del"] as const) if ((acts as any)[a]) m[mod][a] = true;
          }
        }
        return m as PermMatrix;
      })()
    : null;
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
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="text" value={isEdit ? newPass : data.password}
                    onChange={e => isEdit ? setNewPass(e.target.value) : set("password", e.target.value)}
                    placeholder={isEdit ? "اتركها فارغة إذا لم تريد التغيير" : "كلمة المرور"}
                    dir="ltr" style={{ ...inp, flex: 1 }} onFocus={focus} onBlur={blur} />
                  <button type="button" title="توليد كلمة قوية"
                    onClick={() => { const pw = generatePassword(); isEdit ? setNewPass(pw) : set("password", pw); }}
                    style={{ padding: "0 12px", borderRadius: 10, border: `1.5px solid ${G}66`, background: "#fdf8ec", color: GD, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    🎲 توليد
                  </button>
                </div>
                <p style={{ fontSize: 10.5, color: "#9ca3af", margin: "4px 0 0" }}>8+ أحرف وفيها حرف ورقم — والموظف يغيّرها إجباريًا عند أول دخول</p>
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

          {/* مصفوفة الصلاحيات الدقيقة */}
          <div>
            <SectionTitle>مصفوفة الصلاحيات — لكل وحدة: عرض / إضافة / تعديل / حذف</SectionTitle>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 2px 10px" }}>
              تُفرض من السيرفر تلقائيًا: بدون "عرض" لا تظهر الوحدة إطلاقًا، وكل عملية إضافة/تعديل/حذف تتطلب صلاحيتها. المدير يملك كل الصلاحيات دائمًا.
            </p>
            {isEdit && heldHatKeys.length > 0 && (
              <p style={{ fontSize: 11, fontWeight: 700, margin: "0 2px 10px", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span style={{ color: "#16a34a" }}>◉ إطار أخضر: زيادة يدوية على حزمة قبعته ({heldHatKeys.length ? ((editing as any).hats ?? []).map((h: any) => h.name).join("، ") : ""})</span>
                <span style={{ color: "#dc2626" }}>◉ إطار أحمر: محجوب يدويًا من حزمته</span>
              </p>
            )}
            {(() => {
              const matrix: PermMatrix = (data as any).permissions ?? matrixFromLegacy(data as any);
              const setCell = (mod: string, action: keyof PermActions, val: boolean) => {
                const next: PermMatrix = { ...matrix, [mod]: { ...matrix[mod], [action]: val } };
                // بدون عرض، بقية الصلاحيات بلا معنى — تُصفَّر تلقائيًا
                if (action === "view" && !val) next[mod] = { view: false, add: false, edit: false, del: false };
                // منح إضافة/تعديل/حذف يفعّل العرض تلقائيًا
                if (action !== "view" && val) next[mod] = { ...next[mod], view: true };
                set("permissions", next);
              };
              const setRow = (mod: string, val: boolean) => {
                set("permissions", { ...matrix, [mod]: { view: val, add: val, edit: val, del: val } });
              };
              const setCol = (action: keyof PermActions, val: boolean) => {
                const next: PermMatrix = { ...matrix };
                for (const { key } of MODULES) {
                  next[key] = { ...next[key], [action]: val };
                  if (action === "view" && !val) next[key] = { view: false, add: false, edit: false, del: false };
                  if (action !== "view" && val) next[key] = { ...next[key], view: true };
                }
                set("permissions", next);
              };
              const colAll = (action: keyof PermActions) => MODULES.every(({ key }) => matrix[key]?.[action]);
              const cellBox = (checked: boolean, onChange: () => void, diff?: "extra" | "missing") => (
                <button type="button" onClick={onChange}
                  title={diff === "extra" ? "زيادة على حزمة قبعته" : diff === "missing" ? "محجوب من حزمة قبعته" : undefined}
                  style={{
                  width: 22, height: 22, borderRadius: 6, cursor: "pointer",
                  border: `1.5px solid ${checked ? "#16a34a" : "#d1d5db"}`,
                  background: checked ? "#16a34a" : "white",
                  boxShadow: diff === "extra" ? "0 0 0 2.5px #86efac" : diff === "missing" ? "0 0 0 2.5px #fca5a5" : undefined,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 13, fontWeight: 900, lineHeight: 1, padding: 0,
                }}>{checked ? "✓" : ""}</button>
              );
              return (
                <div style={{ border: "1.5px solid #f0ead8", borderRadius: 14, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f9f6ee" }}>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#4a3f1a" }}>الوحدة</th>
                        {PERM_ACTIONS.map(a => (
                          <th key={a.key} style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, color: "#4a3f1a", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                              {a.label}
                              {cellBox(colAll(a.key as keyof PermActions), () => setCol(a.key as keyof PermActions, !colAll(a.key as keyof PermActions)))}
                            </div>
                          </th>
                        ))}
                        <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 800, color: "#4a3f1a" }}>الكل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(({ key, label, icon }) => {
                        const row = matrix[key] ?? { view: false, add: false, edit: false, del: false };
                        const rowAll = row.view && row.add && row.edit && row.del;
                        return (
                          <tr key={key} style={{ borderTop: "1px solid #f3f0e4", background: row.view ? "white" : "#fafafa" }}>
                            <td style={{ padding: "8px 14px", fontWeight: 700, color: row.view ? "#132a18" : "#9ca3af", whiteSpace: "nowrap" }}>
                              <span style={{ marginLeft: 6 }}>{icon}</span>{label}
                            </td>
                            {PERM_ACTIONS.map(a => {
                              const exp = expectedMatrix?.[key]?.[a.key as keyof PermActions];
                              const cur = !!row[a.key as keyof PermActions];
                              const diff = expectedMatrix ? (cur && !exp ? "extra" as const : !cur && exp ? "missing" as const : undefined) : undefined;
                              return (
                                <td key={a.key} style={{ padding: "8px", textAlign: "center" }}>
                                  {cellBox(cur, () => setCell(key, a.key as keyof PermActions, !cur), diff)}
                                </td>
                              );
                            })}
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              {cellBox(rowAll, () => setRow(key, !rowAll))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          <Divider />

          {/* خصوصية السجلات الرئيسية */}
          <div>
            <SectionTitle>خصوصية السجلات (مناقصات / ممارسات / عقود / مشاريع / أوامر شراء)</SectionTitle>
            <select value={(data as any).recordViewScope ?? "own"} onChange={e => set("recordViewScope", e.target.value)} style={inp} onFocus={focus} onBlur={blur}>
              <option value="own">يرى سجلاته التي أنشأها فقط (الافتراضي)</option>
              <option value="all">يرى سجلات جميع الموظفين</option>
            </select>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 2px 0" }}>
              الفرض من جانب السيرفر — السجلات القديمة التي لا يُعرف منشئها تبقى مرئية للجميع.
            </p>
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: (data as any).opportunityCanPrice ? "#ecfeff" : "#f9fafb", border: `1.5px solid ${(data as any).opportunityCanPrice ? "#a5f3fc" : "#e5e7eb"}` }}>
                <Toggle checked={(data as any).opportunityCanPrice} onChange={v => set("opportunityCanPrice", v)} />
                <span style={{ fontSize: 12, fontWeight: 600, color: (data as any).opportunityCanPrice ? "#0891b2" : "#9ca3af" }}>قسم التسعير — يعتمد مرحلة التسعير في الفرص</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: (data as any).opportunityCanApprove ? "#f0fdfa" : "#f9fafb", border: `1.5px solid ${(data as any).opportunityCanApprove ? "#99f6e4" : "#e5e7eb"}` }}>
                <Toggle checked={(data as any).opportunityCanApprove} onChange={v => set("opportunityCanApprove", v)} />
                <span style={{ fontSize: 12, fontWeight: 600, color: (data as any).opportunityCanApprove ? "#0d9488" : "#9ca3af" }}>الإدارة — يعتمد إرسال عروض أسعار الفرص</span>
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

/* ── نافذة «ماذا يرى؟»: محاكاة غرف النظام المرئية لهذا المستخدم — دقة قبل المنح ── */
function WhatSeesModal({ u, onClose }: { u: UserRow; onClose: () => void }) {
  const isAdminU = u.role === "admin";
  const hats: string[] = (((u as any).hats ?? []) as any[]).map((h: any) => h.key);
  const can = (f: string) => isAdminU || !!(u as any)[f];
  const manager = isAdminU || ["general_manager", "executive_manager", "financial_manager"].some(k => hats.includes(k));
  const GROUPS: { label: string; items: { label: string; show: boolean }[] }[] = [
    { label: "لوحتي", items: [{ label: "لوحة التحكم", show: true }] },
    { label: "الملفات والقرارات", items: [{ label: "الملفات والاعتمادات", show: manager }] },
    { label: "الأعمال والمناقصات", items: [
      { label: "المناقصات والممارسات", show: can("accessTenders") },
      { label: "بورصة الفرص (داخل أوامر الشراء)", show: can("accessOpportunities") },
      { label: "غرفة العقود وعروض الأسعار", show: can("accessContracts") },
      { label: "أوامر الشراء — السوق المحلي", show: can("accessPo") || can("accessResearch") },
      { label: "غرفة التسعير", show: can("accessPricing") },
      { label: "ذكاء المنافسين والتنبؤ 🔒", show: can("accessTenders") },
      { label: "المشاريع", show: can("accessProjects") },
    ]},
    { label: "العمليات", items: [
      { label: "مركز العمليات", show: can("accessTasks") },
      { label: "الأحمال والنقل (داخل المركز)", show: isAdminU || hats.includes("executive_manager") },
      { label: "التجديدات (داخل المركز)", show: manager },
      { label: "النقل", show: can("accessTransportation") },
      { label: "الصيانة وتقاريرها", show: can("accessMaintenance") },
      { label: "المراسلات", show: can("accessCorrespondence") },
      { label: "الإقامات", show: can("accessResidency") },
    ]},
    { label: "المالية", items: [
      { label: "المركز المالي (الأبواب الخمسة)", show: manager },
      { label: "سجل الكفالات", show: manager },
    ]},
    { label: "الدلائل والمستندات", items: [
      { label: "الجهات الحكومية", show: can("accessEntities") },
      { label: "الموردون", show: can("accessSuppliers") },
      { label: "وثائق الشركة والتسجيلات", show: isAdminU || can("accessTenders") },
    ]},
    { label: "الإعدادات", items: [{ label: "المستخدمون وسجل النشاط", show: isAdminU }] },
  ];
  const landing = isAdminU || hats.includes("general_manager") ? "لوحة التحكم"
    : hats.includes("financial_manager") ? "المركز المالي"
    : hats.includes("executive_manager") ? "الأحمال والنقل"
    : hats.includes("consultant") ? "سجل المناقصات"
    : hats.includes("researcher") ? "مكتب التكليفات والمواصفات"
    : (hats.includes("delegate") || hats.includes("transport_worker") || hats.includes("maintenance_worker")) ? "مركز العمليات"
    : "لوحة التحكم";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,26,16,.5)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 16, width: "min(560px,100%)", maxHeight: "86vh", overflowY: "auto", padding: 20, border: `1.5px solid ${G}33` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 15.5, fontWeight: 800, color: GR, margin: 0 }}>👁 ماذا يرى {u.fullName}؟</h2>
          <button onClick={onClose} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6, cursor: "pointer", display: "inline-flex" }}><X size={14} color="#64748b" /></button>
        </div>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>محاكاة قائمته وغرفه حسب قبعاته وصلاحياته الحالية — يهبط عند الدخول على: <b style={{ color: GD }}>{landing}</b></p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GROUPS.map(g => {
            const visible = g.items.filter(i => i.show);
            return (
              <div key={g.label} style={{ border: "1.5px solid #f0ead8", borderRadius: 12, padding: "10px 14px", background: visible.length ? "white" : "#fafafa" }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: visible.length ? GR : "#c7cdd6", marginBottom: visible.length ? 6 : 0 }}>
                  {g.label}{!visible.length && " — مخفية بالكامل"}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {g.items.map(i => (
                    <span key={i.label} style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: i.show ? "#f0fdf4" : "#f9fafb", color: i.show ? "#16a34a" : "#d1d5db", border: `1px solid ${i.show ? "#bbf7d0" : "#f0f0f0"}`, textDecoration: i.show ? "none" : "line-through" }}>
                      {i.show ? "✓" : "✗"} {i.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── User Card ── */
function UserCard({ u, me, onEdit, onDelete, onViewProfile, onViewPositions, onViewPermissions, onPreview }: { u: UserRow; me: any; onEdit: () => void; onDelete: () => void; onViewProfile: () => void; onViewPositions: () => void; onViewPermissions: () => void; onPreview: () => void }) {
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
              {(u as any).lockedUntil && new Date((u as any).lockedUntil) > new Date() && (
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 9px", borderRadius: 20, background: "#fff1f2", color: "#dc2626" }}>🔒 مقفل بعد محاولات فاشلة</span>
              )}
              {(u as any).mustChangePassword && (
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 9px", borderRadius: 20, background: "#fffbeb", color: "#d97706" }}>🔑 بانتظار تغيير كلمته</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
              @{u.username} · آخر دخول: {u.lastLogin ? formatKuwaitDateTime(u.lastLogin) : "لم يدخل بعد"}
            </div>
            {((u as any).hats ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                {((u as any).hats as any[]).map((h) => (
                  <span key={h.key} style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 10px", borderRadius: 20, background: "#fdf8ec", color: GD, border: `1px solid ${G}30`, whiteSpace: "nowrap" }}>
                    🎩 {h.name}{h.expiresAt ? ` ⏳ حتى ${String(h.expiresAt).slice(0, 10)}` : ""}
                  </span>
                ))}
              </div>
            )}
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
          <button onClick={onPreview} title="ماذا يرى هذا المستخدم؟"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#ecfeff", color: "#0891b2", border: "1px solid #a5f3fc", cursor: "pointer", fontFamily: "inherit" }}>
            <Eye size={13} /> يرى؟
          </button>
          <button onClick={onViewPositions} title="القبعات (المناصب)"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fdf8ec", color: GD, border: `1px solid ${G}40`, cursor: "pointer", fontFamily: "inherit" }}>
            <KeyRound size={13} /> القبعات
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
          {u.id !== me?.id && u.isActive && (
            <button onClick={onDelete} title="أرشفة آمنة: تعطيل + إنهاء جلساته — بعد نقل أعماله المفتوحة"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff1f2")}>
              <Trash2 size={12} /> أرشفة
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


/* ── نافذة القبعات: منح/سحب المناصب مع سجل دائم — القبعة تضبط الصلاحيات على حزمتها ── */
function PositionsModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: allPositions = [] } = useQuery<any[]>({ queryKey: ["positions"], queryFn: () => positionsApi.list() });
  const { data: mine } = useQuery<{ positions: string[] }>({ queryKey: ["user-positions", user.id], queryFn: () => positionsApi.ofUser(user.id) });
  const { data: audit = [] } = useQuery<any[]>({ queryKey: ["positions-audit"], queryFn: () => positionsApi.audit() });
  const held = mine?.positions ?? [];
  const inv = () => { qc.invalidateQueries({ queryKey: ["user-positions", user.id] }); qc.invalidateQueries({ queryKey: ["positions"] }); qc.invalidateQueries({ queryKey: ["positions-audit"] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); };
  const [grantExpiry, setGrantExpiry] = useState("");
  const grantMut = useMutation({ mutationFn: (key: string) => positionsApi.grant(user.id, key, grantExpiry || undefined), onSuccess: () => { setGrantExpiry(""); inv(); }, onError: (e: any) => alert(e.message) });
  const revokeMut = useMutation({ mutationFn: (key: string) => positionsApi.revoke(user.id, key), onSuccess: inv, onError: (e: any) => alert(e.message) });
  const userAudit = audit.filter((a) => a.targetName === user.fullName).slice(0, 8);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,26,16,.45)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, border: `1.5px solid ${G}33`, width: "min(620px,100%)", maxHeight: "88vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: GR, margin: 0 }}>القبعات — {user.fullName}</h2>
          <button onClick={onClose} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6, cursor: "pointer", display: "inline-flex" }}><XCircle size={15} color="#64748b" /></button>
        </div>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 10px" }}>أول قبعة تضبط صلاحيات المستخدم على حزمتها («القبعة تحدد ما يرى»)، واللاحقة تضيف فوقها، والسحب يسحب ما لا تغطيه قبعة باقية. كل منح وسحب يُقيَّد في السجل باسم فاعله — والمنح والسحب ينهيان جلساته القائمة فورًا.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, background: "#fdf8ec", border: `1px solid ${G}30`, borderRadius: 10, padding: "8px 12px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>⏳ إنابة مؤقتة؟ حدد انتهاءها قبل المنح:</span>
          <input type="date" value={grantExpiry} onChange={(e) => setGrantExpiry(e.target.value)}
            style={{ padding: "5px 9px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          {grantExpiry && <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>القبعة الممنوحة الآن تسقط تلقائيًا بعد هذا التاريخ</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allPositions.map((pos) => {
            const has = held.includes(pos.key);
            const managerial = pos.tier === "إداري";
            return (
              <div key={pos.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: `1.5px solid ${has ? G + "55" : "#f0ead8"}`, background: has ? "#fdf8ec" : "white", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13.5, color: GR }}>{pos.nameAr}</b>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 9px", borderRadius: 20, background: managerial ? "#f5f3ff" : "#f0fdf4", color: managerial ? "#7c3aed" : "#16a34a" }}>{pos.tier}</span>
                    {(pos.holders ?? []).length > 0 && <span style={{ fontSize: 11, color: "#9ca3af" }}>يحملها: {(pos.holders ?? []).map((h: any) => h.fullName + (h.expiresAt ? ` (⏳ ${String(h.expiresAt).slice(0, 10)})` : "")).join("، ")}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{pos.description}</div>
                </div>
                {has
                  ? <button disabled={revokeMut.isPending} onClick={() => revokeMut.mutate(pos.key)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>سحب</button>
                  : <button disabled={grantMut.isPending} onClick={() => grantMut.mutate(pos.key)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, color: "white", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>منح</button>}
              </div>
            );
          })}
        </div>
        {userAudit.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1, marginBottom: 6 }}>آخر الحركات على قبعاته</div>
            {userAudit.map((a) => (
              <div key={a.id} style={{ fontSize: 12, color: "#6b7280", padding: "3px 0", borderBottom: "1px dashed #f0ead8" }}>
                <b style={{ color: a.action === "منح" ? "#16a34a" : "#dc2626" }}>{a.action}</b> {a.positionName} — بواسطة {a.actorName ?? "؟"} · {formatKuwaitDateTime(a.createdAt)}
              </div>
            ))}
          </div>
        )}
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
  const [positionsUser,     setPositionsUser]     = useState<UserRow | null>(null);
  const [permissionsUser,   setPermissionsUser]   = useState<UserRow | null>(null);
  const [previewUser,       setPreviewUser]       = useState<UserRow | null>(null);
  const [pageTab, setPageTab] = useState<"users" | "audit">("users");
  const [q, setQ] = useState("");
  const [hatFilter, setHatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

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
    onError: (e: any) => alert(e.message),
  });

  // سجل الإدارة: قبعات + محاولات دخول
  const { data: hatAudit = [] } = useQuery<any[]>({ queryKey: ["positions-audit"], queryFn: () => positionsApi.audit(), enabled: pageTab === "audit" });
  const { data: loginAttempts = [] } = useQuery<any[]>({ queryKey: ["login-attempts"], queryFn: () => apiFetch("/api/admin/login-attempts"), enabled: pageTab === "audit" });
  const { data: allHats = [] } = useQuery<any[]>({ queryKey: ["positions"], queryFn: () => positionsApi.list() });

  const visibleUsers = users.filter(u => {
    if (statusFilter === "active" && !u.isActive) return false;
    if (statusFilter === "inactive" && u.isActive) return false;
    if (hatFilter && !(((u as any).hats ?? []) as any[]).some((h: any) => h.key === hatFilter)) return false;
    if (q && !(u.fullName.includes(q) || u.username.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
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
          accessOpportunities: (editing as any).accessOpportunities ?? true,
          opportunityCanPrice: (editing as any).opportunityCanPrice ?? false,
          opportunityCanApprove: (editing as any).opportunityCanApprove ?? false,
          taskViewScope: editing.taskViewScope,
          taskCanApprove: editing.taskCanApprove,
          correspondenceViewAll: (editing as any).correspondenceViewAll ?? false,
          permissions: (editing as any).permissions ?? matrixFromLegacy(editing as any),
          recordViewScope: (editing as any).recordViewScope ?? "own",
          ...(newPass ? { password: newPass } : {}),
        },
      });
    } else {
      createMut.mutate({
        ...form,
        permissions: form.permissions ?? defaultMatrix(true, false),
      });
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

      {/* Positions (hats) modal */}
      {positionsUser !== null && (
        <PositionsModal user={positionsUser} onClose={() => setPositionsUser(null)} />
      )}

      {/* Record permissions modal */}
      {permissionsUser !== null && (
        <PermissionsModal user={permissionsUser} onClose={() => setPermissionsUser(null)} />
      )}

      {/* ماذا يرى؟ */}
      {previewUser !== null && (
        <WhatSeesModal u={previewUser} onClose={() => setPreviewUser(null)} />
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

      {/* تبويبا الصفحة: المستخدمون | سجل الإدارة */}
      <div style={{ display: "flex", gap: 6, background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 6, width: "fit-content" }}>
        {([["users", "👥 المستخدمون"], ["audit", "🧾 سجل الإدارة"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setPageTab(id)}
            style={{ padding: "9px 22px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: "none", background: pageTab === id ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: pageTab === id ? "white" : "#6b7280" }}>
            {label}
          </button>
        ))}
      </div>

      {pageTab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "16px 20px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: GR, marginBottom: 10 }}>🎩 سجل القبعات — كل منح وسحب باسم فاعله</div>
            {hatAudit.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 12.5 }}>لا حركات بعد</div> :
              hatAudit.slice(0, 40).map((a: any) => (
                <div key={a.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "5px 0", borderBottom: "1px dashed #f0ead8" }}>
                  <b style={{ color: a.action === "منح" ? "#16a34a" : "#dc2626" }}>{a.action}</b> {a.positionName} — لـ<b>{a.userName ?? `#${a.userId}`}</b> بواسطة {a.actorName ?? "النظام (انتهاء إنابة)"} · {formatKuwaitDateTime(a.createdAt)}
                </div>
              ))}
          </div>
          <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "16px 20px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: GR, marginBottom: 10 }}>🔐 محاولات الدخول الأخيرة — الفاشلة تكشف من يحاول</div>
            {loginAttempts.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 12.5 }}>لا محاولات مسجلة بعد</div> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
                  <thead><tr style={{ background: "#faf8f2" }}>{["المستخدم", "النتيجة", "العنوان", "الوقت"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {loginAttempts.map((a: any) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #f5f0e6", background: a.success ? "white" : "#fff7f7" }}>
                        <td style={{ padding: "6px 12px", fontWeight: 700, color: GR }}>{a.username}</td>
                        <td style={{ padding: "6px 12px" }}>{a.success ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ نجحت</span> : <span style={{ color: "#dc2626", fontWeight: 700 }}>✗ فشلت</span>}</td>
                        <td style={{ padding: "6px 12px", color: "#9ca3af", fontFamily: "monospace", fontSize: 11 }}>{a.ip ?? "—"}</td>
                        <td style={{ padding: "6px 12px", color: "#6b7280" }}>{formatKuwaitDateTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {pageTab === "users" && (
      <>
      {/* بحث وفلاتر */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", width: 260 }}>
          <Search size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو اسم المستخدم..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 36px 9px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", fontFamily: "inherit", background: "white" }} />
        </div>
        <select value={hatFilter} onChange={e => setHatFilter(e.target.value)} style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 12.5, fontFamily: "inherit", background: "white" }}>
          <option value="">🎩 كل القبعات</option>
          {allHats.map((p: any) => <option key={p.key} value={p.key}>{p.nameAr}</option>)}
        </select>
        <div style={{ display: "flex", gap: 4, background: "white", border: "1.5px solid #f0ead8", borderRadius: 10, padding: 4 }}>
          {([["all", "الكل"], ["active", "نشط"], ["inactive", "موقوف"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setStatusFilter(id)}
              style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", background: statusFilter === id ? `${G}22` : "transparent", color: statusFilter === id ? GD : "#6b7280" }}>
              {label}
            </button>
          ))}
        </div>
        {(q || hatFilter || statusFilter !== "all") && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{visibleUsers.length} من {users.length}</span>
        )}
      </div>

      {/* Users list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", height: 160, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : visibleUsers.length === 0 ? (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
          <Users size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>{users.length ? "لا نتائج مطابقة للفلاتر" : "لا يوجد مستخدمون مسجّلون"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibleUsers.map(u => (
            <UserCard key={u.id} u={u} me={me}
              onEdit={() => { closeAll(); setEditing({ ...u }); }}
              onDelete={() => { if (confirm(`أرشفة ${u.fullName}؟ سيُعطَّل حسابه وتُنهى جلساته — وسجلاته التاريخية تبقى.`)) deleteMut.mutate(u.id); }}
              onViewProfile={() => setProfileUserId(u.id)}
              onViewPositions={() => setPositionsUser(u)}
              onViewPermissions={() => setPermissionsUser(u)}
              onPreview={() => setPreviewUser(u)}
            />
          ))}
        </div>
      )}
      </>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
