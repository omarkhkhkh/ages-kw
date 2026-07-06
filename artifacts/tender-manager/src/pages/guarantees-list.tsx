import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guaranteesApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Plus, Pencil, Trash2, X, Check, AlertTriangle, Download } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportGuaranteesToExcel } from "@/lib/export";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "فعّالة", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expired: { label: "منتهية", color: "bg-red-50 text-red-700 border-red-200" },
  released: { label: "مُفرج عنها", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const GUARANTEE_TYPES = ["ابتدائية", "نهائية", "دفعة مقدمة", "ضمان صيانة", "أخرى"];
const emptyForm = { tenderId: "", guaranteeNumber: "", type: "", bankName: "", amount: "", issueDate: "", expiryDate: "", status: "active", notes: "" };

function isNearExpiry(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

export default function GuaranteesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState("all");

  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: guarantees = [], isLoading } = useQuery({ queryKey: ["guarantees", tab], queryFn: () => guaranteesApi.list(statusFilter) });
  const { data: tenders = [] } = useListTenders({});

  const createM = useMutation({ mutationFn: guaranteesApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantees"] }); closeForm(); toast({ title: "تم إضافة الكفالة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => guaranteesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantees"] }); closeForm(); toast({ title: "تم تحديث الكفالة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: guaranteesApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantees"] }); toast({ title: "تم حذف الكفالة" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const handleEdit = (g: any) => { setEditId(g.id); setForm({ tenderId: g.tenderId || "", guaranteeNumber: g.guaranteeNumber || "", type: g.type || "", bankName: g.bankName || "", amount: g.amount || "", issueDate: g.issueDate || "", expiryDate: g.expiryDate || "", status: g.status, notes: g.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.type) return; const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, amount: form.amount ? Number(form.amount) : null }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const tabs = [{ id: "all", label: "الجميع" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: v.label }))];
  const expiring = (guarantees as any[]).filter((g: any) => isNearExpiry(g.expiryDate) && g.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الكفالات البنكية</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة الكفالات البنكية المرتبطة بالمناقصات.</p>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === "admin" || user?.canDownload) && (
            <Button variant="outline" className="gap-2" onClick={() => exportGuaranteesToExcel(guarantees as any[])}><Download className="h-4 w-4" />تصدير</Button>
          )}
          {(user?.role === "admin" || user?.canEdit) && (
            <Button onClick={() => { closeForm(); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />كفالة جديدة</Button>
          )}
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{expiring.length} كفالة تنتهي خلال 30 يوماً — تأكد من التجديد في الوقت المناسب.</span>
        </div>
      )}

      {showForm && (
        <Card className="p-6 shadow-sm border-primary/20">
          <h2 className="text-lg font-semibold mb-4">{editId ? "تعديل الكفالة" : "كفالة بنكية جديدة"}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1"><Label>نوع الكفالة *</Label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" required>
                  <option value="">اختر النوع</option>{GUARANTEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>رقم الكفالة</Label><Input value={form.guaranteeNumber} onChange={e => setForm(p => ({ ...p, guaranteeNumber: e.target.value }))} placeholder="رقم الكفالة" dir="ltr" /></div>
              <div className="space-y-1"><Label>المناقصة</Label>
                <select value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر المناقصة</option>{(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} - {t.projectName}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>اسم البنك</Label><Input value={form.bankName} onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))} placeholder="اسم البنك" /></div>
              <div className="space-y-1"><Label>المبلغ (ريال)</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} min="0" dir="ltr" /></div>
              <div className="space-y-1"><Label>الحالة</Label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>تاريخ الإصدار</Label><Input type="date" value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>تاريخ الانتهاء</Label><Input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} /></div>
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
                <th className="font-medium p-4">رقم الكفالة</th>
                <th className="font-medium p-4">النوع</th>
                <th className="font-medium p-4">المناقصة</th>
                <th className="font-medium p-4">البنك</th>
                <th className="font-medium p-4">المبلغ</th>
                <th className="font-medium p-4">تاريخ الانتهاء</th>
                <th className="font-medium p-4">الحالة</th>
                <th className="font-medium p-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse">{[...Array(8)].map((_, j) => <td key={j} className="p-4"><div className="h-4 bg-muted rounded w-20" /></td>)}</tr>)
                : guarantees.length === 0 ? <tr><td colSpan={8} className="p-12 text-center text-muted-foreground"><ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted" /><p>لا توجد كفالات بنكية مسجلة</p></td></tr>
                : (guarantees as any[]).map((g: any) => {
                  const st = STATUS_MAP[g.status] || STATUS_MAP.active;
                  const nearExpiry = isNearExpiry(g.expiryDate) && g.status === "active";
                  return (
                    <tr key={g.id} className={cn("hover:bg-muted/30 transition-colors", nearExpiry && "bg-amber-50/50")}>
                      <td className="p-4 font-mono text-xs">{g.guaranteeNumber || `BG-${g.id}`} {nearExpiry && <AlertTriangle className="h-3.5 w-3.5 inline text-amber-500 mr-1" />}</td>
                      <td className="p-4 font-medium">{g.type || "—"}</td>
                      <td className="p-4 text-muted-foreground text-xs">{g.projectName || "—"}</td>
                      <td className="p-4 text-muted-foreground">{g.bankName || "—"}</td>
                      <td className="p-4 font-mono text-xs">{g.amount ? formatCurrency(g.amount) : "—"}</td>
                      <td className={cn("p-4", nearExpiry ? "text-amber-700 font-medium" : "text-muted-foreground")}>{formatDate(g.expiryDate)}</td>
                      <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs border ${st.color}`}>{st.label}</span></td>
                      <td className="p-4 text-left">
                        {(user?.role === "admin" || user?.canEdit) && (
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("حذف الكفالة؟")) deleteM.mutate(g.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
