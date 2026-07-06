import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateTender, getListTendersQueryKey, getGetTenderStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { TenderStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_ARABIC } from "@/lib/constants";
import { ArrowRight, Save, Loader2 } from "lucide-react";

export default function TenderNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createTender = useCreateTender();

  const [formData, setFormData] = useState({
    tenderNumber: "",
    projectName: "",
    governmentEntity: "",
    tenderType: "",
    announcementDate: "",
    deadline: "",
    bondValue: "",
    docsValue: "",
    responsibleEngineer: "",
    status: TenderStatus.new,
    notes: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // basic validation
    if (!formData.tenderNumber || !formData.projectName) {
      alert("رقم المناقصة واسم المشروع مطلوبان");
      return;
    }

    createTender.mutate(
      { 
        data: {
          ...formData,
          bondValue: formData.bondValue ? Number(formData.bondValue) : undefined,
          docsValue: formData.docsValue ? Number(formData.docsValue) : undefined,
        } as any
      },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
          setLocation(`/tenders/${data.id}`);
        },
        onError: (error) => {
          console.error("Failed to create tender", error);
          alert("حدث خطأ أثناء حفظ المناقصة");
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">مناقصة جديدة</h1>
          <p className="text-muted-foreground text-sm mt-1">إدخال تفاصيل مناقصة جديدة للنظام.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-lg">المعلومات الأساسية</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tenderNumber">رقم المناقصة <span className="text-destructive">*</span></Label>
              <Input 
                id="tenderNumber" name="tenderNumber" 
                value={formData.tenderNumber} onChange={handleChange}
                placeholder="مثال: 1445/05/20"
                required
                className="font-mono text-left dir-ltr"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectName">اسم المشروع <span className="text-destructive">*</span></Label>
              <Input 
                id="projectName" name="projectName" 
                value={formData.projectName} onChange={handleChange}
                placeholder="اسم المشروع كما ورد في كراسة الشروط"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="governmentEntity">الجهة الحكومية</Label>
              <Input 
                id="governmentEntity" name="governmentEntity" 
                value={formData.governmentEntity} onChange={handleChange}
                placeholder="مثال: وزارة الصحة"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenderType">نوع المناقصة</Label>
              <Input 
                id="tenderType" name="tenderType" 
                value={formData.tenderType} onChange={handleChange}
                placeholder="مثال: عامة، محدودة، دعوة مباشرة"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-lg">التواريخ والمبالغ</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <Label htmlFor="announcementDate">تاريخ الإعلان</Label>
              <Input 
                type="date" id="announcementDate" name="announcementDate" 
                value={formData.announcementDate} onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">آخر موعد للتقديم</Label>
              <Input 
                type="date" id="deadline" name="deadline" 
                value={formData.deadline} onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="docsValue">قيمة الكراسة (ريال)</Label>
              <Input 
                type="number" id="docsValue" name="docsValue" 
                value={formData.docsValue} onChange={handleChange}
                min="0"
                className="font-mono text-left" dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bondValue">الضمان الابتدائي (ريال)</Label>
              <Input 
                type="number" id="bondValue" name="bondValue" 
                value={formData.bondValue} onChange={handleChange}
                min="0"
                className="font-mono text-left" dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-lg">المتابعة والحالة</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="responsibleEngineer">المهندس المسؤول</Label>
              <Input 
                id="responsibleEngineer" name="responsibleEngineer" 
                value={formData.responsibleEngineer} onChange={handleChange}
                placeholder="اسم المهندس المكلف"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">الحالة المبدئية</Label>
              <select 
                id="status" name="status" 
                value={formData.status} onChange={handleChange}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {Object.entries(STATUS_ARABIC).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">ملاحظات إضافية</Label>
              <Textarea 
                id="notes" name="notes" 
                value={formData.notes} onChange={handleChange}
                placeholder="أي ملاحظات أو متطلبات خاصة بالمناقصة..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            إلغاء
          </Button>
          <Button type="submit" disabled={createTender.isPending} className="min-w-[120px] gap-2">
            {createTender.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ المناقصة
          </Button>
        </div>
      </form>
    </div>
  );
}
