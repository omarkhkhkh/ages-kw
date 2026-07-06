import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPPLIER_TYPES = ["مقاول", "مورد", "استشاري", "مصنّع", "أخرى"];
const emptyForm = { name: "", type: "", contactPerson: "", phone: "", email: "", address: "", specialization: "", commercialRegNo: "", notes: "" };

export default function SuppliersList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });

  const createMutation = useMutation({ mutationFn: suppliersApi.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); closeForm(); toast({ title: "تم إضافة المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const updateMutation = useMutation({ mutationFn: ({ id, data }: any) => suppliersApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); closeForm(); toast({ title: "تم تحديث المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const deleteMutation = useMutation({ mutationFn: suppliersApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "تم حذف المورد" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };
  const handleEdit = (s: any) => { setEditId(s.id); setForm({ name: s.name, type: s.type || "", contactPerson: s.contactPerson || "", phone: s.phone || "", email: s.email || "", address: s.address || "", specialization: s.specialization || "", commercialRegNo: s.commercialRegNo || "", notes: s.notes || "" }); setShowForm(true); };
  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); if (!form.name) return; editId ? updateMutation.mutate({ id: editId, data: form }) : createMutation.mutate(form); };
  const filtered = suppliers.filter((s: any) => !search || s.name.includes(search) || (s.specialization || "").includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الموردون والمقاولون</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة الموردين والمقاولين المشاركين في المناقصات.</p>
        </div>
        <Button onClick={() => { closeForm(); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" />إضافة مورد</Button>
      </div>

      {showForm && (
        <Card className="p-6 shadow-sm border-primary/20">
          <h2 className="text-lg font-semibold mb-4">{editId ? "تعديل المورد" : "مورد جديد"}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1"><Label>اسم المورد *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الشركة أو المورد" required /></div>
              <div className="space-y-1"><Label>النوع</Label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">اختر النوع</option>{SUPPLIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>التخصص</Label><Input value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} placeholder="مجال العمل أو التخصص" /></div>
              <div className="space-y-1"><Label>السجل التجاري</Label><Input value={form.commercialRegNo} onChange={e => setForm(p => ({ ...p, commercialRegNo: e.target.value }))} placeholder="رقم السجل التجاري" dir="ltr" /></div>
              <div className="space-y-1"><Label>الشخص المسؤول</Label><Input value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} placeholder="اسم المسؤول" /></div>
              <div className="space-y-1"><Label>الهاتف</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="رقم الهاتف" dir="ltr" /></div>
              <div className="space-y-1"><Label>البريد الإلكتروني</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" dir="ltr" /></div>
              <div className="space-y-1"><Label>العنوان</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="العنوان" /></div>
            </div>
            <div className="space-y-1 mb-4"><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات" /></div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="gap-2"><Check className="h-4 w-4" />حفظ</Button>
              <Button type="button" variant="ghost" onClick={closeForm} className="gap-2"><X className="h-4 w-4" />إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="relative w-full md:w-72">
        <Input placeholder="بحث باسم المورد أو التخصص..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="font-medium p-4">اسم المورد</th>
                <th className="font-medium p-4">النوع</th>
                <th className="font-medium p-4">التخصص</th>
                <th className="font-medium p-4">الشخص المسؤول</th>
                <th className="font-medium p-4">الهاتف</th>
                <th className="font-medium p-4 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? [...Array(4)].map((_, i) => <tr key={i} className="animate-pulse"><td className="p-4"><div className="h-4 bg-muted rounded w-32" /></td><td className="p-4"><div className="h-4 bg-muted rounded w-20" /></td><td className="p-4"><div className="h-4 bg-muted rounded w-24" /></td><td className="p-4"><div className="h-4 bg-muted rounded w-24" /></td><td className="p-4"><div className="h-4 bg-muted rounded w-20" /></td><td /></tr>)
                : filtered.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 text-muted" /><p>لا يوجد موردون مسجلون</p></td></tr>
                : filtered.map((s: any) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-foreground">{s.name}</td>
                    <td className="p-4"><span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">{s.type || "—"}</span></td>
                    <td className="p-4 text-muted-foreground">{s.specialization || "—"}</td>
                    <td className="p-4 text-muted-foreground">{s.contactPerson || "—"}</td>
                    <td className="p-4 text-muted-foreground" dir="ltr">{s.phone || "—"}</td>
                    <td className="p-4 text-left">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("هل تريد حذف هذا المورد؟")) deleteMutation.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
