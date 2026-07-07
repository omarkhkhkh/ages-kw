import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, Plus,
  Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature,
  Calendar, LogOut, Activity,
  ChevronDown, Clock, Truck, Wallet, ListChecks, ClipboardCheck,
  FileCheck, Landmark,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import type { AuthUser } from "@/contexts/auth";
import logoImg from "@/assets/logo.png";
import { nowKuwait } from "@/lib/timezone";

/* ── fetch helper ── */
async function apiFetch<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ── hook: count guarantees expiring within 30 days ── */
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

interface LayoutProps { children: React.ReactNode; }

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#0b1a10";
const GR2 = "#132a18";

/* ── All nav links (flat, no dropdowns) ── */
const buildNavLinks = (user: AuthUser | null) => {
  if (!user) return [];
  const isAdmin = user.role === "admin";
  const can = (field: keyof AuthUser) => isAdmin || !!user[field];
  return [
    { href: "/",               label: "الرئيسية",               icon: LayoutDashboard, show: true },
    { href: "/tenders",        label: "المناقصات",              icon: FileText,        show: can("accessTenders") },
    { href: "/practices",      label: "الممارسات",              icon: ClipboardCheck,  show: can("accessTenders") },
    { href: "/company-docs",      label: "وثائق الشركة",       icon: FileCheck,  show: isAdmin || can("accessTenders") },
    { href: "/gov-registrations", label: "تسجيلات الجهات",    icon: Landmark,   show: isAdmin || can("accessTenders") },
    { href: "/entities",       label: "الجهات الحكومية",        icon: Building2,       show: can("accessEntities") },
    { href: "/suppliers",      label: "الموردون",               icon: Users,           show: can("accessSuppliers") },
    { href: "/projects",       label: "المشاريع",               icon: FolderOpen,      show: can("accessProjects") },
    { href: "/guarantees",     label: "الكفالات",               icon: ShieldCheck,     show: can("accessGuarantees") },
    { href: "/contracts",      label: "العقود",                  icon: FileSignature,   show: can("accessContracts") },
    { href: "/rfq",            label: "عروض الأسعار",           icon: ClipboardList,   show: can("accessRfq") },
    { href: "/purchase-orders",   label: "أوامر الشراء",    icon: ShoppingCart,  show: can("accessPo") },
    { href: "/transportation",    label: "النقل والتوزيع",  icon: Truck,         show: can("accessTransportation") },
    { href: "/finance",           label: "الإدارة المالية", icon: Wallet,        show: isAdmin },
    { href: "/tasks",             label: "المهام",           icon: ListChecks,    show: true },
    { href: "/calendar",          label: "جدول الأعمال",    icon: Calendar,      show: true },
  ].filter(i => i.show);
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
          position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 210, zIndex: 100,
          background: "white", borderRadius: 14,
          border: "1.5px solid #f0ead8",
          boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
          overflow: "hidden", animation: "dropDown 0.15s ease",
          padding: "6px",
        }}>
          {/* User info */}
          <div style={{ padding: "10px 14px 12px", borderBottom: "1px solid #f5f0e6", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: GR2 }}>{user?.fullName}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              {user?.role === "admin" ? "🛡 مدير النظام" : "موظف"}
            </div>
          </div>

          {/* Admin links */}
          {user?.role === "admin" && (
            <>
              <div style={{ padding: "4px 10px 2px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5 }}>
                إدارة النظام
              </div>
              {[
                { href: "/admin/users",       icon: Users,     label: "إدارة المستخدمين", color: GD },
                { href: "/admin/activity-log", icon: Activity,  label: "سجل الحركات",       color: "#7c3aed" },
              ].map(item => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: item.color, cursor: "pointer", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${item.color}10`)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${item.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <item.icon size={14} color={item.color} />
                    </div>
                    {item.label}
                  </div>
                </Link>
              ))}
              <div style={{ height: 1, background: "#f5f0e6", margin: "4px 0" }} />
            </>
          )}

          {/* Logout */}
          <button onClick={() => { setOpen(false); logout(); }}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#dc2626", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "background 0.12s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#fff1f2")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fff1f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={14} color="#dc2626" />
            </div>
            تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Layout ── */
export function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const navLinks = buildNavLinks(user ?? null);
  const canSeeGuarantees = user?.role === "admin" || !!user?.accessGuarantees;
  const expiringCount = useExpiringCount(canSeeGuarantees);

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
          <a href="/" onClick={e => { e.preventDefault(); navigate("/"); }} className="nav-logo">
            <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 8, padding: "4px 8px" }}>
              <img src={logoImg} alt="Arabian Group" style={{ height: 30, objectFit: "contain", display: "block" }} />
            </div>
          </a>

          {/* Divider */}
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)", marginInline: 4, flexShrink: 0 }} />

          {/* Nav — all direct links, horizontally scrollable */}
          <nav style={{
            display: "flex", alignItems: "center", gap: 2,
            flex: 1, overflowX: "auto", scrollbarWidth: "none",
          }}>
            {navLinks.map(link => {
              const isActive = link.href === "/"
                ? location === "/"
                : location === link.href || location.startsWith(link.href + "/");
              const isGuarantees = link.href === "/guarantees";
              const showBadge = isGuarantees && expiringCount > 0;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={e => { e.preventDefault(); navigate(link.href); }}
                  className={isActive ? "nav-link nav-link-active" : "nav-link"}
                  title={showBadge ? `${expiringCount} كفالة تنتهي خلال 30 يوماً` : undefined}
                >
                  {/* Icon wrapper — badge overlaid when needed */}
                  <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                    <link.icon size={14} />
                    {showBadge && (
                      <span style={{
                        position: "absolute",
                        top: -6, left: -6,
                        minWidth: 15, height: 15,
                        borderRadius: 8,
                        background: "#ef4444",
                        border: "1.5px solid #0b1a10",
                        color: "white",
                        fontSize: 9,
                        fontWeight: 800,
                        lineHeight: "12px",
                        padding: "0 3px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        animation: "badge-pulse 2s ease-in-out infinite",
                      }}>
                        {expiringCount > 9 ? "9+" : expiringCount}
                      </span>
                    )}
                  </span>
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Right side: clock + new tender + user */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <KuwaitClock />

            {(user?.role === "admin" || user?.canEdit) && (
              <a href="/tenders/new" onClick={e => { e.preventDefault(); navigate("/tenders/new"); }} className="btn-new-tender">
                <Plus size={14} />
                مناقصة جديدة
              </a>
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
                  "/tenders": "سجل المناقصات", "/practices": "الممارسات",
                  "/company-docs": "وثائق الشركة الرسمية", "/gov-registrations": "تسجيلات الجهات الحكومية",
                  "/entities": "الجهات الحكومية",
                  "/suppliers": "الموردون", "/projects": "المشاريع",
                  "/guarantees": "الكفالات البنكية", "/contracts": "العقود",
                  "/rfq": "طلبات عروض الأسعار", "/purchase-orders": "أوامر الشراء المباشر",
                  "/transportation": "النقل والتوزيع",
                  "/tasks": "المهام",
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
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50%       { transform: scale(1.12); box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        nav::-webkit-scrollbar { display: none; }

        /* Logo */
        .nav-logo {
          display: inline-flex;
          align-items: center;
          padding: 6px 8px;
          border-radius: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          flex-shrink: 0;
          text-decoration: none;
          transition: background 0.15s;
        }
        .nav-logo:hover { background: rgba(255,255,255,0.12); }

        /* Nav links */
        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 13px;
          border-radius: 10px;
          font-family: 'Cairo','IBM Plex Sans Arabic',sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          background: transparent;
          border: 1px solid transparent;
          color: rgba(255,255,255,0.78);
        }
        .nav-link:hover {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.95);
        }
        .nav-link-active {
          background: rgba(212,165,52,0.18) !important;
          border-color: rgba(212,165,52,0.35) !important;
          color: #D4A534 !important;
        }
        .nav-link-active:hover {
          background: rgba(212,165,52,0.24) !important;
        }

        /* New tender button */
        .btn-new-tender {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 10px;
          font-family: 'Cairo','IBM Plex Sans Arabic',sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          background: linear-gradient(135deg,#D4A534,#A87C20);
          color: white;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(212,165,52,0.4);
          transition: transform 0.1s, box-shadow 0.1s;
        }
        .btn-new-tender:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(212,165,52,0.55);
        }
      `}</style>
    </div>
  );
}
