import { useGetTenderStats } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  FileText, AlertCircle, Trophy, Banknote, Percent, ShieldCheck,
  ArrowLeftCircle, TrendingUp, MessageSquare, ListChecks, Clock,
  ChevronDown, AlertTriangle, CheckCircle2, Landmark, KeyRound,
  Gavel, CalendarDays, Activity, Plus, FileSignature, Mail,
  ShoppingCart, Wrench, Users, FolderOpen,
} from "lucide-react";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import { useAuth } from "@/contexts/auth";
import { useI18n } from "@/contexts/i18n";
import { apiFetch } from "@/lib/api";
import CorrespondenceDashboardWidget from "@/components/correspondence-dashboard-widget";
import { useListTenders } from "@workspace/api-client-react";

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
  pending:     { color: "#d97706", bg: "#fffbeb", label: "dash.st.pending" },
  in_progress: { color: "#2563eb", bg: "#eff6ff", label: "dash.st.in_progress" },
  completed:   { color: "#16a34a", bg: "#f0fdf4", label: "dash.st.completed" },
  cancelled:   { color: "#6b7280", bg: "#f9fafb", label: "dash.st.cancelled" },
};

/* ─── سجل الحركة: تعريب الفعل والوحدة ─── */
const ACTION_AR: Record<string, string> = { create: "أضاف", update: "عدّل", delete: "حذف" };
const MODULE_AR: Record<string, string> = {
  tenders: "مناقصة", entities: "جهة", suppliers: "مورّدًا", projects: "مشروعًا",
  guarantees: "كفالة", contracts: "عقدًا", rfq: "طلب عرض أسعار", po: "أمر شراء",
  users: "مستخدمًا", correspondence: "خطابًا", vehicles: "مركبة", residency: "بيان إقامة",
  maintenance: "بند صيانة", research: "بحثًا", pricing: "ورقة تسعير",
  opportunities: "فرصة", tasks: "مهمة",
};

/* ─── مساعدات عرض ─── */
const timeAgo = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `قبل ${mins} د`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `قبل ${hrs} س`;
  return `قبل ${Math.round(hrs / 24)} يوم`;
};
const dayLabel = (d: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = new Date(d + "T00:00:00");
  const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return "اليوم";
  if (diff === 1) return "غدًا";
  return "هذا الأسبوع";
};

/* عنوان قسم موحّد */
function SectionTitle({ icon: Icon, children, action }: { icon: any; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg,${GL},${GD})` }} />
        <Icon size={17} color={GD} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#132a18", margin: 0 }}>{children}</h2>
      </div>
      {action}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetTenderStats();
  const { data: recentTenders, isLoading: tendersLoading } = useListTenders({});
  const { user } = useAuth();
  const { t, dir, locale } = useI18n();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";

  /* ── طلب واحد: ملخص غرفة القيادة ── */
  const { data: sum } = useQuery<any>({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch("/api/dashboard/summary"),
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
  });

  /* ── مهامي (الودجت السفلية القائمة) ── */
  const { data: myTasks = [] } = useQuery<any[]>({
    queryKey: ["tasks"],
    queryFn: () => apiFetch("/api/tasks"),
    refetchInterval: 60000,
  });
  const activeTasks = myTasks.filter(t => t.status === "pending" || t.status === "in_progress");
  const urgentTasks = activeTasks.filter(t => t.priority === "urgent" || t.priority === "high");
  const unreadNotes = isAdmin ? myTasks.filter(t => !t.notesReadByAdmin && t.employeeNotes) : [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("dash.morning");
    if (h < 17) return t("dash.afternoon");
    return t("dash.evening");
  };

  /* ── ① ينتظر قرارك: تجميع الأسطر ── */
  const dec = sum?.decisions;
  const decisionRows: { icon: any; color: string; bg: string; text: string; sub?: string; href: string }[] = [];
  (dec?.pendingCaseFiles ?? []).forEach((cf: any) => decisionRows.push({
    icon: FolderOpen, color: "#b45309", bg: "#fffbeb",
    text: `ملف بانتظار اعتمادك: ${cf.title}`,
    sub: cf.entityType === "tender" ? "مناقصة" : "ممارسة",
    href: "/case-files",
  }));
  (dec?.bidsClosing ?? []).forEach((b: any) => decisionRows.push({
    icon: Gavel, color: "#dc2626", bg: "#fff1f2",
    text: `عطاء يغلق ${dayLabel(b.deadline)}: ${b.title ?? b.orderNumber}`,
    sub: b.deadline,
    href: "/purchase-orders",
  }));
  (dec?.resetRequests ?? []).forEach((r: any) => decisionRows.push({
    icon: KeyRound, color: "#7c3aed", bg: "#f5f3ff",
    text: `طلب إعادة تعيين كلمة مرور: ${r.username}`,
    sub: r.at,
    href: "/admin/users?tab=audit",
  }));
  if (dec?.expired) {
    if (dec.expired.guarantees > 0) decisionRows.push({ icon: ShieldCheck, color: "#dc2626", bg: "#fff1f2", text: `${dec.expired.guarantees} كفالة منتهية فعلًا تحتاج معالجة`, href: "/guarantees" });
    if (dec.expired.docs > 0) decisionRows.push({ icon: FileText, color: "#dc2626", bg: "#fff1f2", text: `${dec.expired.docs} وثيقة شركة منتهية`, href: "/company-docs" });
    if (dec.expired.regs > 0) decisionRows.push({ icon: Landmark, color: "#dc2626", bg: "#fff1f2", text: `${dec.expired.regs} اشتراكًا حكوميًا منتهيًا`, href: "/gov-registrations" });
  }

  /* ── ② نبض الشركة ── */
  const pulse = sum?.pulse;
  const money = pulse?.money;
  const budgetPct = money && money.monthBudget > 0
    ? Math.min(100, Math.round((money.monthExpense / money.monthBudget) * 100)) : null;

  /* ── ③ الأجندة مجمعة اليوم/غدًا/الأسبوع ── */
  const agendaGroups: Record<string, any[]> = { "اليوم": [], "غدًا": [], "هذا الأسبوع": [] };
  (sum?.agenda ?? []).forEach((a: any) => agendaGroups[dayLabel(a.d)].push(a));

  const pulseNum = (v: any) => (v ?? 0) as number;
  /* بطاقة رقم داخل مجموعة النبض */
  const PulseRow = ({ label, value, href, danger }: { label: string; value: ReactNode; href: string; danger?: boolean }) => (
    <a href={href} onClick={e => { e.preventDefault(); navigate(href); }}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 10, textDecoration: "none", cursor: "pointer", transition: "background 0.1s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#faf7ef")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <span style={{ fontSize: 12.5, color: "#4b5563", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: danger ? "#dc2626" : "#0f172a" }}>{value}</span>
    </a>
  );
  const PulseCard = ({ icon: Icon, accent, bg, title, children }: any) => (
    <div style={{ background: "white", border: `1.5px solid ${bg}`, borderRadius: 16, padding: "14px 12px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={accent} />
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: "#132a18" }}>{title}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif", display: "flex", flexDirection: "column", gap: 26 }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${GR} 0%, #132a18 60%, #1e4028 100%)`,
        borderRadius: 20, padding: "26px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 8px 32px rgba(11,26,16,0.35)", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: -60, top: -60, width: 280, height: 280, borderRadius: "50%", border: `1px solid rgba(212,165,52,0.15)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -20, top: -20, width: 180, height: 180, borderRadius: "50%", border: `1px solid rgba(212,165,52,0.1)`, pointerEvents: "none" }} />
        <div>
          <p style={{ color: `rgba(212,165,52,0.6)`, fontSize: 13, margin: 0, marginBottom: 4 }}>{greeting()} ،</p>
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 800, margin: 0 }}>{user?.fullName ?? t("dash.welcome")}</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "6px 0 0" }}>{t("dash.overview")}</p>
        </div>
        {/* أزرار إنشاء سريعة */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {[
            { label: "مناقصة", href: "/tenders", icon: FileText },
            { label: "أمر شراء", href: "/purchase-orders", icon: ShoppingCart },
            { label: "مهمة", href: "/tasks", icon: ListChecks },
            { label: "خطاب", href: "/correspondence", icon: Mail },
          ].map(qa => (
            <a key={qa.href} href={qa.href} onClick={e => { e.preventDefault(); navigate(qa.href); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "rgba(212,165,52,0.15)", border: "1px solid rgba(212,165,52,0.3)", textDecoration: "none", cursor: "pointer" }}>
              <Plus size={13} color={GL} />
              <qa.icon size={14} color={GL} />
              <span style={{ color: GL, fontSize: 12.5, fontWeight: 700 }}>{qa.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── ① ينتظر قرارك ── */}
      {sum && (
        decisionRows.length > 0 ? (
          <div style={{ background: "white", border: "1.5px solid #fecaca", borderRadius: 18, boxShadow: "0 4px 20px rgba(220,38,38,0.07)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: "#fff7f7", borderBottom: "1px solid #fee2e2" }}>
              <AlertCircle size={17} color="#dc2626" />
              <span style={{ fontSize: 15, fontWeight: 800, color: "#991b1b" }}>ينتظر قرارك</span>
              <span style={{ background: "#dc2626", color: "white", fontSize: 11, fontWeight: 800, minWidth: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                {decisionRows.length}
              </span>
            </div>
            <div>
              {decisionRows.slice(0, 8).map((r, i) => (
                <a key={i} href={r.href} onClick={e => { e.preventDefault(); navigate(r.href); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", textDecoration: "none", cursor: "pointer", borderBottom: i < Math.min(decisionRows.length, 8) - 1 ? "1px solid #faf5f5" : "none", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fffbfb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: r.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <r.icon size={16} color={r.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.text}</div>
                    {r.sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{r.sub}</div>}
                  </div>
                  <ArrowLeftCircle size={16} color={`${r.color}99`} style={{ flexShrink: 0 }} />
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderRadius: 14, background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
            <CheckCircle2 size={17} color="#16a34a" />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#166534" }}>لا شيء ينتظر قرارك اليوم</span>
          </div>
        )
      )}

      {/* ── ② نبض الشركة ── */}
      {sum && (
        <div>
          <SectionTitle icon={TrendingUp}>نبض الشركة</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(230px, 1fr))`, gap: 14 }}>
            {/* الأعمال */}
            <PulseCard icon={FileText} accent={G} bg="#fdf8ec" title="الأعمال">
              <PulseRow label="مناقصات مسجلة" value={statsLoading ? "…" : stats?.total ?? 0} href="/tenders" />
              <PulseRow label="عاجلة (اقترب موعدها)" value={stats?.urgentCount ?? 0} href="/tenders" danger={(stats?.urgentCount ?? 0) > 0} />
              <PulseRow label="نسبة الفوز" value={`${(stats?.winRate ?? 0).toFixed(0)}%`} href="/tenders" />
              <PulseRow label="عطاءات شراء مفتوحة" value={pulseNum(pulse?.openBids)} href="/purchase-orders" />
              <PulseRow label="ملفات قيد العمل" value={pulseNum(pulse?.activeCaseFiles)} href="/case-files" />
            </PulseCard>

            {/* المال — للعام والمالي */}
            {money && (
              <PulseCard icon={Banknote} accent="#0891b2" bg="#ecfeff" title="المال">
                <div style={{ padding: "4px 10px 8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#4b5563", fontWeight: 600, marginBottom: 5 }}>
                    <span>مصروف الشهر</span>
                    <span>{budgetPct !== null ? `${budgetPct}% من الموازنة` : "لا موازنة محددة"}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: "#e5e7eb", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${budgetPct ?? 5}%`, borderRadius: 5, background: budgetPct !== null && budgetPct >= 90 ? "#dc2626" : budgetPct !== null && budgetPct >= 70 ? "#d97706" : "#16a34a", transition: "width 0.4s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5 }}>
                    {formatCurrency(money.monthExpense)}{money.monthBudget > 0 && <> من {formatCurrency(money.monthBudget)}</>}
                  </div>
                </div>
                <PulseRow label="السيولة الحالية" value={formatCurrency(money.cash)} href="/financial-center" danger={money.cash < 0} />
                <PulseRow label="مستحقات غير مدفوعة" value={formatCurrency(money.pendingExpenses)} href="/financial-center" danger={money.pendingExpenses > 0} />
              </PulseCard>
            )}

            {/* الالتزامات */}
            <PulseCard icon={ShieldCheck} accent="#dc2626" bg="#fff1f2" title="الالتزامات القادمة">
              <PulseRow label="كفالات تنتهي ≤ ٦٠ يوم" value={pulseNum(pulse?.guarantees60)} href="/guarantees" danger={pulseNum(pulse?.guarantees60) > 0} />
              <PulseRow label="عقود تنتهي ≤ ٦٠ يوم" value={pulseNum(pulse?.contracts60)} href="/contracts" danger={pulseNum(pulse?.contracts60) > 0} />
              <PulseRow label="إقامات تنتهي ≤ ٦٠ يوم" value={pulseNum(pulse?.residency60)} href="/residency" danger={pulseNum(pulse?.residency60) > 0} />
            </PulseCard>

            {/* التشغيل */}
            <PulseCard icon={Wrench} accent="#7c3aed" bg="#f5f3ff" title="التشغيل">
              <PulseRow label="مهام متأخرة" value={pulseNum(pulse?.overdueTasks)} href="/tasks" danger={pulseNum(pulse?.overdueTasks) > 0} />
              <PulseRow label="أوامر صيانة مفتوحة" value={pulseNum(pulse?.openWorkOrders)} href="/maintenance" />
              <PulseRow label="لوحة الأحمال" value="←" href="/tasks?view=workload" />
            </PulseCard>
          </div>
        </div>
      )}

      {/* ── ③ الأجندة + ④ آخر الحركة ── */}
      {sum && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
          {/* الأجندة */}
          <div>
            <SectionTitle icon={CalendarDays}
              action={
                <Link href="/calendar">
                  <span style={{ fontSize: 12.5, color: G, fontWeight: 700, cursor: "pointer" }}>التقويم الكامل ←</span>
                </Link>
              }>
              أجندة الأسبوع
            </SectionTitle>
            <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", padding: "6px 0", minHeight: 120 }}>
              {(sum.agenda ?? []).length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>لا مواعيد خلال الأيام السبعة القادمة</div>
              ) : (
                Object.entries(agendaGroups).filter(([, v]) => v.length > 0).map(([label, items]) => (
                  <div key={label}>
                    <div style={{ padding: "8px 18px 4px", fontSize: 11.5, fontWeight: 800, color: label === "اليوم" ? "#dc2626" : label === "غدًا" ? "#d97706" : "#6b7280" }}>{label}</div>
                    {items.map((a: any, i: number) => (
                      <a key={i} href={a.href} onClick={e => { e.preventDefault(); navigate(a.href); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", textDecoration: "none", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fffdf5")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: GD, background: "#fdf8ec", borderRadius: 7, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>{a.kind}</span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{a.d.slice(5)}</span>
                      </a>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* آخر الحركة */}
          <div>
            <SectionTitle icon={Activity}
              action={isAdmin ? (
                <Link href="/admin/activity-log">
                  <span style={{ fontSize: 12.5, color: G, fontWeight: 700, cursor: "pointer" }}>السجل الكامل ←</span>
                </Link>
              ) : undefined}>
              آخر الحركة في الشركة
            </SectionTitle>
            <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", padding: "6px 0", minHeight: 120 }}>
              {(sum.activity ?? []).length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>لا حركة مسجلة بعد</div>
              ) : (
                (sum.activity ?? []).map((a: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 18px" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: a.src === "case" ? G : "#94a3b8", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "#1f2937", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 800 }}>{a.actor ?? "النظام"}</span>{" "}
                        {a.src === "case"
                          ? <>{a.action} — <span style={{ color: "#6b7280" }}>{a.subject}</span></>
                          : <>{ACTION_AR[a.action] ?? a.action} {MODULE_AR[a.module] ?? a.module}</>}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#b0b7c3", marginTop: 1 }}>{timeAgo(a.at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── مهامي ── */}
      {myTasks.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg,${GL},${GD})` }} />
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#132a18", margin: 0 }}>
                {isAdmin ? t("dash.activeTasks") : t("dash.myTasks")}
              </h2>
              {urgentTasks.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 10, background: "#fff1f2", color: "#dc2626", fontSize: 11, fontWeight: 800, border: "1px solid #fecaca" }}>
                  <AlertCircle size={11} /> {urgentTasks.length} {t("dash.urgentBadge")}
                </span>
              )}
              {isAdmin && unreadNotes.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 10, background: "#fef9c3", color: "#b45309", fontSize: 11, fontWeight: 800, border: "1px solid #fde68a" }}>
                  <MessageSquare size={11} /> {unreadNotes.length} {t("dash.newNote")}
                </span>
              )}
            </div>
            <Link href="/tasks">
              <span style={{ fontSize: 13, color: G, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                {isAdmin ? t("dash.manageTasks") : t("dash.viewMyTasks")}
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
                  <div style={{ height: 3, background: `linear-gradient(90deg,${pri.color},${pri.color}44)` }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0b1a10", lineHeight: 1.4 }}>{task.title}</span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {hasUnreadNote && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 8, background: "#fef9c3", color: "#b45309", fontSize: 10, fontWeight: 800, border: "1px solid #fde68a" }}>
                            <MessageSquare size={9} /> {t("dash.new")}
                          </span>
                        )}
                        {isOverdue && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 8, background: "#fff1f2", color: "#dc2626", fontSize: 10, fontWeight: 800, border: "1px solid #fecaca" }}>
                            <AlertCircle size={9} /> {t("dash.overdue")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 8, background: sta.bg, color: sta.color, fontSize: 10, fontWeight: 700 }}>{t(sta.label)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 8, background: pri.bg, color: pri.color, fontSize: 10, fontWeight: 700 }}>
                        <PriIcon size={9} /> {task.priority === "urgent" ? t("dash.pri.urgent") : task.priority === "high" ? t("dash.pri.high") : task.priority === "medium" ? t("dash.pri.medium") : t("dash.pri.low")}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 8, background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 600 }}>{task.taskType}</span>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
                      {isAdmin && <span style={{ color: "#6b7280", fontWeight: 600 }}>{task.assigneeName}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} />
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString(locale, { month: "short", day: "numeric" })
                          : new Date(task.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {(isAdmin || user?.accessCorrespondence) && (
        <CorrespondenceDashboardWidget />
      )}

      {/* ── آخر المناقصات ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#132a18", margin: 0 }}>{t("dash.recentTenders")}</h2>
          </div>
          <Link href="/tenders">
            <span style={{ fontSize: 13, color: G, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
              {t("common.viewAll")}
            </span>
          </Link>
        </div>

        <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {tendersLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>{t("common.loading")}</div>
          ) : !recentTenders?.length ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              <FileText size={36} color="#e2d5b0" style={{ margin: "0 auto 12px" }} />
              <p style={{ margin: 0 }}>{t("dash.noTenders")}</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "start" }}>
                <thead>
                  <tr style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                    {[t("dash.col.tenderNo"), t("dash.col.project"), t("dash.col.entity"), t("dash.col.deadline"), t("dash.col.status")].map(h => (
                      <th key={h} style={{ padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTenders.slice(0, 7).map((tender, idx) => {
                    const urgent = isUrgent(tender.deadline, tender.status);
                    return (
                      <tr key={tender.id} style={{ borderBottom: idx < 6 ? "1px solid #f5f0e6" : "none", background: "white", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fffdf5"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}>
                        <td style={{ padding: "13px 18px" }}>
                          <Link href={`/tenders/${tender.id}`}>
                            <span style={{ color: GD, fontWeight: 700, fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>{tender.tenderNumber}</span>
                          </Link>
                        </td>
                        <td style={{ padding: "13px 18px", fontWeight: 600, color: "#1e2a1e", maxWidth: 220 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tender.projectName}</div>
                        </td>
                        <td style={{ padding: "13px 18px", color: "#6b7280", maxWidth: 160 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tender.governmentEntity || "—"}</div>
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
    </div>
  );
}
