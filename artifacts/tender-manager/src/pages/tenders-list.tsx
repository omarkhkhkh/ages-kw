import { useState } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import { Search, Plus, Filter, AlertCircle, FileText } from "lucide-react";
import { TenderStatus } from "@workspace/api-client-react";

export default function TendersList() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Convert tabs to API params
  const queryParams: any = {};
  if (search) queryParams.search = search;
  if (activeTab === "urgent") queryParams.urgent = true;
  if (activeTab === "won") queryParams.won = true;
  if (activeTab !== "all" && activeTab !== "urgent" && activeTab !== "won") {
    queryParams.status = activeTab;
  }

  const { data: tenders, isLoading } = useListTenders(queryParams);

  const tabs = [
    { id: "all", label: "الجميع" },
    { id: "urgent", label: "عاجلة" },
    { id: TenderStatus.studying, label: "جاري الدراسة" },
    { id: TenderStatus.preparing_technical, label: "إعداد العروض" },
    { id: TenderStatus.under_evaluation, label: "تحت التقييم" },
    { id: "won", label: "رست علينا" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">جميع المناقصات</h1>
          <p className="text-muted-foreground text-sm mt-1">تصفح وإدارة جميع المناقصات في النظام.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/tenders/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              مناقصة جديدة
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-lg p-2 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2">
          {/* Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.id 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث برقم المناقصة، المشروع..." 
              className="pr-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="font-medium p-4">رقم المناقصة</th>
                <th className="font-medium p-4 min-w-[200px]">المشروع / الجهة</th>
                <th className="font-medium p-4">الحالة</th>
                <th className="font-medium p-4">آخر موعد</th>
                <th className="font-medium p-4">المهندس المسؤول</th>
                <th className="font-medium p-4 text-left">قيمة العرض</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                // Loading State
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-muted rounded w-20"></div></td>
                    <td className="p-4">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-40"></div>
                        <div className="h-3 bg-muted rounded w-24"></div>
                      </div>
                    </td>
                    <td className="p-4"><div className="h-6 bg-muted rounded-full w-24"></div></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : tenders?.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4 text-muted" />
                      <p className="text-lg font-medium text-foreground mb-1">لا توجد مناقصات</p>
                      <p className="text-sm">لم يتم العثور على مناقصات تطابق معايير البحث.</p>
                      <Link href="/tenders/new" className="mt-4">
                        <Button variant="outline" size="sm">إضافة مناقصة</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                // Data Rows
                tenders?.map((tender) => {
                  const urgent = isUrgent(tender.deadline, tender.status);
                  return (
                    <tr key={tender.id} className="hover:bg-muted/30 transition-colors group cursor-pointer relative">
                      <td className="p-4 font-mono text-xs font-medium text-slate-600">
                        <Link href={`/tenders/${tender.id}`} className="absolute inset-0 z-10">
                          <span className="sr-only">عرض التفاصيل</span>
                        </Link>
                        {tender.tenderNumber}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-foreground line-clamp-1">{tender.projectName}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{tender.governmentEntity || "—"}</div>
                      </td>
                      <td className="p-4">
                        <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border inline-flex items-center gap-1.5", STATUS_COLORS[tender.status])}>
                          {STATUS_ARABIC[tender.status] || tender.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className={cn(
                          "flex items-center gap-1.5 whitespace-nowrap", 
                          urgent ? "text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded inline-flex" : "text-muted-foreground"
                        )}>
                          {urgent && <AlertCircle className="h-3.5 w-3.5" />}
                          {formatDate(tender.deadline)}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {tender.responsibleEngineer || "—"}
                      </td>
                      <td className="p-4 text-left font-mono font-medium text-slate-700">
                        {formatCurrency(tender.offerValue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
