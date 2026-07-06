import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetTender, 
  useUpdateTender, 
  useDeleteTender,
  getGetTenderQueryKey,
  getListTendersQueryKey,
  getGetTenderStatsQueryKey
} from "@workspace/api-client-react";
import { TenderStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import { 
  ArrowRight, Save, Trash2, Clock, MapPin, Building, FileText, 
  CheckCircle2, XCircle, AlertTriangle, User, Loader2
} from "lucide-react";

export default function TenderDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: tender, isLoading } = useGetTender(id, {
    query: { enabled: !!id, queryKey: getGetTenderQueryKey(id) }
  });

  const updateTender = useUpdateTender();
  const deleteTender = useDeleteTender();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const initialized = useRef(false);

  useEffect(() => {
    if (tender && !initialized.current) {
      setFormData({
        tenderNumber: tender.tenderNumber || "",
        projectName: tender.projectName || "",
        governmentEntity: tender.governmentEntity || "",
        tenderType: tender.tenderType || "",
        announcementDate: tender.announcementDate ? tender.announcementDate.split('T')[0] : "",
        deadline: tender.deadline ? tender.deadline.split('T')[0] : "",
        bondValue: tender.bondValue || "",
        docsValue: tender.docsValue || "",
        responsibleEngineer: tender.responsibleEngineer || "",
        status: tender.status,
        offerValue: tender.offerValue || "",
        profitPercentage: tender.profitPercentage || "",
        winner: tender.winner || "",
        notes: tender.notes || ""
      });
      initialized.current = true;
    }
  }, [tender]);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!tender) {
    return <div className="p-8 text-center text-muted-foreground">المناقصة غير موجودة</div>;
  }

  const handleStatusChange = (newStatus: TenderStatus) => {
    updateTender.mutate(
      { id, data: { status: newStatus } as any },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetTenderQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
        }
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const payload = {
      ...formData,
      bondValue: formData.bondValue ? Number(formData.bondValue) : null,
      docsValue: formData.docsValue ? Number(formData.docsValue) : null,
      offerValue: formData.offerValue ? Number(formData.offerValue) : null,
      profitPercentage: formData.profitPercentage ? Number(formData.profitPercentage) : null,
    };

    updateTender.mutate(
      { id, data: payload as any },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetTenderQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
          setIsEditing(false);
        }
      }
    );
  };

  const handleDelete = () => {
    if (confirm("هل أنت متأكد من حذف هذه المناقصة بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.")) {
      deleteTender.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTendersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
            setLocation("/tenders");
          }
        }
      );
    }
  };

  const urgent = isUrgent(tender.deadline, tender.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full mt-1 shrink-0">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {tender.tenderNumber}
              </span>
              <span className={cn("px-2.5 py-0.5 text-xs font-semibold rounded-full border", STATUS_COLORS[tender.status])}>
                {STATUS_ARABIC[tender.status]}
              </span>
              {urgent && (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> عاجل
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
              {tender.projectName}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Building className="h-4 w-4" />
                {tender.governmentEntity || "غير محدد"}
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {tender.responsibleEngineer || "لم يتم التعيين"}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing ? (
            <>
              <Button onClick={() => setIsEditing(true)} variant="outline">
                تعديل البيانات
              </Button>
              <select 
                value={tender.status}
                onChange={(e) => handleStatusChange(e.target.value as TenderStatus)}
                className="h-9 rounded-md border border-input bg-primary text-primary-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium cursor-pointer appearance-none"
              >
                <optgroup label="تحديث الحالة السريع">
                  {Object.entries(STATUS_ARABIC).map(([val, label]) => (
                    <option key={val} value={val} className="bg-background text-foreground">{label}</option>
                  ))}
                </optgroup>
              </select>
            </>
          ) : (
            <>
              <Button onClick={() => {
                setIsEditing(false);
                initialized.current = false; // Reset to pull from server data again
              }} variant="ghost">
                إلغاء
              </Button>
              <Button onClick={handleSave} disabled={updateTender.isPending} className="gap-2">
                {updateTender.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التعديلات
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Content Area */}
        <div className="md:col-span-2 space-y-6">
          {/* Details Card */}
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 py-4">
              <CardTitle className="text-lg">تفاصيل المناقصة</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>رقم المناقصة</Label>
                      <Input name="tenderNumber" value={formData.tenderNumber} onChange={handleChange} dir="ltr" className="text-left" />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع المناقصة</Label>
                      <Input name="tenderType" value={formData.tenderType} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>اسم المشروع</Label>
                      <Input name="projectName" value={formData.projectName} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>الجهة الحكومية</Label>
                      <Input name="governmentEntity" value={formData.governmentEntity} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6 text-sm">
                  <div>
                    <dt className="text-muted-foreground font-medium mb-1">نوع المناقصة</dt>
                    <dd className="text-foreground font-semibold">{tender.tenderType || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground font-medium mb-1">حالة التقديم</dt>
                    <dd className="text-foreground font-semibold flex items-center gap-1.5">
                      {tender.isSubmitted ? (
                        <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> تم التقديم في موعده</>
                      ) : (
                        <><AlertTriangle className="h-4 w-4 text-amber-500" /> لم يتم التقديم بعد</>
                      )}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground font-medium mb-1">ملاحظات ووصف</dt>
                    <dd className="text-foreground bg-muted/30 p-4 rounded-md min-h-[80px] whitespace-pre-wrap">
                      {tender.notes || "لا توجد ملاحظات."}
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Financials Card */}
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 py-4">
              <CardTitle className="text-lg">البيانات المالية للعرض</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
               {isEditing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>قيمة العرض (ريال)</Label>
                    <Input type="number" name="offerValue" value={formData.offerValue} onChange={handleChange} dir="ltr" className="text-left font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>نسبة الربح المستهدفة (%)</Label>
                    <Input type="number" step="0.01" name="profitPercentage" value={formData.profitPercentage} onChange={handleChange} dir="ltr" className="text-left font-mono" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>الشركة الفائزة (في حال الرسو)</Label>
                    <Input name="winner" value={formData.winner} onChange={handleChange} placeholder="اسم الشركة التي رست عليها المناقصة" />
                  </div>
                </div>
               ) : (
                 <div className="grid grid-cols-2 gap-6">
                    <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-lg">
                      <p className="text-amber-800 text-sm font-medium mb-1">قيمة عرضنا المالي</p>
                      <p className="text-2xl font-bold font-mono text-amber-900 tracking-tight">
                        {formatCurrency(tender.offerValue)}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg">
                      <p className="text-slate-600 text-sm font-medium mb-1">نسبة الربح المقدرة</p>
                      <p className="text-2xl font-bold font-mono text-slate-800 tracking-tight">
                        {tender.profitPercentage ? `${tender.profitPercentage}%` : "—"}
                      </p>
                    </div>
                    {tender.winner && (
                      <div className="col-span-2 bg-muted/30 p-4 rounded-lg flex items-center justify-between border border-border">
                        <span className="text-muted-foreground font-medium">الشركة التي رست عليها:</span>
                        <span className="font-bold text-foreground text-lg">{tender.winner}</span>
                      </div>
                    )}
                 </div>
               )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="shadow-sm border-t-4 border-t-blue-500">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                المواعيد الحرجة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>تاريخ الإعلان</Label>
                    <Input type="date" name="announcementDate" value={formData.announcementDate} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>آخر موعد للتقديم</Label>
                    <Input type="date" name="deadline" value={formData.deadline} onChange={handleChange} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground text-sm">تاريخ الإعلان</span>
                    <span className="font-semibold text-sm">{formatDate(tender.announcementDate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">آخر موعد تقديم</span>
                    <span className={cn("font-bold text-sm", urgent ? "text-destructive" : "text-foreground")}>
                      {formatDate(tender.deadline)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-t-4 border-t-slate-500">
             <CardHeader className="py-4 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                المتطلبات المالية
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>قيمة الكراسة (ريال)</Label>
                    <Input type="number" name="docsValue" value={formData.docsValue} onChange={handleChange} dir="ltr" className="text-left font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>الضمان الابتدائي (ريال)</Label>
                    <Input type="number" name="bondValue" value={formData.bondValue} onChange={handleChange} dir="ltr" className="text-left font-mono" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground text-sm">قيمة الكراسة</span>
                    <span className="font-mono font-semibold text-sm">{formatCurrency(tender.docsValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">الضمان الابتدائي</span>
                    <span className="font-mono font-semibold text-sm">{formatCurrency(tender.bondValue)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {isEditing && (
            <Card className="border-destructive bg-destructive/5 shadow-none">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-destructive mb-3">منطقة الخطر</p>
                <Button variant="destructive" className="w-full" onClick={handleDelete} disabled={deleteTender.isPending}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  حذف المناقصة نهائياً
                </Button>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
