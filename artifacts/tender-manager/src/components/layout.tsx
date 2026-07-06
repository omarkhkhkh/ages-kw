import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Plus,
  Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature, BookOpen,
  ChevronDown, Calendar, Shield, LogOut, UserCircle, Activity,
} from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { nowKuwait } from "@/lib/timezone";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNavGroups(isAdmin: boolean): NavGroup[] {
  return [
    {
      label: "الرئيسية",
      items: [
        { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
        { href: "/tenders", label: "سجل المناقصات", icon: FileText },
        { href: "/calendar", label: "جدول الأعمال", icon: Calendar },
      ],
    },
    {
      label: "قواعد البيانات",
      items: [
        { href: "/entities", label: "الجهات الحكومية", icon: Building2 },
        { href: "/suppliers", label: "الموردون", icon: Users },
        { href: "/rfq", label: "طلبات عروض الأسعار", icon: ClipboardList },
        { href: "/purchase-orders", label: "أوامر الشراء المباشر", icon: ShoppingCart },
      ],
    },
    {
      label: "إدارة المشاريع",
      items: [
        { href: "/projects", label: "المشاريع", icon: FolderOpen },
        { href: "/guarantees", label: "الكفالات البنكية", icon: ShieldCheck },
        { href: "/contracts", label: "العقود", icon: FileSignature },
      ],
    },
    {
      label: "أدوات",
      items: [
        { href: "/guide", label: "دليل Microsoft 365", icon: BookOpen },
        ...(isAdmin ? [
          { href: "/admin/users", label: "إدارة المستخدمين", icon: Shield },
          { href: "/admin/activity-log", label: "سجل الحركات", icon: Activity },
        ] : []),
      ],
    },
  ];
}

function NavSection({ group, location }: { group: NavGroup; location: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest hover:text-sidebar-foreground/60 transition-colors"
      >
        <span>{group.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-1">
          {group.items.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="w-full">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium",
                  isActive
                    ? "bg-amber-500/15 text-amber-600 border border-amber-500/20 shadow-sm"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}>
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-amber-500")} />
                  <span className="truncate">{item.label}</span>
                  {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KuwaitClock() {
  const [time, setTime] = useState(() => {
    const now = nowKuwait();
    return now.toLocaleTimeString("ar-KW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });
  React.useEffect(() => {
    const id = setInterval(() => {
      const now = nowKuwait();
      setTime(now.toLocaleTimeString("ar-KW", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-sidebar-foreground/50 tabular-nums">{time} (KWT)</span>;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const navGroups = buildNavGroups(user?.role === "admin");

  const todayAr = nowKuwait().toLocaleDateString("ar-KW", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex min-h-screen w-full bg-slate-50" dir="rtl">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col shadow-xl"
        style={{ background: "linear-gradient(180deg, #0f2347 0%, #0a1628 100%)" }}>

        {/* Company header */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          {/* Logo */}
          <div className="mb-2">
            <img
              src="/logo-transparent.png"
              alt="Arabian Group"
              style={{ width: 140, objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}
            />
          </div>
          <div className="text-blue-300/50 text-[10px] font-medium tracking-wide">
            نظام إدارة المناقصات والعقود
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-3 overflow-y-auto">
          {navGroups.map((group) => (
            <NavSection key={group.label} group={group} location={location} />
          ))}

          {/* Quick action */}
          {(user?.role === "admin" || user?.canEdit) && (
            <div className="mt-2 pt-3 border-t border-white/10">
              <Link href="/tenders/new" className="w-full">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.25)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,158,11,0.15)")}>
                  <Plus className="h-4 w-4" />
                  مناقصة جديدة
                </div>
              </Link>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex flex-col gap-1 px-1 mb-3">
            <KuwaitClock />
            <span className="text-[10px] text-blue-300/30">{todayAr}</span>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white" }}>
              {user?.fullName?.charAt(0) ?? "م"}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold text-white truncate">{user?.fullName}</span>
              <span className="text-xs text-blue-300/50">
                {user?.role === "admin" ? "مدير النظام" : "موظف"}
              </span>
            </div>
            <button
              onClick={() => logout()}
              title="تسجيل الخروج"
              className="text-blue-300/40 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
          {/* Mobile brand */}
          <div className="md:hidden font-black text-base text-slate-800">
            المجموعة العربية للخدمات التعلمية
          </div>
          <div className="hidden md:block" />

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden md:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border"
                style={user.role === "admin"
                  ? { background: "rgba(245,158,11,0.08)", color: "#d97706", borderColor: "rgba(245,158,11,0.3)" }
                  : { background: "rgba(59,130,246,0.08)", color: "#2563eb", borderColor: "rgba(59,130,246,0.2)" }
                }>
                {user.role === "admin"
                  ? <><Shield className="h-3.5 w-3.5" /> مدير النظام</>
                  : <><UserCircle className="h-3.5 w-3.5" /> {user.fullName}</>
                }
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
