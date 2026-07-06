import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, Plus,
  Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature,
  Calendar, LogOut, Activity,
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

/* ── All nav links (flat, no dropdowns) ── */
const buildNavLinks = (user: AuthUser | null) => {
  if (!user) return [];
  const isAdmin = user.role === "admin";
  const can = (field: keyof AuthUser) => isAdmin || !!user[field];
  return [
    { href: "/",               label: "الرئيسية",               icon: LayoutDashboard, show: true },
    { href: "/tenders",        label: "المناقصات",              icon: FileText,        show: can("accessTenders") },
    { href: "/entities",       label: "الجهات الحكومية",        icon: Building2,       show: can("accessEntities") },
    { href: "/suppliers",      label: "الموردون",               icon: Users,           show: can("accessSuppliers") },
    { href: "/projects",       label: "المشاريع",               icon: FolderOpen,      show: can("accessProjects") },
    { href: "/guarantees",     label: "الكفالات",               icon: ShieldCheck,     show: can("accessGuarantees") },
    { href: "/contracts",      label: "العقود",                  icon: FileSignature,   show: can("accessContracts") },
    { href: "/rfq",            label: "عروض الأسعار",           icon: ClipboardList,   show: can("accessRfq") },
    { href: "/purchase-orders",label: "أوامر الشراء",           icon: ShoppingCart,    show: can("accessPo") },
    { href: "/calendar",       label: "جدول الأعمال",           icon: Calendar,        show: true },
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
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const navLinks = buildNavLinks(user ?? null);

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

          {/* Nav — all direct links, horizontally scrollable */}
          <nav style={{
            display: "flex", alignItems: "center", gap: 2,
            flex: 1, overflowX: "auto", scrollbarWidth: "none",
          }}>
            {navLinks.map(link => {
              const isActive = link.href === "/"
                ? location === "/"
                : location === link.href || location.startsWith(link.href + "/");
              return (
                <Link key={link.href} href={link.href} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 13px", borderRadius: 10, cursor: "pointer",
                  fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif",
                  fontSize: 13, fontWeight: 700, textDecoration: "none",
                  whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s",
                  background: isActive ? "rgba(212,165,52,0.18)" : "transparent",
                  border: `1px solid ${isActive ? "rgba(212,165,52,0.35)" : "transparent"}`,
                  color: isActive ? G : "rgba(255,255,255,0.78)",
                }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <link.icon size={14} style={{ flexShrink: 0 }} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: clock + new tender + user */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <KuwaitClock />

            {(user?.role === "admin" || user?.canEdit) && (
              <Link href="/tenders/new" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif",
                fontSize: 13, fontWeight: 700, textDecoration: "none",
                background: `linear-gradient(135deg,${G},${GD})`,
                color: "white", whiteSpace: "nowrap", flexShrink: 0,
                boxShadow: `0 4px 14px rgba(212,165,52,0.4)`,
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px rgba(212,165,52,0.55)`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 14px rgba(212,165,52,0.4)`; }}
              >
                <Plus size={14} />
                مناقصة جديدة
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
