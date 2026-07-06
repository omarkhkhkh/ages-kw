import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { Link } from "wouter";
import {
  UserPlus, Trash2, Pencil, ShieldCheck, CheckCircle2, XCircle,
  Eye, Download, Upload, FilePenLine, Save, X, Activity,
} from "lucide-react";
import { formatKuwaitDateTime } from "@/lib/timezone";

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  role: string;
  canView: boolean;
  canDownload: boolean;
  canUpload: boolean;
  canEdit: boolean;
  accessTenders: boolean;
  accessEntities: boolean;
  accessSuppliers: boolean;
  accessProjects: boolean;
  accessGuarantees: boolean;
  accessContracts: boolean;
  accessRfq: boolean;
  accessPo: boolean;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

const MODULES = [
  { key: "accessTenders",   label: "المناقصات" },
  { key: "accessEntities",  label: "الجهات الحكومية" },
  { key: "accessSuppliers", label: "الموردون" },
  { key: "accessProjects",  label: "المشاريع" },
  { key: "accessGuarantees",label: "الكفالات البنكية" },
  { key: "accessContracts", label: "العقود" },
  { key: "accessRfq",       label: "طلبات عروض الأسعار" },
  { key: "accessPo",        label: "أوامر الشراء المباشر" },
] as const;

const GLOBAL_PERMS = [
  { key: "canView",     label: "اطلاع على البيانات",  icon: Eye },
  { key: "canDownload", label: "تنزيل / تصدير",        icon: Download },
  { key: "canUpload",   label: "رفع الملفات",           icon: Upload },
  { key: "canEdit",     label: "تعديل / إضافة / حذف",  icon: FilePenLine },
] as const;

const defaultForm = {
  username: "", fullName: "", password: "", role: "employee",
  canView: true, canDownload: false, canUpload: false, canEdit: false,
  accessTenders: true, accessEntities: true, accessSuppliers: true, accessProjects: true,
  accessGuarantees: true, accessContracts: true, accessRfq: true, accessPo: true,
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [newPass, setNewPass] = useState("");

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setShowForm(false); setForm({ ...defaultForm }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setEditing(null); setNewPass(""); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (me?.role !== "admin") {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">ليس لديك صلاحية الوصول.</div>;
  }

  function saveEditing() {
    if (!editing) return;
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
  }

  const Chk = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-1.5 cursor-pointer text-sm select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-300 text-primary" />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-muted-foreground text-sm mt-1">إنشاء الحسابات وتخصيص الصلاحيات والوحدات المتاحة</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/activity-log">
            <button className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-muted">
              <Activity className="h-4 w-4" /> سجل الحركات
            </button>
          </Link>
          <button onClick={() => { setShowForm(true); setForm({ ...defaultForm }); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <UserPlus className="h-4 w-4" /> إضافة موظف
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border rounded-xl p-6 bg-card shadow-sm space-y-5">
          <h2 className="font-semibold text-lg flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> موظف جديد</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-muted-foreground">اسم المستخدم *</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">الاسم الكامل *</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-muted-foreground">كلمة المرور *</label>
              <input type="password" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-muted-foreground">الدور:</span>
            {["employee", "admin"].map(r => (
              <label key={r} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={form.role === r} onChange={() => setForm(f => ({ ...f, role: r }))} />
                {r === "admin" ? "مدير" : "موظف"}
              </label>
            ))}
          </div>

          {/* Global permissions */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">الصلاحيات العامة:</p>
            <div className="flex gap-6 flex-wrap">
              {GLOBAL_PERMS.map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                  <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                </label>
              ))}
            </div>
          </div>

          {/* Module access */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">الوحدات المتاحة للموظف:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {MODULES.map(({ key, label }) => (
                <Chk key={key} checked={(form as any)[key]} onChange={v => setForm(f => ({ ...f, [key]: v }))} label={label} />
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
              <Save className="h-4 w-4" /> حفظ
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-muted">
              <X className="h-4 w-4" /> إلغاء
            </button>
          </div>
          {createMut.isError && <p className="text-red-500 text-sm">{(createMut.error as Error).message}</p>}
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="border rounded-xl bg-card shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {u.fullName.charAt(0)}
                  </div>
                  <div>
                    {editing?.id === u.id ? (
                      <input className="border rounded px-2 py-1 text-sm font-medium"
                        value={editing.fullName} onChange={e => setEditing(ed => ed ? { ...ed, fullName: e.target.value } : ed)} />
                    ) : (
                      <div className="font-medium text-foreground">{u.fullName}</div>
                    )}
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                  {editing?.id === u.id ? (
                    <select className="border rounded px-2 py-1 text-xs"
                      value={editing.role} onChange={e => setEditing(ed => ed ? { ...ed, role: e.target.value } : ed)}>
                      <option value="employee">موظف</option>
                      <option value="admin">مدير</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {u.role === "admin" ? <><ShieldCheck className="h-3 w-3" /> مدير</> : "موظف"}
                    </span>
                  )}
                  {editing?.id === u.id ? (
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={editing.isActive}
                        onChange={e => setEditing(ed => ed ? { ...ed, isActive: e.target.checked } : ed)} /> نشط
                    </label>
                  ) : (
                    u.isActive
                      ? <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> نشط</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle className="h-3.5 w-3.5" /> موقوف</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>آخر دخول: {u.lastLogin ? formatKuwaitDateTime(u.lastLogin) : "لم يدخل بعد"}</span>
                  {editing?.id === u.id ? (
                    <>
                      <input type="password" placeholder="كلمة مرور جديدة (اختياري)"
                        className="border rounded px-2 py-1 text-xs w-36" value={newPass} onChange={e => setNewPass(e.target.value)} />
                      <button onClick={saveEditing} className="text-primary hover:opacity-70"><Save className="h-4 w-4" /></button>
                      <button onClick={() => { setEditing(null); setNewPass(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <Link href={`/admin/activity-log?userId=${u.id}`}>
                        <button className="text-muted-foreground hover:text-primary" title="سجل الحركة"><Activity className="h-4 w-4" /></button>
                      </Link>
                      <button onClick={() => setEditing({ ...u })} className="text-primary hover:opacity-70"><Pencil className="h-4 w-4" /></button>
                      {u.id !== me?.id && (
                        <button onClick={() => { if (confirm(`حذف ${u.fullName}؟`)) deleteMut.mutate(u.id); }}
                          className="text-red-500 hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Permissions body */}
              <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Global perms */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">الصلاحيات العامة</p>
                  <div className="flex flex-wrap gap-3">
                    {GLOBAL_PERMS.map(({ key, label, icon: Icon }) => (
                      editing?.id === u.id ? (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input type="checkbox" checked={(editing as any)[key]}
                            onChange={e => setEditing(ed => ed ? { ...ed, [key]: e.target.checked } : ed)} />
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
                        </label>
                      ) : (
                        <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${(u as any)[key] ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                          <Icon className="h-3 w-3" /> {label}
                        </span>
                      )
                    ))}
                  </div>
                </div>

                {/* Module access */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">الوحدات المتاحة</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MODULES.map(({ key, label }) => (
                      editing?.id === u.id ? (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input type="checkbox" checked={(editing as any)[key]}
                            onChange={e => setEditing(ed => ed ? { ...ed, [key]: e.target.checked } : ed)} />
                          {label}
                        </label>
                      ) : (
                        <span key={key} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${(u as any)[key] ? "text-emerald-700" : "text-slate-400 line-through"}`}>
                          {(u as any)[key] ? "✓" : "✗"} {label}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="py-12 text-center text-muted-foreground border rounded-xl">لا يوجد مستخدمون.</div>
          )}
        </div>
      )}
    </div>
  );
}
