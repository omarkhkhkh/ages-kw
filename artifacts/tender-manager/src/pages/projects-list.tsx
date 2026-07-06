import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, entitiesApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen, Plus, Pencil, Trash2, X, Check, Download } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportProjectsToExcel } from "@/lib/export";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed: { label: "مكتمل", color: "bg-blue-50 text-blue-700 border-blue-200" },
  suspended: { label: "موقوف", color: "bg-red-50 text-red-700 border-red-200" },
};

const emptyForm = { tenderId: "", projectNumber: "", name: "", governmentEntityId: "", contractValue: "", startDate: "", endDate: "", status: "active", projectManager: "", completionPercentage: "0", notes: "" };

export default function ProjectsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState("all");

  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects", tab], queryFn: () => projectsApi.list(statusFilter) });
  const { data: entities = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list() });
  const { data: tenders = [] } = useListTenders({ won: true } as any);

  const createM = useMutation({ mutationFn: projectsApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); closeForm(); toast({ title: "تم إضافة المشروع" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => projectsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); closeForm(); toast({ title: "تم تحديث المشروع" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: projectsApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast({ title: "تم حذف المشروع" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const handleEdit = (p: any) => { setEditId(p.id); setForm({ tenderId: p.tenderId || "", projectNumber: p.projectNumber || "", name: p.name, governmentEntityId: p.governmentEntityId || "", contractValue: p.contractValue || "", startDate: p.startDate || "", endDate: p.endDate || "", status: p.status, projectManager: p.projectManager || "", completionPercentage: p.completionPercentage || "0", notes: p.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.name) return; const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, governmentEntityId: form.governmentEntityId ? Number(form.governmentEntityId) : null, contractValue: form.contractValue ? Number(form.contractValue) : null, completionPercentage: form.completionPercentage ? Number(form.completionPercentage) : 0 }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const tabs = [{ id: "all", label: "الجميع" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: v.label }))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المشاريع</h1>
          <p className="text-muted-foreground text-sm mt-1">تتبع المشاريع المنبثقة عن المناقصات الرابحة.</p>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === "admin" || user?.canDownload) && (
            <Button variant="outline" className="gap-2" onClick={() => exportProjectsToExcel(projects)}><Download className="h-4 w-4" />تصدير</Button>
          )}
          {(user?.role === "admin" || user?.canEdit) && (
            <Button onClick={() => { closeForm(); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />مشروع جديد</Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="p-6 shadow-sm border-primary/20">
          <h2 className="text-lg font-semibold mb-4">{editId ? "تعديل المشروع" : "مشروع جديد"}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1"><Label>اسم المشروع *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم المشروع" required /></div>
              <div className="space-y-1"><Label>رقم المشروع</Label><Input value={form.projectNumber} onChange={e => setForm(p => ({ ...p, projectNumber: e.target.value }))} placeholder="رقم المشروع" dir="ltr" /></div>
              <div className="space-y-1"><Label>المناقصة المرتبطة</Label>
                <select value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر المناقصة</option>{(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} - {t.projectName}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>الجهة الحكومية</Label>
                <select value={form.governmentEntityId} onChange={e => setForm(p => ({ ...p, governmentEntityId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر الجهة</option>{(entities as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>قيمة العقد (ريال)</Label><Input type="number" value={form.contractValue} onChange={e => setForm(p => ({ ...p, contractValue: e.target.value }))} min="0" dir="ltr" /></div>
              <div className="space-y-1"><Label>مدير المشروع</Label><Input value={form.projectManager} onChange={e => setForm(p => ({ ...p, projectManager: e.target.value }))} placeholder="اسم مدير المشروع" /></div>
              <div className="space-y-1"><Label>تاريخ البداية</Label><Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>تاريخ الانتهاء</Label><Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>نسبة الإنجاز %</Label><Input type="number" value={form.completionPercentage} onChange={e => setForm(p => ({ ...p, completionPercentage: e.target.value }))} min="0" max="100" dir="ltr" /></div>
              <div className="space-y-1"><Label>الحالة</Label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1 mb-4"><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createM.isPending || updateM.isPending} className="gap-2"><Check className="h-4 w-4" />حفظ</Button>
              <Button type="button" variant="ghost" onClick={closeForm} className="gap-2"><X className="h-4 w-4" />إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex overflow-x-auto gap-1 bg-card border rounded-lg p-2">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors", tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{t.label}</button>)}
      </div>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="font-medium p-4">اسم المشروع</th>
                <th className="font-medium p-4">الجهة</th>
                <th className="font-medium p-4">مدير المشروع</th>
                <th className="font-medium p-4">قيمة العقد</th>
                <th className="font-medium p-4">الإنجاز</th>
                <th className="font-medium p-4">تاريخ الانتهاء</th>
                <th className="font-medium p-4">الحالة</th>
                <th className="font-medium p-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse">{[...Array(8)].map((_, j) => <td key={j} className="p-4"><div className="h-4 bg-muted rounded w-20" /></td>)}</tr>)
                : projects.length === 0 ? <tr><td colSpan={8} className="p-12 text-center text-muted-foreground"><FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted" /><p>لا توجد مشاريع مسجلة</p></td></tr>
                : (projects as any[]).map((p: any) => {
                  const st = STATUS_MAP[p.status] || STATUS_MAP.active;
                  const pct = Number(p.completionPercentage) || 0;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4"><div className="font-medium text-foreground">{p.name}</div><div className="text-xs text-muted-foreground">{p.projectNumber}</div></td>
                      <td className="p-4 text-muted-foreground">{p.entityName || "—"}</td>
                      <td className="p-4 text-muted-foreground">{p.projectManager || "—"}</td>
                      <td className="p-4 font-mono text-xs">{p.contractValue ? formatCurrency(p.contractValue) : "—"}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 w-20"><div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{formatDate(p.endDate)}</td>
                      <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs border ${st.color}`}>{st.label}</span></td>
                      <td className="p-4 text-left">
                        {(user?.role === "admin" || user?.canEdit) && (
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("حذف المشروع؟")) deleteM.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
