import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, suppliersApi, entitiesApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "bg-slate-100 text-slate-700 border-slate-200" },
  in_progress: { label: "جاري التنفيذ", color: "bg-blue-50 text-blue-700 border-blue-200" },
  delivered: { label: "تم التسليم", color: "bg-amber-50 text-amber-700 border-amber-200" },
  completed: { label: "مكتمل", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const emptyForm = { orderNumber: "", supplierId: "", governmentEntityId: "", description: "", amount: "", orderDate: "", deliveryDate: "", status: "new", notes: "" };

export default function PurchaseOrdersList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState("all");

  const statusFilter = tab !== "all" ? tab : undefined;
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["purchase-orders", tab], queryFn: () => purchaseOrdersApi.list(statusFilter) });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });
  const { data: entities = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list() });

  const createM = useMutation({ mutationFn: purchaseOrdersApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); closeForm(); toast({ title: "تم إضافة أمر الشراء" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => purchaseOrdersApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); closeForm(); toast({ title: "تم تحديث أمر الشراء" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: purchaseOrdersApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); toast({ title: "تم حذف أمر الشراء" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const handleEdit = (o: any) => { setEditId(o.id); setForm({ orderNumber: o.orderNumber, supplierId: o.supplierId || "", governmentEntityId: o.governmentEntityId || "", description: o.description, amount: o.amount || "", orderDate: o.orderDate || "", deliveryDate: o.deliveryDate || "", status: o.status, notes: o.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.orderNumber || !form.description) return; const data = { ...form, supplierId: form.supplierId ? Number(form.supplierId) : null, governmentEntityId: form.governmentEntityId ? Number(form.governmentEntityId) : null, amount: form.amount ? Number(form.amount) : null }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  const tabs = [{ id: "all", label: "الجميع" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, label: v.label }))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">أوامر الشراء المباشر</h1>
          <p className="text-muted-foreground text-sm mt-1">تتبع أوامر الشراء المباشر بدون مناقصة.</p>
        </div>
        <Button onClick={() => { closeForm(); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />أمر شراء جديد</Button>
      </div>

      {showForm && (
        <Card className="p-6 shadow-sm border-primary/20">
          <h2 className="text-lg font-semibold mb-4">{editId ? "تعديل أمر الشراء" : "أمر شراء جديد"}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1"><Label>رقم الأمر *</Label><Input value={form.orderNumber} onChange={e => setForm(p => ({ ...p, orderNumber: e.target.value }))} placeholder="رقم أمر الشراء" required dir="ltr" /></div>
              <div className="space-y-1"><Label>الحالة</Label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>المورد</Label>
                <select value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر المورد</option>{(suppliers as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>الجهة الحكومية</Label>
                <select value={form.governmentEntityId} onChange={e => setForm(p => ({ ...p, governmentEntityId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر الجهة</option>{(entities as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2"><Label>وصف الشراء *</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف البضاعة أو الخدمة" required /></div>
              <div className="space-y-1"><Label>المبلغ (ريال)</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} min="0" dir="ltr" /></div>
              <div className="space-y-1"><Label>تاريخ الأمر</Label><Input type="date" value={form.orderDate} onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>تاريخ التسليم المتوقع</Label><Input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({ ...p, deliveryDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
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
                <th className="font-medium p-4">رقم الأمر</th>
                <th className="font-medium p-4">الوصف</th>
                <th className="font-medium p-4">المورد</th>
                <th className="font-medium p-4">الجهة</th>
                <th className="font-medium p-4">المبلغ</th>
                <th className="font-medium p-4">تاريخ الأمر</th>
                <th className="font-medium p-4">الحالة</th>
                <th className="font-medium p-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse">{[...Array(8)].map((_, j) => <td key={j} className="p-4"><div className="h-4 bg-muted rounded w-20" /></td>)}</tr>)
                : orders.length === 0 ? <tr><td colSpan={8} className="p-12 text-center text-muted-foreground"><ShoppingCart className="h-10 w-10 mx-auto mb-3 text-muted" /><p>لا توجد أوامر شراء</p></td></tr>
                : (orders as any[]).map((o: any) => {
                  const st = STATUS_MAP[o.status] || STATUS_MAP.new;
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-xs font-medium">{o.orderNumber}</td>
                      <td className="p-4 max-w-[180px]"><div className="line-clamp-2">{o.description}</div></td>
                      <td className="p-4 text-muted-foreground">{o.supplierName || "—"}</td>
                      <td className="p-4 text-muted-foreground">{o.entityName || "—"}</td>
                      <td className="p-4 font-mono text-xs">{o.amount ? formatCurrency(o.amount) : "—"}</td>
                      <td className="p-4 text-muted-foreground">{formatDate(o.orderDate)}</td>
                      <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs border ${st.color}`}>{st.label}</span></td>
                      <td className="p-4 text-left">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("حذف أمر الشراء؟")) deleteM.mutate(o.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
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
