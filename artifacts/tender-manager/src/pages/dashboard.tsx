import { 
  useGetTenderStats, 
  useListTenders 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  BarChart3, 
  AlertCircle, 
  Trophy, 
  Banknote,
  Percent,
  Clock,
  Briefcase
} from "lucide-react";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import { TenderStatus } from "@workspace/api-client-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetTenderStats();
  const { data: recentTenders, isLoading: tendersLoading } = useListTenders({ 
    // We ideally would have a limit or sort parameter, but we'll take top few from list
  });

  if (statsLoading || tendersLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="h-32 bg-muted/50 border-0" />
          ))}
        </div>
        <div className="h-[400px] bg-muted/30 rounded-lg mt-6 border-0"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "إجمالي المناقصات",
      value: stats?.total || 0,
      icon: Briefcase,
      color: "text-blue-600",
      bg: "bg-blue-100"
    },
    {
      title: "مناقصات عاجلة",
      value: stats?.urgentCount || 0,
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-100"
    },
    {
      title: "رست علينا",
      value: stats?.wonCount || 0,
      icon: Trophy,
      color: "text-emerald-600",
      bg: "bg-emerald-100"
    },
    {
      title: "إجمالي قيمة العروض",
      value: formatCurrency(stats?.totalOfferValue),
      icon: Banknote,
      color: "text-amber-600",
      bg: "bg-amber-100"
    },
    {
      title: "نسبة النجاح",
      value: `${(stats?.winRate || 0).toFixed(1)}%`,
      icon: Percent,
      color: "text-indigo-600",
      bg: "bg-indigo-100"
    }
  ];

  // For the breakdown chart, let's create a simple horizontal bar visual
  const maxCount = Math.max(...(stats?.byStatus.map(s => s.count) || [1]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm mt-1">نظرة عامة على حالة المناقصات والعطاءات الحالية.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className={cn("p-2 rounded-full", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold font-mono tracking-tight">{stat.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Status Breakdown */}
        <Card className="md:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              توزيع الحالات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.byStatus.map((statusStat) => (
              <div key={statusStat.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{STATUS_ARABIC[statusStat.status] || statusStat.status}</span>
                  <span className="text-muted-foreground font-mono text-xs">{statusStat.count}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500 rounded-full" 
                    style={{ width: `${(statusStat.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {(!stats?.byStatus || stats.byStatus.length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد بيانات متاحة
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Tenders Table */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              أحدث التحديثات
            </CardTitle>
            <Link href="/tenders" className="text-sm text-primary hover:underline font-medium">
              عرض الكل
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="font-medium p-4">رقم المناقصة</th>
                    <th className="font-medium p-4">المشروع</th>
                    <th className="font-medium p-4">الجهة</th>
                    <th className="font-medium p-4">آخر موعد</th>
                    <th className="font-medium p-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTenders?.slice(0, 6).map((tender) => {
                    const urgent = isUrgent(tender.deadline, tender.status);
                    return (
                      <tr key={tender.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="p-4 font-mono text-xs">
                          <Link href={`/tenders/${tender.id}`} className="text-primary hover:underline font-medium block">
                            {tender.tenderNumber}
                          </Link>
                        </td>
                        <td className="p-4 font-medium text-foreground max-w-[200px] truncate">
                          {tender.projectName}
                        </td>
                        <td className="p-4 text-muted-foreground max-w-[150px] truncate">
                          {tender.governmentEntity || "—"}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className={cn("flex items-center gap-1.5", urgent && "text-destructive font-semibold")}>
                            {urgent && <AlertCircle className="h-3.5 w-3.5" />}
                            {formatDate(tender.deadline)}
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border", STATUS_COLORS[tender.status])}>
                            {STATUS_ARABIC[tender.status] || tender.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(!recentTenders || recentTenders.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        لا توجد مناقصات حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
