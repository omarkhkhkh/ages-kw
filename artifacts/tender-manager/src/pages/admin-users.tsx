import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import {
  UserPlus, Trash2, Pencil, ShieldCheck, CheckCircle2, XCircle,
  Eye, Download, Upload, FilePenLine, Save, X, KeyRound
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
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

const empty = {
  username: "", fullName: "", password: "", role: "employee",
  canView: true, canDownload: false, canUpload: false, canEdit: false,
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [newPass, setNewPass] = useState("");

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setShowForm(false); setForm({ ...empty }); },
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
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        ليس لديك صلاحية الوصول إلى هذه الصفحة.
      </div>
    );
  }

  const PermBadge = ({ ok, label, icon: Icon }: { ok: boolean; label: string; icon: any }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-muted-foreground text-sm mt-1">إنشاء الحسابات وتخصيص الصلاحيات</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm({ ...empty }); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" /> إضافة موظف
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border rounded-xl p-6 bg-card shadow-sm space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> موظف جديد</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">اسم المستخدم</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">الاسم الكامل</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">كلمة المرور</label>
              <input type="password" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={form.role === "employee"} onChange={() => setForm(f => ({ ...f, role: "employee" }))} /> موظف
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={form.role === "admin"} onChange={() => setForm(f => ({ ...f, role: "admin" }))} /> مدير
            </label>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { key: "canView", label: "اطلاع", icon: Eye },
              { key: "canDownload", label: "تنزيل", icon: Download },
              { key: "canUpload", label: "تحميل", icon: Upload },
              { key: "canEdit", label: "تعديل", icon: FilePenLine },
            ].map(({ key, label, icon: Icon }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                <Icon className="h-4 w-4 text-muted-foreground" /> {label}
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
              <Save className="h-4 w-4" /> حفظ
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-muted">
              <X className="h-4 w-4" /> إلغاء
            </button>
          </div>
          {createMut.isError && <p className="text-red-500 text-sm">{(createMut.error as Error).message}</p>}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الموظف</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الدور</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الصلاحيات</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">آخر دخول</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3">
                    {editing?.id === u.id ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editing.fullName} onChange={e => setEditing(ed => ed ? { ...ed, fullName: e.target.value } : ed)} />
                    ) : (
                      <div>
                        <div className="font-medium">{u.fullName}</div>
                        <div className="text-muted-foreground text-xs">@{u.username}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing?.id === u.id ? (
                      <select className="border rounded px-2 py-1 text-sm" value={editing.role} onChange={e => setEditing(ed => ed ? { ...ed, role: e.target.value } : ed)}>
                        <option value="employee">موظف</option>
                        <option value="admin">مدير</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        {u.role === "admin" ? <><ShieldCheck className="h-3 w-3" /> مدير</> : "موظف"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing?.id === u.id ? (
                      <div className="flex gap-3 flex-wrap">
                        {[
                          { key: "canView", label: "اطلاع", icon: Eye },
                          { key: "canDownload", label: "تنزيل", icon: Download },
                          { key: "canUpload", label: "تحميل", icon: Upload },
                          { key: "canEdit", label: "تعديل", icon: FilePenLine },
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="checkbox" checked={(editing as any)[key]} onChange={e => setEditing(ed => ed ? { ...ed, [key]: e.target.checked } : ed)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        <PermBadge ok={u.canView} label="اطلاع" icon={Eye} />
                        <PermBadge ok={u.canDownload} label="تنزيل" icon={Download} />
                        <PermBadge ok={u.canUpload} label="تحميل" icon={Upload} />
                        <PermBadge ok={u.canEdit} label="تعديل" icon={FilePenLine} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing?.id === u.id ? (
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={editing.isActive} onChange={e => setEditing(ed => ed ? { ...ed, isActive: e.target.checked } : ed)} />
                        نشط
                      </label>
                    ) : (
                      u.isActive
                        ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> نشط</span>
                        : <span className="inline-flex items-center gap-1 text-red-500 text-xs"><XCircle className="h-3.5 w-3.5" /> موقوف</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {u.lastLogin ? formatKuwaitDateTime(u.lastLogin) : "لم يدخل بعد"}
                  </td>
                  <td className="px-4 py-3">
                    {editing?.id === u.id ? (
                      <div className="flex items-center gap-2">
                        <input type="password" placeholder="كلمة مرور جديدة (اختياري)" className="border rounded px-2 py-1 text-xs w-36" value={newPass} onChange={e => setNewPass(e.target.value)} />
                        <button onClick={() => updateMut.mutate({ id: u.id, data: { fullName: editing.fullName, role: editing.role, canView: editing.canView, canDownload: editing.canDownload, canUpload: editing.canUpload, canEdit: editing.canEdit, isActive: editing.isActive, ...(newPass ? { password: newPass } : {}) } })} className="text-primary hover:opacity-70"><Save className="h-4 w-4" /></button>
                        <button onClick={() => { setEditing(null); setNewPass(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditing({ ...u })} className="text-primary hover:opacity-70"><Pencil className="h-4 w-4" /></button>
                        {u.id !== me?.id && (
                          <button onClick={() => { if (confirm(`حذف ${u.fullName}؟`)) deleteMut.mutate(u.id); }} className="text-red-500 hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">لا يوجد مستخدمون حتى الآن.</div>
          )}
        </div>
      )}
    </div>
  );
}
