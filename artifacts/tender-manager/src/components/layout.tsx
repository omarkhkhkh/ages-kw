import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, Plus,
  Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature, BookOpen,
  Calendar, Shield, LogOut, UserCircle, Activity,
  ChevronDown, Clock,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import type { AuthUser } from "@/contexts/auth";
import logoImg from "@/assets/logo.png";
import { nowKuwait } from "@/lib/timezone";

interface LayoutProps { children: React.ReactNode; }

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#0b1a10";
const GR2 = "#132a18";

/* ── Nav structure ── */
const buildNavGroups = (user: AuthUser | null) => {
  if (!user) return [];
  const isAdmin = user.role === "admin";
  const can = (field: keyof AuthUser) => isAdmin || !!user[field];

  const groups = [
    {
      label: "الرئيسية",
      icon: LayoutDashboard,
      items: [
        { href: "/",         label: "لوحة التحكم",  icon: LayoutDashboard, show: true },
        { href: "/tenders",  label: "سجل المناقصات", icon: FileText,        show: can("accessTenders") },
        { href: "/calendar", label: "جدول الأعمال",  icon: Calendar,        show: true },
      ],
    },
    {
      label: "قواعد البيانات",
      icon: Building2,
      items: [
        { href: "/entities",        label: "الجهات الحكومية",       icon: Building2,    show: can("accessEntities") },
        { href: "/suppliers",       label: "الموردون",              icon: Users,        show: can("accessSuppliers") },
        { href: "/rfq",             label: "طلبات عروض الأسعار",   icon: ClipboardList, show: can("accessRfq") },
        { href: "/purchase-orders", label: "أوامر الشراء المباشر", icon: ShoppingCart, show: can("accessPo") },
      ],
    },
    {
      label: "إدارة المشاريع",
      icon: FolderOpen,
      items: [
        { href: "/projects",   label: "المشاريع",         icon: FolderOpen,    show: can("accessProjects") },
        { href: "/guarantees", label: "الكفالات البنكية", icon: ShieldCheck,   show: can("accessGuarantees") },
        { href: "/contracts",  label: "العقود",            icon: FileSignature, show: can("accessContracts") },
      ],
    },
    {
      label: "أدوات",
      icon: BookOpen,
      items: [
        { href: "/guide",               label: "دليل Microsoft 365", icon: BookOpen, show: true      },
        { href: "/admin/users",         label: "إدارة المستخدمين",   icon: Shield,   show: isAdmin   },
        { href: "/admin/activity-log",  label: "سجل الحركات",        icon: Activity, show: isAdmin   },
      ],
    },
  ];

  // Remove items user can't see, remove empty groups
  return groups
    .map(g => ({ ...g, items: g.items.filter(i => i.show) }))
    .filter(g => g.items.length > 0);
};

/* ── Kuwait clock ── */
function KuwaitClock() {
  const [time, setTime] = useState(() => {
    return nowKuwait().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  });
  useEffect(() => {
    const id = setInterval(() => {
      setTime(nowKuwait().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(212,165,52,0.65)", fontSize: 12, fontFamily: "monospace" }}>
      <Clock size={12} />
      {time}
    </div>
  );
}

/* ── Dropdown menu item ── */
function NavDropdown({ group, location }: { group: ReturnType<typeof buildNavGroups>[0]; location: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isGroupActive = group.items.some(
    item => location === item.href || (item.href !== "/" && location.startsWith(item.href))
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 10, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          background: isGroupActive ? "rgba(212,165,52,0.18)" : open ? "rgba(255,255,255,0.08)" : "transparent",
          border: isGroupActive ? "1px solid rgba(212,165,52,0.35)" : "1px solid transparent",
          color: isGroupActive ? G : "rgba(255,255,255,0.75)",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { if (!isGroupActive && !open) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
        onMouseLeave={e => { if (!isGroupActive && !open) e.currentTarget.style.background = "transparent"; }}
      >
        <group.icon size={15} />
        {group.label}
        <ChevronDown size={13} style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.7 }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)",
          right: 0, minWidth: 220, zIndex: 100,
          background: "white",
          borderRadius: 14,
          border: "1.5px solid #f0ead8",
          boxShadow: "0 16px 48px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
          overflow: "hidden",
          animation: "dropDown 0.15s ease",
        }}>
          {/* Arrow */}
          <div style={{ position: "absolute", top: -6, right: 18, width: 12, height: 12, background: "white", border: "1.5px solid #f0ead8", borderBottom: "none", borderLeft: "none", transform: "rotate(-45deg)", borderRadius: "2px 0 0 0" }} />

          <div style={{ padding: "6px" }}>
            {group.items.map(item => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10,
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? GD : "#374151",
                    background: isActive ? `${G}12` : "transparent",
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: isActive ? `${G}18` : "#f3f4f6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.12s",
                    }}>
                      <item.icon size={15} color={isActive ? GD : "#6b7280"} />
                    </div>
                    <span>{item.label}</span>
                    {isActive && <div style={{ marginRight: "auto", width: 6, height: 6, borderRadius: "50%", background: G }} />}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── User menu ── */
function UserMenu({ user, logout }: { user: any; logout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px 6px 6px", borderRadius: 12, cursor: "pointer",
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
        fontFamily: "inherit", transition: "background 0.15s",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg,${G},${GD})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "white",
        }}>
          {user?.fullName?.charAt(0) ?? "م"}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "white", lineHeight: 1.2 }}>{user?.fullName}</div>
          <div style={{ fontSize: 10, color: "rgba(212,165,52,0.6)" }}>
            {user?.role === "admin" ? "مدير النظام" : "موظف"}
          </div>
        </div>
        <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.4)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 180, zIndex: 100,
          background: "white", borderRadius: 12,
          border: "1.5px solid #f0ead8",
          boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
          overflow: "hidden", animation: "dropDown 0.15s ease",
          padding: "6px",
        }}>
          <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid #f5f0e6", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GR2 }}>{user?.fullName}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              {user?.role === "admin" ? "مدير النظام" : "موظف"}
            </div>
          </div>
          <button onClick={() => { setOpen(false); logout(); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#dc2626", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "background 0.12s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#fff1f2")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <LogOut size={14} /> تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Layout ── */
export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const navGroups = buildNavGroups(user ?? null);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif" }} dir="rtl">

      {/* ══ Top Navbar ══ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: `linear-gradient(135deg, ${GR} 0%, ${GR2} 60%, #1a3a20 100%)`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
      }}>
        {/* Main nav row */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "0 24px", height: 64, gap: 8,
          maxWidth: 1600, margin: "0 auto",
        }}>

          {/* Logo */}
          <Link href="/">
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 12px 6px 6px", borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer", flexShrink: 0,
              transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              <div style={{
                background: "rgba(255,255,255,0.95)",
                borderRadius: 8, padding: "4px 8px",
              }}>
                <img src={logoImg} alt="Arabian Group" style={{ height: 30, objectFit: "contain", display: "block" }} />
              </div>
              <div style={{ display: "none" }} className="sm-show">
                <div style={{ fontSize: 11, fontWeight: 800, color: G, lineHeight: 1.2 }}>المجموعة العربية</div>
                <div style={{ fontSize: 9, color: "rgba(212,165,52,0.45)", marginTop: 1 }}>للخدمات التعلمية</div>
              </div>
            </div>
          </Link>

          {/* Divider */}
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)", marginInline: 4, flexShrink: 0 }} />

          {/* Nav groups — scrollable on small screens */}
          <nav style={{
            display: "flex", alignItems: "center", gap: 2,
            flex: 1, overflowX: "auto",
            scrollbarWidth: "none",
          }}>
            {/* Dashboard direct link */}
            <Link href="/">
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                background: location === "/" ? "rgba(212,165,52,0.18)" : "transparent",
                border: location === "/" ? "1px solid rgba(212,165,52,0.35)" : "1px solid transparent",
                color: location === "/" ? G : "rgba(255,255,255,0.75)",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}
                onMouseEnter={e => { if (location !== "/") e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { if (location !== "/") e.currentTarget.style.background = "transparent"; }}
              >
                <LayoutDashboard size={15} />
                لوحة التحكم
              </button>
            </Link>

            {/* Dropdown groups */}
            {navGroups.map(group => (
              <NavDropdown key={group.label} group={group} location={location} />
            ))}
          </nav>

          {/* Right side: clock + new tender + user */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <KuwaitClock />

            {(user?.role === "admin" || user?.canEdit) && (
              <Link href="/tenders/new">
                <button style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  background: `linear-gradient(135deg,${G},${GD})`,
                  border: "none", color: "white",
                  boxShadow: `0 4px 14px rgba(212,165,52,0.4)`,
                  transition: "transform 0.1s, box-shadow 0.1s",
                  whiteSpace: "nowrap",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 20px rgba(212,165,52,0.55)`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 14px rgba(212,165,52,0.4)`; }}
                >
                  <Plus size={14} />
                  مناقصة جديدة
                </button>
              </Link>
            )}

            <UserMenu user={user} logout={logout} />
          </div>
        </div>

        {/* Breadcrumb strip */}
        {location !== "/" && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            padding: "0 24px", height: 34,
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(0,0,0,0.15)",
            maxWidth: 1600, margin: "0 auto",
          }}>
            <Link href="/">
              <span style={{ fontSize: 11, color: "rgba(212,165,52,0.5)", cursor: "pointer", transition: "color 0.12s" }}
                onMouseEnter={e => (e.currentTarget.style.color = G)}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(212,165,52,0.5)")}
              >الرئيسية</span>
            </Link>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
              {(() => {
                const PAGE_NAMES: Record<string, string> = {
                  "/tenders": "سجل المناقصات", "/entities": "الجهات الحكومية",
                  "/suppliers": "الموردون", "/projects": "المشاريع",
                  "/guarantees": "الكفالات البنكية", "/contracts": "العقود",
                  "/rfq": "طلبات عروض الأسعار", "/purchase-orders": "أوامر الشراء المباشر",
                  "/calendar": "جدول الأعمال", "/guide": "دليل Microsoft 365",
                  "/admin/users": "إدارة المستخدمين", "/admin/activity-log": "سجل الحركات",
                };
                return PAGE_NAMES[location] ?? PAGE_NAMES[Object.keys(PAGE_NAMES).find(k => location.startsWith(k)) ?? ""] ?? location;
              })()}
            </span>
          </div>
        )}
      </header>

      {/* ══ Page content ══ */}
      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "28px 24px 48px" }}>
        {children}
      </main>

      <style>{`
        @keyframes dropDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        nav::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
