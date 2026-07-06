import { useGetTenderStats, useListTenders } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  FileText, AlertCircle, Trophy, Banknote, Percent,
  Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature, Calendar,
  ArrowLeftCircle, TrendingUp, MessageSquare,
  ListChecks, Clock, ChevronDown, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import { useAuth } from "@/contexts/auth";
import { contractsApi, apiFetch } from "@/lib/api";

/* ─── brand palette ─── */
const G  = "#D4A534";   // gold
const GL = "#E8BE55";   // gold light
const GD = "#A87C20";   // gold dark
const GR = "#0b1a10";   // green dark

/* ─── priority/status maps (for task widget) ─── */
const PRIORITY_COLORS: Record<string, { color: string; bg: string; icon: any }> = {
  low:    { color: "#6b7280", bg: "#f9fafb",  icon: ChevronDown },
  medium: { color: "#d97706", bg: "#fffbeb",  icon: Clock },
  high:   { color: "#dc2626", bg: "#fff1f2",  icon: AlertCircle },
  urgent: { color: "#7c3aed", bg: "#f5f3ff",  icon: AlertTriangle },
};
const STATUS_COLORS_TASK: Record<string, { color: string; bg: string; label: string }> = {
  pending:     { color: "#d97706", bg: "#fffbeb", label: "قيد الانتظار" },
  in_progress: { color: "#2563eb", bg: "#eff6ff", label: "جارٍ التنفيذ" },
  completed:   { color: "#16a34a", bg: "#f0fdf4", label: "مكتملة" },
  cancelled:   { color: "#6b7280", bg: "#f9fafb", label: "ملغاة" },
};

/* ─── module shortcuts ─── */
const MODULES = [
  { href: "/tenders",        label: "سجل المناقصات",          icon: FileText,      accent: "#D4A534", bg: "#fdf8ec" },
  { href: "/entities",       label: "الجهات الحكومية",        icon: Building2,     accent: "#1a7a3a", bg: "#edf7f0" },
  { href: "/suppliers",      label: "الموردون",               icon: Users,         accent: "#2563eb", bg: "#eff6ff" },
  { href: "/projects",       label: "المشاريع",               icon: FolderOpen,    accent: "#7c3aed", bg: "#f5f3ff" },
  { href: "/guarantees",     label: "الكفالات البنكية",       icon: ShieldCheck,   accent: "#dc2626", bg: "#fff1f2" },
  { href: "/contracts",      label: "العقود",                 icon: FileSignature, accent: "#0891b2", bg: "#ecfeff" },
  { href: "/rfq",            label: "طلبات عروض الأسعار",    icon: ClipboardList, accent: "#d97706", bg: "#fffbeb" },
  { href: "/purchase-orders",label: "أوامر الشراء المباشر",  icon: ShoppingCart,  accent: "#16a34a", bg: "#f0fdf4" },
  { href: "/calendar",       label: "جدول الأعمال",           icon: Calendar,      accent: "#9333ea", bg: "#faf5ff" },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetTenderStats();
  const { data: recentTenders, isLoading: tendersLoading } = useListTenders({});
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";

  // Unread contract comments count — employees only
  const { data: unreadData } = useQuery({
    queryKey: ["unread-comments-count"],
    queryFn: () => contractsApi.unreadCommentsCount(),
    enabled: !isAdmin && !!user?.accessContracts,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  // My tasks — all authenticated users
  const { data: myTasks = [] } = useQuery<any[]>({
    queryKey: ["tasks"],
    queryFn: () => apiFetch("/api/tasks"),
    refetchInterval: 60000,
  });
  const activeTasks   = myTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const urgentTasks   = activeTasks.filter(t => t.priority === "urgent" || t.priority === "high");
  const unreadNotes   = isAdmin ? myTasks.filter(t => !t.notesReadByAdmin && t.employeeNotes) : [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "صباح الخير";
    if (h < 17) return "مساء الخير";
    return "مساء النور";
  };

  const statCards = [
    {
      title: "إجمالي المناقصات",
      value: stats?.total ?? 0,
      icon: FileText,
      accent: G,
      bg: "#fdf8ec",
      sub: "مناقصة مسجّلة",
    },
    {
      title: "مناقصات عاجلة",
      value: stats?.urgentCount ?? 0,
      icon: AlertCircle,
      accent: "#dc2626",
      bg: "#fff1f2",
      sub: "تستحق المتابعة",
    },
    {
      title: "رست علينا",
      value: stats?.wonCount ?? 0,
      icon: Trophy,
      accent: "#16a34a",
      bg: "#f0fdf4",
      sub: "مناقصة ناجحة",
    },
    {
      title: "قيمة العروض",
      value: formatCurrency(stats?.totalOfferValue),
      icon: Banknote,
      accent: "#0891b2",
      bg: "#ecfeff",
      sub: "د.ك إجمالي",
    },
    {
      title: "نسبة النجاح",
      value: `${(stats?.winRate ?? 0).toFixed(1)}%`,
      icon: Percent,
      accent: "#7c3aed",
      bg: "#f5f3ff",
      sub: "معدل الفوز",
    },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif", display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${GR} 0%, #132a18 60%, #1e4028 100%)`,
        borderRadius: 20,
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 8px 32px rgba(11,26,16,0.35)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative ring */}
        <div style={{
          position: "absolute", left: -60, top: -60,
          width: 280, height: 280, borderRadius: "50%",
          border: `1px solid rgba(212,165,52,0.15)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: -20, top: -20,
          width: 180, height: 180, borderRadius: "50%",
          border: `1px solid rgba(212,165,52,0.1)`,
          pointerEvents: "none",
        }} />
        <div>
          <p style={{ color: `rgba(212,165,52,0.6)`, fontSize: 13, margin: 0, marginBottom: 4 }}>
            {greeting()} ،
          </p>
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 800, margin: 0 }}>
            {user?.fullName ?? "مرحباً"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "6px 0 0" }}>
            نظرة عامة على حالة المناقصات والأعمال الجارية
          </p>
        </div>
        <div style={{
          background: "rgba(212,165,52,0.15)",
          border: `1px solid rgba(212,165,52,0.3)`,
          borderRadius: 14, padding: "10px 20px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <TrendingUp size={18} color={GL} />
          <span style={{ color: GL, fontSize: 13, fontWeight: 700 }}>لوحة التحكم</span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {statsLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 110, background: "#f1f5f9", borderRadius: 16, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {statCards.map((s, i) => (
            <div key={i} style={{
              background: "white",
              border: `1.5px solid ${s.bg}`,
              borderRadius: 18,
              padding: "20px 22px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              transition: "transform 0.15s, box-shadow 0.15s",
              cursor: "default",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px rgba(0,0,0,0.10)`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 16px rgba(0,0,0,0.06)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{s.title}</span>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: s.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <s.icon size={18} color={s.accent} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.sub}</div>
              </div>
              {/* bottom accent bar */}
              <div style={{ height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${s.accent}, transparent)` }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Module Shortcuts ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#132a18", margin: 0 }}>الوحدات الرئيسية</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
          {MODULES.map((m) => {
            const hasAlert = !isAdmin && m.href === "/contracts" && unreadCount > 0;
            return (
              <a
                key={m.href}
                href={m.href}
                onClick={e => { e.preventDefault(); navigate(m.href); }}
                className="module-card"
                data-accent={m.accent}
                data-bg={m.bg}
                style={{
                  background: hasAlert ? "#fff5f5" : "white",
                  border: hasAlert ? "1.5px solid #fca5a5" : `1.5px solid ${m.bg}`,
                  borderRadius: 18,
                  padding: "22px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  textDecoration: "none",
                  boxShadow: hasAlert ? "0 4px 20px rgba(220,38,38,0.12)" : "0 2px 12px rgba(0,0,0,0.05)",
                  transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                  position: "relative",
                }}
              >
                {/* Red badge for unread comments */}
                {hasAlert && (
                  <div style={{
                    position: "absolute", top: 10, left: 10,
                    background: "#dc2626", color: "white",
                    fontSize: 10, fontWeight: 800,
                    minWidth: 20, height: 20, borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px",
                    boxShadow: "0 2px 8px rgba(220,38,38,0.5)",
                    animation: "pulse-red 2s infinite",
                  }}>
                    {unreadCount}
                  </div>
                )}

                {/* Icon circle */}
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: hasAlert ? "#fee2e2" : m.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 4px 12px ${hasAlert ? "rgba(220,38,38,0.2)" : `${m.accent}22`}`,
                }}>
                  {hasAlert
                    ? <MessageSquare size={26} color="#dc2626" strokeWidth={1.8} />
                    : <m.icon size={26} color={m.accent} strokeWidth={1.8} />
                  }
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: hasAlert ? "#dc2626" : "#1e2a1e",
                  textAlign: "center", lineHeight: 1.4,
                }}>
                  {m.label}
                  {hasAlert && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#dc2626", marginTop: 2 }}>
                      {unreadCount} تعليق جديد
                    </div>
                  )}
                </span>
                <ArrowLeftCircle size={15} color={hasAlert ? "#dc262688" : `${m.accent}88`} />
              </a>
            );
          })}
        </div>
      </div>

      {/* ── My Tasks Widget ── */}
      {myTasks.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg,${GL},${GD})` }} />
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#132a18", margin: 0 }}>
                {isAdmin ? "المهام النشطة" : "مهامي"}
              </h2>
              {urgentTasks.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 10, background: "#fff1f2", color: "#dc2626", fontSize: 11, fontWeight: 800, border: "1px solid #fecaca" }}>
                  <AlertCircle size={11} /> {urgentTasks.length} عاجلة
                </span>
              )}
              {isAdmin && unreadNotes.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 10, background: "#fef9c3", color: "#b45309", fontSize: 11, fontWeight: 800, border: "1px solid #fde68a" }}>
                  <MessageSquare size={11} /> {unreadNotes.length} ملاحظة جديدة
                </span>
              )}
            </div>
            <Link href="/tasks">
              <span style={{ fontSize: 13, color: G, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                {isAdmin ? "إدارة المهام ←" : "عرض كل مهامي ←"}
              </span>
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {(isAdmin ? activeTasks : myTasks).slice(0, 6).map((task: any) => {
              const pri = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium;
              const sta = STATUS_COLORS_TASK[task.status] ?? STATUS_COLORS_TASK.pending;
              const PriIcon = pri.icon;
              const isOverdue = task.dueDate && task.status !== "completed" && task.status !== "cancelled"
                && new Date(task.dueDate) < new Date();
              const hasUnreadNote = isAdmin && !task.notesReadByAdmin && task.employeeNotes;
              return (
                <a key={task.id} href="/tasks" onClick={e => { e.preventDefault(); navigate("/tasks"); }}
                  style={{ display: "block", textDecoration: "none", background: "white", borderRadius: 14, border: `1.5px solid ${isOverdue ? "#fecaca" : hasUnreadNote ? "#fde68a" : "#f0ead8"}`, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden", cursor: "pointer", transition: "transform 0.12s, box-shadow 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px rgba(0,0,0,0.05)"; }}>
                  {/* Priority stripe */}
                  <div style={{ height: 3, background: `linear-gradient(90deg,${pri.color},${pri.color}44)` }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0b1a10", lineHeight: 1.4 }}>{task.title}</span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {hasUnreadNote && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 8, background: "#fef9c3", color: "#b45309", fontSize: 10, fontWeight: 800, border: "1px solid #fde68a" }}>
                            <MessageSquare size={9} /> جديد
                          </span>
                        )}
                        {isOverdue && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 8, background: "#fff1f2", color: "#dc2626", fontSize: 10, fontWeight: 800, border: "1px solid #fecaca" }}>
                            <AlertCircle size={9} /> متأخرة
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 8, background: sta.bg, color: sta.color, fontSize: 10, fontWeight: 700 }}>{sta.label}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 8, background: pri.bg, color: pri.color, fontSize: 10, fontWeight: 700 }}>
                        <PriIcon size={9} /> {task.priority === "urgent" ? "عاجلة" : task.priority === "high" ? "عالية" : task.priority === "medium" ? "متوسطة" : "منخفضة"}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 8, background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 600 }}>{task.taskType}</span>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
                      {isAdmin && <span style={{ color: "#6b7280", fontWeight: 600 }}>{task.assigneeName}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} />
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString("ar-KW", { month: "short", day: "numeric" })
                          : new Date(task.createdAt).toLocaleDateString("ar-KW", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Tenders ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#132a18", margin: 0 }}>أحدث المناقصات</h2>
          </div>
          <Link href="/tenders">
            <span style={{ fontSize: 13, color: G, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
              عرض الكل ←
            </span>
          </Link>
        </div>

        <div style={{
          background: "white",
          borderRadius: 18,
          border: "1.5px solid #f0ead8",
          boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}>
          {tendersLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>جارٍ التحميل...</div>
          ) : !recentTenders?.length ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              <FileText size={36} color="#e2d5b0" style={{ margin: "0 auto 12px" }} />
              <p style={{ margin: 0 }}>لا توجد مناقصات حالياً</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
                <thead>
                  <tr style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                    {["رقم المناقصة", "المشروع", "الجهة", "آخر موعد", "الحالة"].map(h => (
                      <th key={h} style={{ padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTenders.slice(0, 7).map((tender, idx) => {
                    const urgent = isUrgent(tender.deadline, tender.status);
                    return (
                      <tr key={tender.id} style={{
                        borderBottom: idx < 6 ? "1px solid #f5f0e6" : "none",
                        background: "white",
                        transition: "background 0.1s",
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fffdf5"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}
                      >
                        <td style={{ padding: "13px 18px" }}>
                          <Link href={`/tenders/${tender.id}`}>
                            <span style={{ color: GD, fontWeight: 700, fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>
                              {tender.tenderNumber}
                            </span>
                          </Link>
                        </td>
                        <td style={{ padding: "13px 18px", fontWeight: 600, color: "#1e2a1e", maxWidth: 220 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tender.projectName}
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", color: "#6b7280", maxWidth: 160 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tender.governmentEntity || "—"}
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: urgent ? "#dc2626" : "#374151", fontWeight: urgent ? 700 : 400 }}>
                            {urgent && <AlertCircle size={13} />}
                            {formatDate(tender.deadline)}
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", whiteSpace: "nowrap" }}>
                          <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border", STATUS_COLORS[tender.status])}>
                            {STATUS_ARABIC[tender.status] || tender.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1 } 50% { opacity:0.4 }
        }
        @keyframes pulse-red {
          0%,100% { box-shadow: 0 2px 8px rgba(220,38,38,0.5); }
          50%      { box-shadow: 0 2px 16px rgba(220,38,38,0.9); }
        }
        .module-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 12px 32px rgba(0,0,0,0.12) !important;
        }
      `}</style>
    </div>
  );
}
