import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rfqApi, suppliersApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useListTenders } from "@workspace/api-client-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار الرد", color: "bg-amber-50 text-amber-700 border-amber-200" },
  received: { label: "تم الاستلام", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "مرفوض", color: "bg-red-50 text-red-700 border-red-200" },
};

const emptyForm = { tenderId: "", supplierId: "", rfqNumber: "", itemDescription: "", requestDate: "", responseDeadline: "", quotedPrice: "", status: "pending", notes: "" };

export default function RfqList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: rfqs = [], isLoading } = useQuery({ queryKey: ["rfq-requests"], queryFn: () => rfqApi.list() });
  const { data: tenders = [] } = useListTenders({});
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });

  const createM = useMutation({ mutationFn: rfqApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["rfq-requests"] }); closeForm(); toast({ title: "تم إضافة طلب العرض" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateM = useMutation({ mutationFn: ({ id, data }: any) => rfqApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["rfq-requests"] }); closeForm(); toast({ title: "تم تحديث طلب العرض" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteM = useMutation({ mutationFn: rfqApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["rfq-requests"] }); toast({ title: "تم حذف طلب العرض" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const handleEdit = (r: any) => { setEditId(r.id); setForm({ tenderId: r.tenderId || "", supplierId: r.supplierId || "", rfqNumber: r.rfqNumber || "", itemDescription: r.itemDescription || "", requestDate: r.requestDate || "", responseDeadline: r.responseDeadline || "", quotedPrice: r.quotedPrice || "", status: r.status, notes: r.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.itemDescription) return; const data = { ...form, tenderId: form.tenderId ? Number(form.tenderId) : null, supplierId: form.supplierId ? Number(form.supplierId) : null, quotedPrice: form.quotedPrice ? Number(form.quotedPrice) : null }; editId ? updateM.mutate({ id: editId, data }) : createM.mutate(data); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">طلبات عروض الأسعار</h1>
          <p className="text-muted-foreground text-sm mt-1">تتبع طلبات الأسعار المرسلة للموردين لكل مناقصة.</p>
        </div>
        <Button onClick={() => { closeForm(); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />طلب عرض جديد</Button>
      </div>

      {showForm && (
        <Card className="p-6 shadow-sm border-primary/20">
          <h2 className="text-lg font-semibold mb-4">{editId ? "تعديل طلب العرض" : "طلب عرض سعر جديد"}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1"><Label>المناقصة</Label>
                <select value={form.tenderId} onChange={e => setForm(p => ({ ...p, tenderId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر المناقصة</option>{(tenders as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} - {t.projectName}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>المورد</Label>
                <select value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر المورد</option>{(suppliers as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>رقم الطلب</Label><Input value={form.rfqNumber} onChange={e => setForm(p => ({ ...p, rfqNumber: e.target.value }))} placeholder="رقم طلب العرض" /></div>
              <div className="space-y-1"><Label>الحالة</Label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2"><Label>وصف البند *</Label><Input value={form.itemDescription} onChange={e => setForm(p => ({ ...p, itemDescription: e.target.value }))} placeholder="وصف البند أو الخدمة المطلوبة" required /></div>
              <div className="space-y-1"><Label>تاريخ الطلب</Label><Input type="date" value={form.requestDate} onChange={e => setForm(p => ({ ...p, requestDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>آخر موعد للرد</Label><Input type="date" value={form.responseDeadline} onChange={e => setForm(p => ({ ...p, responseDeadline: e.target.value }))} /></div>
              <div className="space-y-1"><Label>السعر المقدم (ريال)</Label><Input type="number" value={form.quotedPrice} onChange={e => setForm(p => ({ ...p, quotedPrice: e.target.value }))} min="0" dir="ltr" /></div>
              <div className="space-y-1"><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createM.isPending || updateM.isPending} className="gap-2"><Check className="h-4 w-4" />حفظ</Button>
              <Button type="button" variant="ghost" onClick={closeForm} className="gap-2"><X className="h-4 w-4" />إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="font-medium p-4">رقم الطلب</th>
                <th className="font-medium p-4">البند</th>
                <th className="font-medium p-4">المورد</th>
                <th className="font-medium p-4">تاريخ الطلب</th>
                <th className="font-medium p-4">آخر موعد</th>
                <th className="font-medium p-4">السعر</th>
                <th className="font-medium p-4">الحالة</th>
                <th className="font-medium p-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse">{[...Array(8)].map((_, j) => <td key={j} className="p-4"><div className="h-4 bg-muted rounded w-20" /></td>)}</tr>)
                : rfqs.length === 0 ? <tr><td colSpan={8} className="p-12 text-center text-muted-foreground"><ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted" /><p>لا توجد طلبات عروض أسعار</p></td></tr>
                : (rfqs as any[]).map((r: any) => {
                  const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-xs">{r.rfqNumber || `RFQ-${r.id}`}</td>
                      <td className="p-4 max-w-[200px]"><div className="line-clamp-2">{r.itemDescription}</div></td>
                      <td className="p-4 text-muted-foreground">{r.supplierName || "—"}</td>
                      <td className="p-4 text-muted-foreground">{formatDate(r.requestDate)}</td>
                      <td className="p-4 text-muted-foreground">{formatDate(r.responseDeadline)}</td>
                      <td className="p-4 font-mono text-xs">{r.quotedPrice ? formatCurrency(r.quotedPrice) : "—"}</td>
                      <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs border ${st.color}`}>{st.label}</span></td>
                      <td className="p-4 text-left">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("حذف هذا الطلب؟")) deleteM.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
