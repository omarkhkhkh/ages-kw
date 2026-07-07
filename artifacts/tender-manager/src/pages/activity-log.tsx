import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";
import { formatKuwaitDateTime } from "@/lib/timezone";
import {
  Activity, LogIn, LogOut, Plus, Pencil, Trash2,
  Download, Filter, Users, ChevronRight, ChevronLeft,
  Search, Clock, Shield, AlertTriangle,
} from "lucide-react";

/* ─── Brand palette ─── */
const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";
const GR = "#0b1a10";

/* ─── Action meta ─── */
const ACTION_META: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  login:        { label: "دخول",          color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: LogIn     },
  logout:       { label: "خروج",          color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", icon: LogOut    },
  create:       { label: "إضافة",         color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: Plus      },
  update:       { label: "تعديل",         color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: Pencil    },
  delete:       { label: "حذف",           color: "#dc2626", bg: "#fff1f2", border: "#fecaca", icon: Trash2    },
  export:       { label: "تصدير",         color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", icon: Download  },
  access_denied:{ label: "وصول مرفوض",   color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", icon: AlertTriangle },
};

/* ─── Module labels ─── */
const MODULE_LABELS: Record<string, string> = {
  tenders:   "المناقصات",
  entities:  "الجهات الحكومية",
  suppliers: "الموردون",
  projects:  "المشاريع",
  guarantees:"الكفالات البنكية",
  contracts: "العقود",
  rfq:       "طلبات عروض",
  po:        "أوامر الشراء",
  users:     "المستخدمون",
  auth:      "تسجيل الدخول",
  tasks:     "المهام",
  finance:   "المالية",
};

/* ─── Avatar colors ─── */
const AVATAR_COLORS = [
  { bg: "#fdf2e9", color: "#e67e22" },
  { bg: "#eaf4fb", color: "#2980b9" },
  { bg: "#eafaf1", color: "#27ae60" },
  { bg: "#f4ecf7", color: "#8e44ad" },
  { bg: "#fdedec", color: "#e74c3c" },
  { bg: "#fef9e7", color: "#d4ac0d" },
];
function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

/* ─── Types ─── */
interface LogRow {
  id: number; userId: number; username: string; fullName: string;
  action: string; module: string | null; resourceId: number | null;
  details: string | null; ipAddress: string | null; createdAt: string;
}
interface UserOption { id: number; fullName: string; username: string; }

/* ─── Helpers ─── */
const DATE_PERIODS = [
  { value: "today", label: "اليوم" },
  { value: "week",  label: "أسبوع" },
  { value: "month", label: "شهر" },
  { value: "all",   label: "الكل" },
];

function getDateRange(p: string): { from?: string; to?: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (p === "today") return { from: today.toISOString() };
  if (p === "week")  { const d = new Date(today); d.setDate(d.getDate() - 7); return { from: d.toISOString() }; }
  if (p === "month") { const d = new Date(today); d.setDate(d.getDate() - 30); return { from: d.toISOString() }; }
  return {};
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const yest   = new Date(today); yest.setDate(yest.getDate() - 1);
  const logDay = new Date(d); logDay.setHours(0, 0, 0, 0);
  if (logDay.getTime() === today.getTime()) return "اليوم";
  if (logDay.getTime() === yest.getTime())  return "أمس";
  return d.toLocaleDateString("ar-KW", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function dayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const PAGE_SIZE = 50;

/* ════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════ */
export default function ActivityLog() {
  const { user: me } = useAuth();
  const [location] = useLocation();

  const defaultUserId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("userId") ?? "";
  }, []);

  const [filterUserId, setFilterUserId] = useState(defaultUserId);
  const [filterAction, setFilterAction] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("week");
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(0);

  /* Sync userId from URL on navigation */
  useEffect(() => {
    const uid = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("userId") ?? "";
    setFilterUserId(uid);
  }, [location]);

  useEffect(() => { setPage(0); }, [filterUserId, filterAction, filterModule, filterPeriod, search]);

  /* ── Queries ── */
  const { from, to } = getDateRange(filterPeriod);
  const qs = new URLSearchParams();
  if (filterUserId) qs.set("userId", filterUserId);
  if (filterAction) qs.set("action", filterAction);
  if (filterModule) qs.set("module", filterModule);
  if (from) qs.set("from", from);
  if (to)   qs.set("to",   to);
  if (search) qs.set("search", search);
  qs.set("limit",  String(PAGE_SIZE));
  qs.set("offset", String(page * PAGE_SIZE));

  const { data: logsData, isLoading } = useQuery<{ logs: LogRow[]; total: number }>({
    queryKey: ["activity-logs", filterUserId, filterAction, filterModule, filterPeriod, search, page],
    queryFn: () => apiFetch(`/api/admin/activity-logs?${qs.toString()}`),
    placeholderData: prev => prev,
  });

  const { data: usersData = [] } = useQuery<UserOption[]>({
    queryKey: ["activity-log-users"],
    queryFn: () => apiFetch("/api/admin/activity-logs/users"),
  });

  const logs       = logsData?.logs ?? [];
  const total      = logsData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  /* ── Stat summaries (from current page) ── */
  const stats = useMemo(() => {
    const s: Record<string, number> = { login: 0, logout: 0, create: 0, update: 0, delete: 0, export: 0, access_denied: 0 };
    logs.forEach(l => { if (l.action in s) s[l.action]++; });
    return s;
  }, [logs]);

  /* ── Group logs by date ── */
  const grouped = useMemo(() => {
    const map = new Map<string, LogRow[]>();
    logs.forEach(l => {
      const k = dayKey(l.createdAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    });
    return Array.from(map.entries());
  }, [logs]);

  const selectedUser = usersData.find(u => String(u.id) === filterUserId);

  /* ─── Guard ─── */
  if (me?.role !== "admin") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 12, fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif" }}>
        <Shield size={44} color="#e2d5b0" />
        <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>ليس لديك صلاحية الوصول</p>
      </div>
    );
  }

  /* ─── Render ─── */
  const inp: React.CSSProperties = { padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, background: "white", fontFamily: "inherit", color: "#132a18", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg,${GR} 0%,#132a18 60%,#1e4028 100%)`,
        borderRadius: 20, padding: "24px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 8px 32px rgba(11,26,16,0.3)", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: -50, top: -50, width: 240, height: 240, borderRadius: "50%", border: "1px solid rgba(212,165,52,0.12)", pointerEvents: "none" }} />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(212,165,52,0.18)", border: "1px solid rgba(212,165,52,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={22} color={G} />
            </div>
            <h1 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0 }}>سجل حركات الموظفين</h1>
          </div>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
            {selectedUser
              ? `عرض حركات: ${selectedUser.fullName} (@${selectedUser.username})`
              : "تتبّع وتدقيق جميع العمليات التي يُنفّذها الموظفون داخل النظام"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, textAlign: "center" }}>
          {[
            { n: total, label: "إجمالي السجلات", color: GL },
            { n: stats.create + stats.update, label: "إضافة / تعديل", color: "#93c5fd" },
            { n: stats.delete, label: "حذف", color: "#fca5a5" },
            { n: stats.login, label: "دخول", color: "#86efac" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.n}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, whiteSpace: "nowrap" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        {/* Period pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <Clock size={14} color="#9ca3af" />
            <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>الفترة:</span>
          </div>
          {DATE_PERIODS.map(p => (
            <button key={p.value} onClick={() => setFilterPeriod(p.value)}
              style={{ padding: "5px 16px", borderRadius: 20, border: `1.5px solid ${filterPeriod === p.value ? G : "#e5e7eb"}`, background: filterPeriod === p.value ? `${G}15` : "white", color: filterPeriod === p.value ? GD : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Filter controls */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث في الاسم أو التفاصيل..."
              style={{ ...inp, paddingRight: 38 }} />
            <Search size={14} color="#9ca3af" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
          {/* Employee */}
          <div>
            <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} style={inp}>
              <option value="">جميع الموظفين</option>
              {usersData.map(u => <option key={u.id} value={String(u.id)}>{u.fullName}</option>)}
            </select>
          </div>
          {/* Action */}
          <div>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={inp}>
              <option value="">جميع الإجراءات</option>
              {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          {/* Module */}
          <div>
            <select value={filterModule} onChange={e => setFilterModule(e.target.value)} style={inp}>
              <option value="">جميع الوحدات</option>
              {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Active filters strip */}
        {(filterUserId || filterAction || filterModule || search) && (
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>فعّال:</span>
            {selectedUser && <FilterPill label={`موظف: ${selectedUser.fullName}`} onRemove={() => setFilterUserId("")} />}
            {filterAction && <FilterPill label={`إجراء: ${ACTION_META[filterAction]?.label}`} onRemove={() => setFilterAction("")} />}
            {filterModule && <FilterPill label={`وحدة: ${MODULE_LABELS[filterModule] ?? filterModule}`} onRemove={() => setFilterModule("")} />}
            {search && <FilterPill label={`بحث: ${search}`} onRemove={() => setSearch("")} />}
            <button onClick={() => { setFilterUserId(""); setFilterAction(""); setFilterModule(""); setSearch(""); }}
              style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginRight: 4 }}>
              مسح الكل ×
            </button>
          </div>
        )}
      </div>

      {/* ── Results count ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#132a18" }}>
            {isLoading ? "جارٍ التحميل..." : `${total.toLocaleString("ar-KW")} سجل`}
          </span>
        </div>
        {totalPages > 1 && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>صفحة {page + 1} من {totalPages}</span>
        )}
      </div>

      {/* ── Timeline ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {isLoading ? (
          <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 32 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f1f5f9", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, background: "#f1f5f9", borderRadius: 6, marginBottom: 8, width: "40%" }} />
                  <div style={{ height: 11, background: "#f8fafc", borderRadius: 6, width: "70%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "64px 24px", textAlign: "center" }}>
            <Activity size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>لا توجد سجلات</p>
            <p style={{ color: "#d1d5db", fontSize: 12, margin: 0 }}>جرّب تغيير الفترة الزمنية أو الفلاتر</p>
          </div>
        ) : (
          grouped.map(([dk, dayLogs], gi) => (
            <div key={dk} style={{ marginBottom: 20 }}>
              {/* Date heading */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: GD, background: `${G}12`, border: `1px solid ${G}30`, padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  {dayLabel(dayLogs[0].createdAt)}
                </div>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${G}22,transparent)` }} />
                <span style={{ fontSize: 11, color: "#d1d5db" }}>{dayLogs.length} حركة</span>
              </div>

              {/* Entries */}
              <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                {dayLogs.map((log, li) => {
                  const meta = ACTION_META[log.action] ?? ACTION_META.update;
                  const Icon = meta.icon;
                  const av   = avatarColor(log.fullName);
                  const mod  = log.module ? (MODULE_LABELS[log.module] ?? log.module) : null;
                  const time = new Date(log.createdAt).toLocaleTimeString("ar-KW", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={log.id} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 20px",
                      borderBottom: li < dayLogs.length - 1 ? "1px solid #f5f0e6" : "none",
                      borderRight: `3px solid ${meta.color}`,
                      transition: "background 0.1s",
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fafaf8"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}>

                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: av.bg, border: `2px solid ${av.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: av.color, flexShrink: 0 }}>
                        {log.fullName.charAt(0)}
                      </div>

                      {/* Employee name */}
                      <div style={{ minWidth: 130, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#132a18" }}>{log.fullName}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>@{log.username}</div>
                      </div>

                      {/* Action badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, background: meta.bg, border: `1px solid ${meta.border}`, flexShrink: 0 }}>
                        <Icon size={12} color={meta.color} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>
                      </div>

                      {/* Module */}
                      {mod && (
                        <div style={{ padding: "3px 10px", borderRadius: 8, background: "#f1f5f9", flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{mod}</span>
                          {log.resourceId && <span style={{ fontSize: 10, color: "#94a3b8" }}> #{log.resourceId}</span>}
                        </div>
                      )}

                      {/* Details */}
                      {log.details && (
                        <span style={{ fontSize: 12, color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.details}
                        </span>
                      )}

                      <div style={{ marginRight: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                        {/* Time */}
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{time}</span>
                        {/* IP */}
                        {log.ipAddress && log.ipAddress !== "::1" && log.ipAddress !== "127.0.0.1" && (
                          <span style={{ fontSize: 10, color: "#d1d5db", direction: "ltr" }}>{log.ipAddress}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <PagBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronRight size={15} />
          </PagBtn>

          {(() => {
            const pages: (number | "…")[] = [];
            const w = 2;
            for (let i = 0; i < totalPages; i++) {
              if (i < w || i >= totalPages - w || Math.abs(i - page) <= w) pages.push(i);
              else if (pages[pages.length - 1] !== "…") pages.push("…");
            }
            return pages.map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} style={{ color: "#9ca3af", fontSize: 13, padding: "0 4px" }}>…</span>
              ) : (
                <PagBtn key={p} active={p === page} onClick={() => setPage(p as number)}>
                  {(p as number) + 1}
                </PagBtn>
              )
            );
          })()}

          <PagBtn disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronLeft size={15} />
          </PagBtn>
        </div>
      )}

    </div>
  );
}

/* ── Sub-components ── */
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
      <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{label}</span>
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, lineHeight: 1, fontSize: 14, fontFamily: "inherit" }}>×</button>
    </div>
  );
}

function PagBtn({ children, disabled, active, onClick }: { children: React.ReactNode; disabled?: boolean; active?: boolean; onClick: () => void }) {
  const G  = "#D4A534";
  const GD = "#A87C20";
  return (
    <button disabled={disabled} onClick={onClick}
      style={{ minWidth: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1.5px solid ${active ? G : "#e5e7eb"}`, background: active ? `linear-gradient(135deg,${G},${GD})` : disabled ? "#f9fafb" : "white", color: active ? "white" : disabled ? "#d1d5db" : "#374151", fontWeight: active ? 800 : 600, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.12s", padding: "0 6px" }}>
      {children}
    </button>
  );
}
