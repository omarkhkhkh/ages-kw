import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

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

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  };

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
  "accessGuarantees" | "accessContracts" | "accessRfq" | "accessPo"
>): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === "admin") return true;
  return user[module] ?? false;
}
