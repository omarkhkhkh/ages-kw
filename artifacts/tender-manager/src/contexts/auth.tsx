import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "employee";
  // Global permissions
  canView: boolean;
  canDownload: boolean;
  canUpload: boolean;
  canEdit: boolean;
  // Per-module access
  accessTenders: boolean;
  accessEntities: boolean;
  accessSuppliers: boolean;
  accessProjects: boolean;
  accessGuarantees: boolean;
  accessContracts: boolean;
  accessRfq: boolean;
  accessPo: boolean;
  accessTransportation: boolean;
  accessFinance: boolean;
  accessCorrespondence: boolean;
  accessResidency: boolean;
  accessMaintenance: boolean;
  accessResearch: boolean;
  accessPricing: boolean;
  accessTasks: boolean;
  accessOpportunities: boolean;
  opportunityCanPrice: boolean;
  opportunityCanApprove: boolean;
  taskViewScope: "own" | "department" | "all";
  taskCanApprove: boolean;
  correspondenceViewAll: boolean;
  permissions?: Record<string, { view: boolean; add: boolean; edit: boolean; del: boolean }>;
  recordViewScope?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiFetch<AuthUser>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const me = await apiFetch<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(me);
  };

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  // ── Session expiry watcher ────────────────────────────────────────────────
  // Listens for the 'session-expired' event dispatched by apiFetch on 401.
  // Only fires when the user was actually logged in (prevents false positives
  // on the initial /auth/me check before login).
  useEffect(() => {
    let alreadyHandled = false;

    const handler = () => {
      // Ignore if we're not currently logged in (e.g. page load before auth)
      if (!user) return;
      // Debounce: multiple simultaneous 401s should only show one toast
      if (alreadyHandled) return;
      alreadyHandled = true;

      toast({
        title: "انتهت الجلسة",
        description: "انتهت مدة جلستك. يرجى تسجيل الدخول مجدداً.",
        variant: "destructive",
        duration: 5000,
      } as any);

      // Clear user state — the app will redirect to login automatically
      setUser(null);

      // Reset debounce after a short delay
      setTimeout(() => { alreadyHandled = false; }, 3000);
    };

    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Returns true if the current user has access to a given module */
export function useModuleAccess(module: keyof Pick<AuthUser,
  "accessTenders" | "accessEntities" | "accessSuppliers" | "accessProjects" |
  "accessGuarantees" | "accessContracts" | "accessRfq" | "accessPo" | "accessTransportation" | "accessFinance" |
  "accessCorrespondence" | "accessResidency" | "accessMaintenance" | "accessResearch" | "accessPricing" | "accessTasks" | "accessOpportunities"
>): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === "admin") return true;
  return user[module] ?? false;
}
