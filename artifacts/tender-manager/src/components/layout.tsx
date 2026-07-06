import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Plus, BellRing,
  Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature, BookOpen,
  ChevronDown,
} from "lucide-react";
import React, { useState } from "react";

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

const navGroups: NavGroup[] = [
  {
    label: "الرئيسية",
    items: [
      { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
      { href: "/tenders", label: "سجل المناقصات", icon: FileText },
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
    ],
  },
];

function NavSection({ group, location }: { group: NavGroup; location: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider hover:text-sidebar-foreground/70 transition-colors"
      >
        <span>{group.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {group.items.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="w-full">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-sidebar border-l border-sidebar-border hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-sidebar-primary">
            <div className="bg-sidebar-primary rounded p-1">
              <FileText className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">سجل المناقصات</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-4 overflow-y-auto">
          {navGroups.map((group) => (
            <NavSection key={group.label} group={group} location={location} />
          ))}

          <div className="mt-2 pt-4 border-t border-sidebar-border">
            <div className="px-3 mb-1.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">إجراءات</div>
            <Link href="/tenders/new" className="w-full">
              <div className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-sidebar-primary hover:bg-sidebar-accent">
                <Plus className="h-4 w-4" />
                مناقصة جديدة
              </div>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-foreground">
              م
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground">مهندس رئيسي</span>
              <span className="text-xs text-sidebar-foreground/50">إدارة العطاءات</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b bg-card shadow-sm z-10 shrink-0">
          <div className="md:hidden font-bold text-lg text-foreground flex items-center gap-2">
            <div className="bg-primary rounded p-1">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            سجل المناقصات
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground relative">
              <BellRing className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary border-2 border-card"></span>
              </span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
