import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Activity, LogIn, LogOut, Plus, Pencil, Trash2, Download, Filter } from "lucide-react";
import { formatKuwaitDateTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface LogRow {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  action: string;
  module: string | null;
  resourceId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface UserOption { id: number; fullName: string; username: string; }

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  login:   { label: "دخول",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: LogIn },
  logout:  { label: "خروج",   color: "bg-slate-100 text-slate-500 border-slate-200",      icon: LogOut },
  create:  { label: "إضافة",  color: "bg-blue-100 text-blue-700 border-blue-200",          icon: Plus },
  update:  { label: "تعديل",  color: "bg-amber-100 text-amber-700 border-amber-200",       icon: Pencil },
  delete:  { label: "حذف",    color: "bg-red-100 text-red-700 border-red-200",             icon: Trash2 },
  export:  { label: "تصدير",  color: "bg-purple-100 text-purple-700 border-purple-200",   icon: Download },
};

const MODULE_LABELS: Record<string, string> = {
  tenders:   "المناقصات",
  entities:  "الجهات الحكومية",
  suppliers: "الموردون",
  projects:  "المشاريع",
  guarantees:"الكفالات البنكية",
  contracts: "العقود",
  rfq:       "طلبات عروض",
  po:        "أوامر الشراء",
  users:     "المستخدمون",
  auth:      "تسجيل الدخول",
};

const DATE_OPTIONS = [
  { value: "today",   label: "اليوم" },
  { value: "week",    label: "آخر 7 أيام" },
  { value: "month",   label: "آخر 30 يوماً" },
  { value: "all",     label: "الكل" },
];

function getDateRange(period: string): { from?: string; to?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return { from: today.toISOString() };
  if (period === "week") {
    const from = new Date(today); from.setDate(from.getDate() - 7);
    return { from: from.toISOString() };
  }
  if (period === "month") {
    const from = new Date(today); from.setDate(from.getDate() - 30);
    return { from: from.toISOString() };
  }
  return {};
}

export default function ActivityLog() {
  const { user: me } = useAuth();
  const [location] = useLocation();

  // Read ?userId from URL — react to location changes
  const searchStr = typeof window !== "undefined" ? window.location.search : "";
  const defaultUserId = new URLSearchParams(searchStr).get("userId") ?? "";

  const [filterUserId, setFilterUserId] = useState(defaultUserId);

  // Sync when wouter location changes (e.g. user clicks Activity icon on a different employee)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const uid = params.get("userId") ?? "";
    setFilterUserId(uid);
  }, [location]);
  const [filterAction, setFilterAction] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("week");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { setPage(0); }, [filterUserId, filterAction, filterModule, filterPeriod]);

  if (me?.role !== "admin") {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">ليس لديك صلاحية الوصول.</div>;
  }

  const { from, to } = getDateRange(filterPeriod);
  const params = new URLSearchParams();
  if (filterUserId) params.set("userId", filterUserId);
  if (filterAction) params.set("action", filterAction);
  if (filterModule) params.set("module", filterModule);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));

  const { data: logsData, isLoading } = useQuery<{ logs: LogRow[]; total: number }>({
    queryKey: ["activity-logs", filterUserId, filterAction, filterModule, filterPeriod, page],
    queryFn: () => apiFetch(`/api/admin/activity-logs?${params.toString()}`),
  });

  const { data: usersData = [] } = useQuery<UserOption[]>({
    queryKey: ["activity-log-users"],
    queryFn: () => apiFetch("/api/admin/activity-logs/users"),
  });

  const logs = logsData?.logs ?? [];
  const total = logsData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const selectedUser = usersData.find(u => String(u.id) === filterUserId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> سجل حركات الموظفين
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {selectedUser ? `عرض حركات: ${selectedUser.fullName} (@${selectedUser.username})` : "جميع تحركات الموظفين داخل النظام"}
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> تصفية النتائج
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الموظف</label>
            <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">الجميع</option>
              {usersData.map(u => <option key={u.id} value={String(u.id)}>{u.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الإجراء</label>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">الجميع</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الوحدة</label>
            <select value={filterModule} onChange={e => setFilterModule(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">الجميع</option>
              {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الفترة الزمنية</label>
            <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Stats summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>إجمالي السجلات: <span className="font-semibold text-foreground">{total}</span></span>
        {totalPages > 1 && (
          <span>صفحة {page + 1} من {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="font-medium p-4">الوقت (توقيت الكويت)</th>
                <th className="font-medium p-4">الموظف</th>
                <th className="font-medium p-4">الإجراء</th>
                <th className="font-medium p-4">الوحدة</th>
                <th className="font-medium p-4">التفاصيل</th>
                <th className="font-medium p-4">عنوان IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-muted rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-3 text-muted" />
                    <p>لا توجد سجلات في هذه الفترة</p>
                  </td>
                </tr>
              ) : logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action];
                const ActionIcon = actionInfo?.icon ?? Activity;
                return (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {formatKuwaitDateTime(log.createdAt)}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">{log.fullName}</div>
                      <div className="text-xs text-muted-foreground">@{log.username}</div>
                    </td>
                    <td className="p-4">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border", actionInfo?.color ?? "bg-slate-100 text-slate-600")}>
                        <ActionIcon className="h-3 w-3" />
                        {actionInfo?.label ?? log.action}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {log.module ? (MODULE_LABELS[log.module] ?? log.module) : "—"}
                      {log.resourceId && <span className="text-xs text-muted-foreground/60 ml-1">#{log.resourceId}</span>}
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{log.details || "—"}</td>
                    <td className="p-4 text-muted-foreground text-xs font-mono">{log.ipAddress || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-muted">السابق</button>
            {[...Array(Math.min(totalPages, 7))].map((_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={cn("px-3 py-1 rounded border text-sm", i === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {i + 1}
              </button>
            ))}
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-muted">التالي</button>
          </div>
        )}
      </Card>
    </div>
  );
}
