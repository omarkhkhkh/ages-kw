import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature, Calendar, LogOut, Activity,
  ChevronDown, Clock, Truck, Wallet, ListChecks, ClipboardCheck,
  FileCheck, Landmark, Settings, Bell, HelpCircle, Headphones,
  MapPin, BarChart3, Plus, X, Menu, Trophy, Sparkles,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import type { AuthUser } from "@/contexts/auth";
import logoImg from "@/assets/logo.png";
import { nowKuwait } from "@/lib/timezone";

/* ── colours ── */
const G   = "#D4A534";
const GD  = "#A87C20";
const GR  = "#0b1a10";
const GR2 = "#132a18";
const SIDEBAR_W = 248;

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
function useKuwaitClock() {
  const [now, setNow] = useState(() => nowKuwait());
  useEffect(() => {
    const id = setInterval(() => setNow(nowKuwait()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("ar-KW", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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

const buildNavGroups = (user: AuthUser | null, expiringCount: number): NavGroup[] => {
  if (!user) return [];
  const isAdmin = user.role === "admin";
  const can = (f: keyof AuthUser) => isAdmin || !!user[f];
  return [
    {
      id: "home", label: "الرئيسية", icon: LayoutDashboard,
      show: true, href: "/",
    },
    {
      id: "tenders", label: "المناقصات والمشاريع", icon: FileText,
      show: can("accessTenders") || can("accessProjects"),
      items: [
        { href: "/tenders",   label: "المناقصات",  show: can("accessTenders") },
        { href: "/practices", label: "الممارسات",  show: can("accessTenders") },
        { href: "/projects",  label: "المشاريع",   show: can("accessProjects") },
      ].filter(i => i.show),
    },
    {
      id: "contracts", label: "أوامر الشراء والعقود", icon: FileSignature,
      show: can("accessContracts") || can("accessPo") || can("accessRfq"),
      items: [
        { href: "/contracts",       label: "العقود",          show: can("accessContracts") },
        { href: "/purchase-orders", label: "أوامر الشراء",    show: can("accessPo") },
        { href: "/rfq",             label: "عروض الأسعار",    show: can("accessRfq") },
      ].filter(i => i.show),
    },
    {
      id: "suppliers", label: "الموردون", icon: Users,
      show: can("accessSuppliers"), href: "/suppliers",
    },
    {
      id: "entities", label: "الجهات الحكومية", icon: Building2,
      show: can("accessEntities") || isAdmin,
      items: [
        { href: "/entities",          label: "الجهات الحكومية",  show: can("accessEntities") },
        { href: "/gov-registrations", label: "تسجيلات الجهات",   show: isAdmin || can("accessTenders") },
        { href: "/guarantees",        label: "خطابات الضمان",    show: can("accessGuarantees"), badge: expiringCount || 0 },
      ].filter(i => i.show),
    },
    {
      id: "finance", label: "الشؤون المالية", icon: Wallet,
      show: isAdmin, href: "/finance",
    },
    {
      id: "docs", label: "المستندات والأرشيف", icon: FileCheck,
      show: isAdmin || can("accessTenders"), href: "/company-docs",
    },
    {
      id: "transport", label: "المركبات والنقل", icon: Truck,
      show: can("accessTransportation"), href: "/transportation",
    },
    {
      id: "tasks", label: "المهام والمتابعة", icon: ListChecks,
      show: true,
      items: [
        { href: "/tasks",    label: "المهام",       show: true },
        { href: "/calendar", label: "جدول الأعمال", show: true },
      ],
    },
    {
      id: "competitor-intelligence", label: "ذكاء المنافسين", icon: Trophy,
      show: can("accessTenders"),
      items: [
        { href: "/competitor-intelligence",         label: "لوحة المنافسين",  show: can("accessTenders") },
        { href: "/competitor-intelligence/predict", label: "تنبؤ المنافسين",  show: can("accessTenders") },
      ].filter(i => i.show),
    },
    {
      id: "analytics", label: "التقارير والتحليلات", icon: BarChart3,
      show: false, href: "/",        // placeholder — no dedicated route yet
    },
    {
      id: "settings", label: "الإعدادات", icon: Settings,
      show: isAdmin,
      items: [
        { href: "/admin/users",        label: "إدارة المستخدمين", show: isAdmin },
        { href: "/admin/activity-log", label: "سجل الحركات",      show: isAdmin },
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
function Sidebar({ groups, location, navigate, user, logout }:
  { groups: NavGroup[]; location: string; navigate: (p: string) => void; user: any; logout: () => void }) {

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

  return (
    <aside style={{
      width: SIDEBAR_W, flexShrink: 0,
      background: `linear-gradient(180deg, ${GR} 0%, ${GR2} 40%, #0e2312 100%)`,
      display: "flex", flexDirection: "column",
      borderLeft: "1px solid rgba(212,165,52,0.15)",
      overflowY: "auto", overflowX: "hidden",
      scrollbarWidth: "none",
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
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: G, lineHeight: 1.3 }}>المجموعة العربية</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.3 }}>للخدمات التعليمية</div>
        </div>
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
                onClick={() => navigate(group.href!)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 10, marginBottom: 2,
                  background: isActive ? `rgba(212,165,52,0.18)` : "transparent",
                  border: isActive ? `1px solid rgba(212,165,52,0.3)` : "1px solid transparent",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                  textAlign: "right",
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
                <span style={{ fontSize: 13, fontWeight: isGroupActive ? 800 : 600, color: isGroupActive ? G : "rgba(255,255,255,0.75)", flex: 1, textAlign: "right" }}>
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
                      <button key={item.href} onClick={() => navigate(item.href)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 12px 8px 16px", cursor: "pointer",
                          background: isActive ? `rgba(212,165,52,0.15)` : "transparent",
                          border: "none", fontFamily: "inherit", transition: "background 0.1s",
                          textAlign: "right",
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
        <button onClick={() => navigate("/guide")}
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
          <span style={{ fontSize: 13, fontWeight: 700, color: G }}>الدعم الفني</span>
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
          title="تسجيل الخروج"
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg,${G},${GD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "white",
          }}>
            {user?.fullName?.charAt(0) ?? "م"}
          </div>
          <div style={{ textAlign: "right", flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.fullName}</div>
            <div style={{ fontSize: 10, color: "rgba(212,165,52,0.55)" }}>{user?.role === "admin" ? "مدير النظام" : "موظف"}</div>
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
function TopHeader({ user, navigate, location, unreadCount }:
  { user: any; navigate: (p: string) => void; location: string; unreadCount?: number }) {

  const { timeStr, dateStr } = useKuwaitClock();

  const PAGE_NAMES: Record<string, string> = {
    "/": "الرئيسية",
    "/tenders": "سجل المناقصات", "/practices": "الممارسات",
    "/company-docs": "وثائق الشركة الرسمية", "/gov-registrations": "تسجيلات الجهات الحكومية",
    "/entities": "الجهات الحكومية",
    "/suppliers": "الموردون", "/projects": "المشاريع",
    "/guarantees": "الكفالات البنكية", "/contracts": "العقود",
    "/rfq": "طلبات عروض الأسعار", "/purchase-orders": "أوامر الشراء المباشر",
    "/transportation": "النقل والتوزيع", "/finance": "الشؤون المالية",
    "/tasks": "المهام", "/calendar": "جدول الأعمال",
    "/admin/users": "إدارة المستخدمين", "/admin/activity-log": "سجل الحركات",
    "/guide": "الدعم الفني",
  };
  const currentPage = PAGE_NAMES[location]
    ?? PAGE_NAMES[Object.keys(PAGE_NAMES).find(k => k !== "/" && location.startsWith(k)) ?? ""]
    ?? "";

  return (
    <header style={{
      height: 60, flexShrink: 0,
      background: "white",
      borderBottom: "1.5px solid #e5e7eb",
      display: "flex", alignItems: "center",
      paddingInline: "20px 16px", gap: 12,
      boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      zIndex: 40, position: "sticky", top: 0,
    }}>

      {/* Left: company branding */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        {/* page badge */}
        {currentPage && (
          <div style={{
            padding: "4px 14px", borderRadius: 20,
            background: "rgba(212,165,52,0.1)", border: "1px solid rgba(212,165,52,0.25)",
            fontSize: 12, fontWeight: 800, color: GD, whiteSpace: "nowrap",
          }}>
            {currentPage}
          </div>
        )}
        {/* new tender shortcut */}
        {(user?.role === "admin" || user?.canEdit) && (
          <button onClick={() => navigate("/tenders/new")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 9, border: "none",
              background: `linear-gradient(135deg,${G},${GD})`,
              color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", boxShadow: "0 3px 10px rgba(212,165,52,0.35)",
              whiteSpace: "nowrap",
            }}>
            <Plus size={13} /> مناقصة جديدة
          </button>
        )}
      </div>

      {/* Centre: clock + location */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <MapPin size={13} color="#6b7280" />
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>الكويت</span>
        </div>
        <div style={{ width: 1, height: 20, background: "#e5e7eb" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: GR2, fontFamily: "monospace", letterSpacing: 1 }}>{timeStr}</div>
          <div style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{dateStr}</div>
        </div>
      </div>

      {/* Right: company name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: GR2, whiteSpace: "nowrap" }}>المجموعة العربية للخدمات التعليمية</div>
          <div style={{ fontSize: 10, color: "#9ca3af" }}>نظام إدارة المناقصات والأعمال التجارية</div>
        </div>
        <div style={{ background: `linear-gradient(135deg,${GR},${GR2})`, borderRadius: 10, padding: "4px 8px", display: "flex" }}>
          <img src={logoImg} alt="Logo" style={{ height: 28, objectFit: "contain" }} />
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
  const canSeeGuarantees = user?.role === "admin" || !!user?.accessGuarantees;
  const expiringCount = useExpiringCount(canSeeGuarantees);
  const groups = buildNavGroups(user ?? null, expiringCount);

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif",
      background: "#f0ece4",
    }}>

      {/* Sticky top header */}
      <TopHeader user={user} navigate={navigate} location={location} />

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>

        {/* Right sidebar */}
        <Sidebar
          groups={groups}
          location={location}
          navigate={navigate}
          user={user}
          logout={logout}
        />

        {/* Main content */}
        <main style={{
          flex: 1, minWidth: 0, overflowY: "auto",
          padding: "24px 22px 48px",
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
      `}</style>
    </div>
  );
}
