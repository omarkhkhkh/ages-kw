import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature, Calendar, LogOut, Activity,
  ChevronDown, Clock, Truck, Wallet, ListChecks, ClipboardCheck,
  FileCheck, Landmark, Settings, Bell, HelpCircle, Headphones,
  MapPin, BarChart3, Plus, X, Menu, Trophy, Sparkles, Mail, IdCard, Wrench, FlaskConical, Calculator,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import type { AuthUser } from "@/contexts/auth";
import { useI18n, LangToggle } from "@/contexts/i18n";
import logoImg from "@/assets/logo.png";
import { nowKuwait } from "@/lib/timezone";

/* ── colours ── */
const G   = "#D4A534";
const GD  = "#A87C20";
const GR  = "#0b1a10";
const GR2 = "#132a18";
const SIDEBAR_W = 248;
const MOBILE_BP = 1024; // أقل من هذا العرض → قائمة منزلقة بدل الشريط الثابت

/* ── responsive hook ── */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < MOBILE_BP);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

/* ── api helper ── */
async function apiFetch<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ── guarantees expiring badge ── */
function useExpiringCount(hasAccess: boolean) {
  const { data } = useQuery<any[]>({
    queryKey: ["guarantees-expiring-badge"],
    queryFn: () => apiFetch("/api/bank-guarantees"),
    enabled: hasAccess,
    refetchInterval: hasAccess ? 5 * 60 * 1000 : false,
    staleTime: 2 * 60 * 1000,
  });
  if (!data) return 0;
  const now = Date.now();
  return data.filter(g => {
    if (g.status !== "active" || !g.expiryDate) return false;
    const diff = Math.round((new Date(g.expiryDate).getTime() - now) / 86400000);
    return diff >= 0 && diff <= 30;
  }).length;
}

/* ── Kuwait clock (proper custom hook) ── */
function useKuwaitClock(locale: string) {
  const [now, setNow] = useState(() => nowKuwait());
  useEffect(() => {
    const id = setInterval(() => setNow(nowKuwait()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return { timeStr, dateStr };
}

/* ── Nav group definitions ── */
type NavItem = { href: string; label: string; show: boolean; badge?: number };
type NavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  show: boolean;
  href?: string;
  items?: NavItem[];
};

const buildNavGroups = (user: AuthUser | null, expiringCount: number, t: (k: string) => string): NavGroup[] => {
  if (!user) return [];
  const isAdmin = user.role === "admin";
  const can = (f: keyof AuthUser) => isAdmin || !!user[f];
  return [
    {
      id: "home", label: t("nav.home"), icon: LayoutDashboard,
      show: true, href: "/",
    },
    {
      id: "tenders", label: t("nav.tendersGroup"), icon: FileText,
      show: can("accessTenders") || can("accessProjects"),
      items: [
        { href: "/tenders",   label: t("nav.tenders"),   show: can("accessTenders") },
        { href: "/practices", label: t("nav.practices"), show: can("accessTenders") },
        { href: "/projects",  label: t("nav.projects"),  show: can("accessProjects") },
      ].filter(i => i.show),
    },
    {
      id: "contracts", label: t("nav.contractsGroup"), icon: FileSignature,
      show: can("accessContracts") || can("accessPo") || can("accessRfq"),
      items: [
        { href: "/contracts",       label: t("nav.contracts"),      show: can("accessContracts") },
        { href: "/purchase-orders", label: t("nav.purchaseOrders"), show: can("accessPo") },
        { href: "/rfq",             label: t("nav.rfq"),            show: can("accessRfq") },
      ].filter(i => i.show),
    },
    {
      id: "suppliers", label: t("nav.suppliers"), icon: Users,
      show: can("accessSuppliers"), href: "/suppliers",
    },
    {
      id: "entities", label: t("nav.entitiesGroup"), icon: Building2,
      show: can("accessEntities") || isAdmin,
      items: [
        { href: "/entities",          label: t("nav.entities"),         show: can("accessEntities") },
        { href: "/gov-registrations", label: t("nav.govRegistrations"), show: isAdmin || can("accessTenders") },
        { href: "/guarantees",        label: t("nav.guarantees"),       show: can("accessGuarantees"), badge: expiringCount || 0 },
      ].filter(i => i.show),
    },
    {
      id: "finance", label: t("nav.finance"), icon: Wallet,
      show: isAdmin, href: "/finance",
    },
    {
      id: "docs", label: t("nav.docs"), icon: FileCheck,
      show: isAdmin || can("accessTenders"), href: "/company-docs",
    },
    {
      id: "correspondence", label: t("nav.correspondence"), icon: Mail,
      show: can("accessCorrespondence"), href: "/correspondence",
    },
    {
      id: "residency", label: t("nav.residency"), icon: IdCard,
      show: can("accessResidency"), href: "/residency",
    },
    {
      id: "maintenance", label: t("nav.maintenanceGroup"), icon: Wrench,
      show: can("accessMaintenance") || isAdmin,
      items: [
        { href: "/maintenance",                  label: t("nav.maintenance"),        show: can("accessMaintenance") },
        { href: "/maintenance/report-templates", label: t("nav.maintenanceReports"), show: isAdmin || can("accessMaintenance") },
      ].filter(i => i.show),
    },
    {
      id: "research", label: t("nav.research"), icon: FlaskConical,
      show: can("accessResearch"), href: "/research",
    },
    {
      id: "pricing", label: t("nav.pricing"), icon: Calculator,
      show: can("accessPricing"), href: "/pricing",
    },
    {
      id: "transport", label: t("nav.transport"), icon: Truck,
      show: can("accessTransportation"), href: "/transportation",
    },
    {
      id: "tasks", label: t("nav.tasksGroup"), icon: ListChecks,
      show: true,
      items: [
        { href: "/tasks",    label: t("nav.operations"), show: can("accessTasks") },
        { href: "/calendar", label: t("nav.calendar"),   show: true },
      ].filter(i => i.show),
    },
    {
      id: "competitor-intelligence", label: t("nav.competitorGroup"), icon: Trophy,
      show: can("accessTenders"),
      items: [
        { href: "/competitor-intelligence",         label: t("nav.competitorBoard"),   show: can("accessTenders") },
        { href: "/competitor-intelligence/predict", label: t("nav.competitorPredict"), show: can("accessTenders") },
      ].filter(i => i.show),
    },
    {
      id: "analytics", label: t("nav.analytics"), icon: BarChart3,
      show: false, href: "/",        // placeholder — no dedicated route yet
    },
    {
      id: "settings", label: t("nav.settings"), icon: Settings,
      show: isAdmin,
      items: [
        { href: "/admin/users",         label: t("nav.adminUsers"),   show: isAdmin },
        { href: "/admin/activity-log",  label: t("nav.activityLog"),  show: isAdmin },
        { href: "/admin/service-types", label: t("nav.serviceTypes"), show: isAdmin },
        { href: "/admin/task-types",    label: t("nav.taskTypes"),    show: isAdmin },
      ].filter(i => i.show),
    },
  ].filter(g => g.show);
};

function getActiveGroupId(groups: NavGroup[], path: string) {
  for (const g of groups) {
    if (g.href) {
      const match = g.href === "/" ? path === "/" : path === g.href || path.startsWith(g.href + "/");
      if (match) return g.id;
    }
    if (g.items) {
      for (const item of g.items) {
        if (path === item.href || path.startsWith(item.href + "/")) return g.id;
      }
    }
  }
  return null;
}

/* ════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════ */
function Sidebar({ groups, location, navigate, user, logout, mobile, onClose }:
  { groups: NavGroup[]; location: string; navigate: (p: string) => void; user: any; logout: () => void;
    mobile?: boolean; onClose?: () => void }) {

  const { t, dir } = useI18n();
  const activeGroupId = getActiveGroupId(groups, location);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (activeGroupId) s.add(activeGroupId);
    return s;
  });

  // keep active group expanded when navigating
  useEffect(() => {
    if (activeGroupId) setExpanded(prev => new Set([...prev, activeGroupId]));
  }, [activeGroupId]);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const go = (p: string) => { navigate(p); onClose?.(); };
  const textAlign = dir === "rtl" ? "right" : "left";

  return (
    <aside style={{
      width: SIDEBAR_W, flexShrink: 0,
      background: `linear-gradient(180deg, ${GR} 0%, ${GR2} 40%, #0e2312 100%)`,
      display: "flex", flexDirection: "column",
      borderLeft: dir === "rtl" ? "1px solid rgba(212,165,52,0.15)" : undefined,
      borderRight: dir === "ltr" ? "1px solid rgba(212,165,52,0.15)" : undefined,
      overflowY: "auto", overflowX: "hidden",
      scrollbarWidth: "none",
      ...(mobile ? {
        position: "fixed", top: 0, bottom: 0,
        [dir === "rtl" ? "right" : "left"]: 0,
        zIndex: 100, height: "100dvh",
        boxShadow: "0 0 48px rgba(0,0,0,0.5)",
        animation: dir === "rtl" ? "drawer-in-rtl 0.22s ease" : "drawer-in-ltr 0.22s ease",
      } as React.CSSProperties : {}),
    }}>

      {/* Logo strip */}
      <div style={{
        padding: "18px 16px 14px",
        borderBottom: "1px solid rgba(212,165,52,0.12)",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 8, padding: "3px 7px", display: "flex" }}>
          <img src={logoImg} alt="Logo" style={{ height: 28, objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: G, lineHeight: 1.3 }}>{t("app.companyShort")}</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.3 }}>{t("app.companySub")}</div>
        </div>
        {mobile && (
          <button onClick={onClose} aria-label="close menu" style={{
            background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8,
            padding: 6, cursor: "pointer", display: "flex",
          }}>
            <X size={16} color="rgba(255,255,255,0.7)" />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: "8px 8px" }}>
        {groups.map(group => {
          const isGroupActive = activeGroupId === group.id;
          const isExpanded = expanded.has(group.id);
          const hasItems = !!(group.items && group.items.length > 0);
          const Icon = group.icon;

          if (!hasItems) {
            // Direct link
            const isActive = group.href === "/"
              ? location === "/"
              : location === group.href || location.startsWith((group.href ?? "") + "/");
            return (
              <button key={group.id}
                onClick={() => go(group.href!)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 10, marginBottom: 2,
                  background: isActive ? `rgba(212,165,52,0.18)` : "transparent",
                  border: isActive ? `1px solid rgba(212,165,52,0.3)` : "1px solid transparent",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                  textAlign,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = "rgba(255,255,255,0.06)"); }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = "transparent"); }}
              >
                <Icon size={15} color={isActive ? G : "rgba(255,255,255,0.55)"} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? G : "rgba(255,255,255,0.75)", flex: 1 }}>
                  {group.label}
                </span>
              </button>
            );
          }

          // Expandable group
          return (
            <div key={group.id} style={{ marginBottom: 2 }}>
              <button onClick={() => toggle(group.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: isExpanded ? "10px 10px 0 0" : 10,
                  background: isGroupActive
                    ? (isExpanded ? `rgba(212,165,52,0.22)` : `rgba(212,165,52,0.18)`)
                    : (isExpanded ? "rgba(255,255,255,0.06)" : "transparent"),
                  border: isGroupActive ? `1px solid rgba(212,165,52,0.3)` : "1px solid transparent",
                  borderBottom: isExpanded ? "none" : undefined,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                }}
                onMouseEnter={e => { if (!isGroupActive && !isExpanded) (e.currentTarget.style.background = "rgba(255,255,255,0.06)"); }}
                onMouseLeave={e => { if (!isGroupActive && !isExpanded) (e.currentTarget.style.background = "transparent"); }}
              >
                <Icon size={15} color={isGroupActive ? G : "rgba(255,255,255,0.55)"} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: isGroupActive ? 800 : 600, color: isGroupActive ? G : "rgba(255,255,255,0.75)", flex: 1, textAlign }}>
                  {group.label}
                </span>
                <ChevronDown size={13}
                  color={isGroupActive ? G : "rgba(255,255,255,0.35)"}
                  style={{ flexShrink: 0, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {/* Sub-items */}
              {isExpanded && (
                <div style={{
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "0 0 10px 10px",
                  border: isGroupActive ? `1px solid rgba(212,165,52,0.3)` : "1px solid rgba(255,255,255,0.06)",
                  borderTop: "none",
                  paddingBottom: 4,
                }}>
                  {group.items!.map(item => {
                    const isActive = location === item.href || location.startsWith(item.href + "/");
                    return (
                      <button key={item.href} onClick={() => go(item.href)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 12px 8px 16px", cursor: "pointer",
                          background: isActive ? `rgba(212,165,52,0.15)` : "transparent",
                          border: "none", fontFamily: "inherit", transition: "background 0.1s",
                          textAlign,
                        }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = "rgba(255,255,255,0.06)"); }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = "transparent"); }}
                      >
                        <div style={{
                          width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                          background: isActive ? G : "rgba(255,255,255,0.25)",
                          marginRight: 4,
                        }} />
                        <span style={{ fontSize: 12.5, fontWeight: isActive ? 800 : 500, color: isActive ? G : "rgba(255,255,255,0.65)", flex: 1 }}>
                          {item.label}
                        </span>
                        {(item as any).badge > 0 && (
                          <span style={{
                            minWidth: 18, height: 18, borderRadius: 9,
                            background: "#ef4444", color: "white",
                            fontSize: 10, fontWeight: 800, lineHeight: "18px",
                            padding: "0 5px", textAlign: "center",
                            animation: "badge-pulse 2s ease-in-out infinite",
                          }}>
                            {(item as any).badge > 9 ? "9+" : (item as any).badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom: support + user */}
      <div style={{ padding: "10px 8px 16px", borderTop: "1px solid rgba(212,165,52,0.12)", flexShrink: 0 }}>
        <button onClick={() => go("/guide")}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10, marginBottom: 8,
            background: "rgba(212,165,52,0.1)", border: "1px solid rgba(212,165,52,0.2)",
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,165,52,0.18)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,165,52,0.1)")}
        >
          <Headphones size={15} color={G} />
          <span style={{ fontSize: 13, fontWeight: 700, color: G }}>{t("nav.support")}</span>
        </button>

        {/* User row */}
        <button onClick={logout}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 9,
            padding: "8px 12px", borderRadius: 10,
            background: "transparent", border: "1px solid transparent",
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          title={t("nav.logout")}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg,${G},${GD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "white",
          }}>
            {user?.fullName?.charAt(0) ?? "م"}
          </div>
          <div style={{ textAlign, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.fullName}</div>
            <div style={{ fontSize: 10, color: "rgba(212,165,52,0.55)" }}>{user?.role === "admin" ? t("nav.roleAdmin") : t("nav.roleEmployee")}</div>
          </div>
          <LogOut size={13} color="rgba(220,38,38,0.6)" style={{ flexShrink: 0 }} />
        </button>
      </div>
    </aside>
  );
}

/* ════════════════════════════════════════════
   TOP HEADER
════════════════════════════════════════════ */
/* ── notification bell ── */
function NotificationBell({ navigate }: { navigate: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { t, locale, dir } = useI18n();

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["notif-unread-count"],
    queryFn: () => apiFetch("/api/notifications/unread-count"),
    refetchInterval: 10000,
  });
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications"),
    enabled: open,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: number, link?: string | null) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (link) navigate(link);
    setOpen(false);
  };

  const count = unread?.count ?? 0;
  const side = dir === "rtl" ? "left" : "right";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 6, borderRadius: 8 }}>
        <Bell size={17} color="#374151" />
        {count > 0 && (
          <span style={{ position: "absolute", top: 0, [side]: 0, minWidth: 16, height: 16, borderRadius: 8, background: "#dc2626", color: "white", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" } as React.CSSProperties}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", [side]: 0, width: "min(320px, calc(100vw - 24px))", maxHeight: 400, overflowY: "auto", background: "white", borderRadius: 14, border: "1.5px solid #e5e7eb", boxShadow: "0 12px 32px rgba(0,0,0,0.15)", zIndex: 60 } as React.CSSProperties}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0ead8", fontSize: 12.5, fontWeight: 800, color: GR2 }}>{t("header.notifications")}</div>
          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{t("header.noNotifications")}</div>
          ) : notifications.map((n: any) => (
            <div key={n.id} onClick={() => markRead(n.id, n.link)}
              style={{ padding: "10px 14px", borderBottom: "1px solid #f5f0e6", cursor: "pointer", background: n.isRead ? "white" : "#fdf8ec" }}>
              <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{n.message}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{new Date(n.createdAt).toLocaleString(locale)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopHeader({ user, navigate, location, isMobile, onOpenMenu }:
  { user: any; navigate: (p: string) => void; location: string; isMobile: boolean; onOpenMenu: () => void }) {

  const { t, locale } = useI18n();
  const { timeStr, dateStr } = useKuwaitClock(locale);

  const PAGE_KEYS = [
    "/tenders", "/practices", "/company-docs", "/gov-registrations", "/entities",
    "/suppliers", "/projects", "/guarantees", "/contracts", "/rfq", "/purchase-orders",
    "/transportation", "/finance", "/tasks", "/calendar", "/correspondence", "/residency",
    "/maintenance/report-templates", "/maintenance", "/research", "/pricing",
    "/competitor-intelligence", "/admin/users", "/admin/activity-log",
    "/admin/service-types", "/admin/task-types", "/guide",
  ];
  const pageKey = location === "/"
    ? "page./"
    : (() => {
        const k = PAGE_KEYS.find(k => location === k || location.startsWith(k + "/"))
          ?? PAGE_KEYS.find(k => location.startsWith(k));
        return k ? `page.${k}` : null;
      })();
  const currentPage = pageKey ? t(pageKey) : "";

  return (
    <header style={{
      height: 60, flexShrink: 0,
      background: "white",
      borderBottom: "1.5px solid #e5e7eb",
      display: "flex", alignItems: "center",
      paddingInline: isMobile ? "12px" : "20px 16px", gap: isMobile ? 8 : 12,
      boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      zIndex: 40, position: "sticky", top: 0,
    }}>

      {/* Hamburger (mobile only) */}
      {isMobile && (
        <button onClick={onOpenMenu} aria-label="menu" style={{
          background: "rgba(212,165,52,0.1)", border: "1px solid rgba(212,165,52,0.3)",
          borderRadius: 9, padding: 7, cursor: "pointer", display: "flex", flexShrink: 0,
        }}>
          <Menu size={18} color={GD} />
        </button>
      )}

      {/* Start: page badge + new tender */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {currentPage && (
          <div style={{
            padding: "4px 14px", borderRadius: 20,
            background: "rgba(212,165,52,0.1)", border: "1px solid rgba(212,165,52,0.25)",
            fontSize: 12, fontWeight: 800, color: GD, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis", maxWidth: isMobile ? 140 : undefined,
          }}>
            {currentPage}
          </div>
        )}
        {!isMobile && (user?.role === "admin" || user?.canEdit) && (
          <button onClick={() => navigate("/tenders/new")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 9, border: "none",
              background: `linear-gradient(135deg,${G},${GD})`,
              color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", boxShadow: "0 3px 10px rgba(212,165,52,0.35)",
              whiteSpace: "nowrap",
            }}>
            <Plus size={13} /> {t("header.newTender")}
          </button>
        )}
      </div>

      {/* Centre: clock + location (desktop only) */}
      {!isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={13} color="#6b7280" />
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{t("header.kuwait")}</span>
          </div>
          <div style={{ width: 1, height: 20, background: "#e5e7eb" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: GR2, fontFamily: "monospace", letterSpacing: 1 }}>{timeStr}</div>
            <div style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{dateStr}</div>
          </div>
        </div>
      )}

      {/* End: lang + bell + company */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0 }}>
        <LangToggle />
        <NotificationBell navigate={navigate} />
        {!isMobile && (
          <div style={{ textAlign: "end" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: GR2, whiteSpace: "nowrap" }}>{t("app.company")}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>{t("app.systemSub")}</div>
          </div>
        )}
        <div style={{ background: `linear-gradient(135deg,${GR},${GR2})`, borderRadius: 10, padding: "4px 8px", display: "flex" }}>
          <img src={logoImg} alt="Logo" style={{ height: isMobile ? 24 : 28, objectFit: "contain" }} />
        </div>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════
   MAIN LAYOUT
════════════════════════════════════════════ */
interface LayoutProps { children: React.ReactNode; }

export function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { dir } = useI18n();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canSeeGuarantees = user?.role === "admin" || !!user?.accessGuarantees;
  const expiringCount = useExpiringCount(canSeeGuarantees);
  const { t } = useI18n();
  const groups = buildNavGroups(user ?? null, expiringCount, t);

  // إغلاق القائمة المنزلقة عند تكبير الشاشة
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  return (
    <div dir={dir} style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif",
      background: "#f0ece4",
    }}>

      {/* Sticky top header */}
      <TopHeader
        user={user} navigate={navigate} location={location}
        isMobile={isMobile} onOpenMenu={() => setDrawerOpen(true)}
      />

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>

        {/* Sidebar: ثابت على الشاشات الكبيرة، منزلق على الجوال */}
        {!isMobile && (
          <Sidebar
            groups={groups}
            location={location}
            navigate={navigate}
            user={user}
            logout={logout}
          />
        )}
        {isMobile && drawerOpen && (
          <>
            <div onClick={() => setDrawerOpen(false)} style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
              zIndex: 99, backdropFilter: "blur(2px)",
            }} />
            <Sidebar
              groups={groups}
              location={location}
              navigate={navigate}
              user={user}
              logout={logout}
              mobile
              onClose={() => setDrawerOpen(false)}
            />
          </>
        )}

        {/* Main content */}
        <main style={{
          flex: 1, minWidth: 0, overflowY: "auto",
          padding: isMobile ? "14px 12px 40px" : "24px 22px 48px",
        }}>
          {children}
        </main>
      </div>

      <style>{`
        aside::-webkit-scrollbar { display: none; }
        main::-webkit-scrollbar { width: 5px; }
        main::-webkit-scrollbar-track { background: transparent; }
        main::-webkit-scrollbar-thumb { background: #d1c9b8; border-radius: 4px; }

        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50%       { transform: scale(1.12); box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        @keyframes dropDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawer-in-rtl {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes drawer-in-ltr {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
