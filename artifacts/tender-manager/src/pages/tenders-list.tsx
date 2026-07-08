import { useState, useRef, useEffect } from "react";
import {
  useListTenders, useGetTenderStats, useUpdateTender,
  getListTendersQueryKey, getGetTenderStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import {
  Search, Plus, Download, AlertCircle, FileText,
  Clock, CheckCircle2, Loader2, Trophy, Eye,
  Building2, User2, Banknote, LayoutGrid, ChevronDown, UserCog,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportTendersToExcel } from "@/lib/export";
import { TenderStatus, TenderUpdateStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

/* ═══════════════════════════════════════════════════
   Inline status dropdown — appears when clicking the
   status badge in the tenders table (canEdit only)
   ═══════════════════════════════════════════════════ */
const ALL_STATUSES = [
  TenderStatus.new,
  TenderStatus.studying,
  TenderStatus.requesting_quotes,
  TenderStatus.preparing_technical,
  TenderStatus.preparing_financial,
  TenderStatus.management_review,
  TenderStatus.ready_to_submit,
  TenderStatus.submitted,
  TenderStatus.under_evaluation,
  TenderStatus.won,
  TenderStatus.lost,
  TenderStatus.cancelled,
];

/* colour map from Tailwind classes → raw hex for the dropdown */
const STATUS_HEX: Record<string, { color: string; bg: string; border: string }> = {
  [TenderStatus.new]:                { color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  [TenderStatus.studying]:           { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  [TenderStatus.requesting_quotes]:  { color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
  [TenderStatus.preparing_technical]:{ color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  [TenderStatus.preparing_financial]:{ color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
  [TenderStatus.management_review]:  { color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  [TenderStatus.ready_to_submit]:    { color: "#a16207", bg: "#fefce8", border: "#fef08a" },
  [TenderStatus.submitted]:          { color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  [TenderStatus.under_evaluation]:   { color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  [TenderStatus.won]:                { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  [TenderStatus.lost]:               { color: "#b91c1c", bg: "#fff1f2", border: "#fecaca" },
  [TenderStatus.cancelled]:          { color: "#525252", bg: "#f5f5f5", border: "#e5e5e5" },
};

/* ═══════════════════════════════════════════════════
   Engineer picker — admin only, inline in table row
   ═══════════════════════════════════════════════════ */
function EngineerDropdown({ tenderId, currentEngineer }: { tenderId: number; currentEngineer: string | null }) {
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const qc                = useQueryClient();
  const updateTender      = useUpdateTender();
  const { toast }         = useToast();

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users", { credentials: "include" }).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handleSelect = async (fullName: string) => {
    if (busy || fullName === currentEngineer) { setOpen(false); return; }
    setOpen(false);
    setBusy(true);
    try {
      await updateTender.mutateAsync({ id: tenderId, data: { responsibleEngineer: fullName } as any });
      qc.invalidateQueries({ queryKey: getListTendersQueryKey() });
      toast({ title: "✅ تم تغيير المسؤول", description: fullName });
    } catch (err: any) {
      toast({ title: "فشل تغيير المسؤول", description: err?.message ?? "حاول مجدداً.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#374151" }}>{currentEngineer || "—"}</span>
      <button onClick={() => !busy && setOpen(o => !o)} title="تغيير المسؤول"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, border: "1.5px solid #e5e7eb", background: "white", cursor: busy ? "wait" : "pointer", color: "#6b7280", padding: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#D4A534"; (e.currentTarget as HTMLButtonElement).style.color = "#D4A534"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}>
        {busy ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <UserCog size={11} />}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999, background: "white", borderRadius: 12, border: "1.5px solid #e5e7eb", boxShadow: "0 8px 32px rgba(0,0,0,0.13)", padding: 6, minWidth: 180, display: "flex", flexDirection: "column", gap: 2 }}>
          {(users as any[]).filter((u: any) => u.isActive !== false).map((u: any) => {
            const active = u.fullName === currentEngineer;
            return (
              <button key={u.id} onClick={() => handleSelect(u.fullName)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: active ? "#fdf8ec" : "transparent", color: active ? "#A87C20" : "#374151", fontFamily: "inherit", fontSize: 12, fontWeight: active ? 700 : 500, textAlign: "right", transition: "background 0.1s" }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: active ? "#D4A53420" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User2 size={12} color={active ? "#A87C20" : "#9ca3af"} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: active ? 700 : 600 }}>{u.fullName}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{u.role === "admin" ? "مدير" : "موظف"}</div>
                </div>
                {active && <span style={{ marginRight: "auto", color: "#D4A534" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Status dropdown
   ═══════════════════════════════════════════════════ */
function StatusDropdown({ tenderId, currentStatus }: { tenderId: number; currentStatus: TenderStatus }) {
  const [open, setOpen]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);
  const qc                  = useQueryClient();
  const updateTender        = useUpdateTender();
  const { toast }           = useToast();

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (status: TenderStatus) => {
    if (busy || status === currentStatus) { setOpen(false); return; }   // in-flight guard
    setOpen(false);
    setBusy(true);
    try {
      await updateTender.mutateAsync({ id: tenderId, data: { status: status as TenderUpdateStatus } });
      qc.invalidateQueries({ queryKey: getListTendersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTenderStatsQueryKey() });
      toast({ title: "✅ تم تحديث الحالة", description: `${STATUS_ARABIC[currentStatus]} ← ${STATUS_ARABIC[status]}` });
    } catch (err: any) {
      const detail = err?.message || err?.response?.data?.error;
      toast({ title: "فشل تحديث الحالة", description: detail ?? "حاول مجدداً.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const style = STATUS_HEX[currentStatus] ?? STATUS_HEX[TenderStatus.new];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => !busy && setOpen(o => !o)}
        title="تغيير الحالة"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px 4px 8px", borderRadius: 20, cursor: busy ? "wait" : "pointer",
          fontSize: 11, fontWeight: 700, fontFamily: "inherit",
          background: style.bg, color: style.color,
          border: `1.5px solid ${open ? style.color : style.border}`,
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxShadow: open ? `0 0 0 3px ${style.color}22` : "none",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { if (!busy) (e.currentTarget.style.borderColor = style.color); }}
        onMouseLeave={e => { if (!open) (e.currentTarget.style.borderColor = style.border); }}
      >
        {busy
          ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
          : <span style={{ width: 6, height: 6, borderRadius: "50%", background: style.color, flexShrink: 0 }} />
        }
        {STATUS_ARABIC[currentStatus] || currentStatus}
        {!busy && <ChevronDown size={10} style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }} />}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999,
          background: "white", borderRadius: 12, border: "1.5px solid #e5e7eb",
          boxShadow: "0 8px 32px rgba(0,0,0,0.13)", padding: 6, minWidth: 200,
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {ALL_STATUSES.map(s => {
            const st = STATUS_HEX[s] ?? STATUS_HEX[TenderStatus.new];
            const active = s === currentStatus;
            return (
              <button key={s} onClick={() => handleSelect(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? st.bg : "transparent",
                  color: active ? st.color : "#374151",
                  fontFamily: "inherit", fontSize: 12, fontWeight: active ? 700 : 500,
                  textAlign: "right",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget.style.background = "#f9fafb"); }}
                onMouseLeave={e => { if (!active) (e.currentTarget.style.background = "transparent"); }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                {STATUS_ARABIC[s] || s}
                {active && <span style={{ marginRight: "auto", fontSize: 14 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const STAT_CARDS = [
  { id: "all",                            label: "إجمالي المناقصات", icon: LayoutGrid,   color: "#64748b", bg: "#f8fafc" },
  { id: "urgent",                         label: "عاجلة",             icon: AlertCircle,  color: "#dc2626", bg: "#fff1f2" },
  { id: TenderStatus.studying,            label: "جاري الدراسة",     icon: Loader2,      color: "#2563eb", bg: "#eff6ff" },
  { id: TenderStatus.preparing_technical, label: "إعداد العروض",     icon: Clock,        color: "#d97706", bg: "#fffbeb" },
  { id: TenderStatus.under_evaluation,    label: "تحت التقييم",      icon: CheckCircle2, color: "#7c3aed", bg: "#f5f3ff" },
  { id: "won",                            label: "رست علينا",         icon: Trophy,       color: "#16a34a", bg: "#f0fdf4" },
];

export default function TendersList() {
  const { user } = useAuth();
  const [search,    setSearch]    = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: stats } = useGetTenderStats();

  /* counts per card */
  const getCount = (id: string) => {
    if (!stats) return null;
    if (id === "all")    return stats.total;
    if (id === "urgent") return stats.urgentCount;
    if (id === "won")    return stats.wonCount;
    return stats.byStatus.find(s => s.status === id)?.count ?? 0;
  };

  const queryParams: any = {};
  if (search)   queryParams.search = search;
  if (activeTab === "urgent") queryParams.urgent = true;
  if (activeTab === "won")    queryParams.won    = true;
  if (activeTab !== "all" && activeTab !== "urgent" && activeTab !== "won")
    queryParams.status = activeTab;

  const { data: tenders, isLoading } = useListTenders(queryParams);
  const activeCard = STAT_CARDS.find(c => c.id === activeTab)!;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Page title + action buttons ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>سجل المناقصات</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>
            اختر تصنيفاً أدناه لعرض المناقصات
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(user?.role === "admin" || user?.canDownload) && (
            <button onClick={() => exportTendersToExcel(tenders ?? [])}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "white", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit", transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = G)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
            >
              <Download size={15} /> تصدير Excel
            </button>
          )}
          {(user?.role === "admin" || user?.canEdit) && (
            <Link href="/tenders/new">
              <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)`, transition: "transform 0.1s,box-shadow 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 22px rgba(212,165,52,0.5)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 14px rgba(212,165,52,0.4)`; }}
              >
                <Plus size={15} /> مناقصة جديدة
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Square stat/filter cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
        {STAT_CARDS.map(card => {
          const active  = activeTab === card.id;
          const count   = getCount(card.id);
          return (
            <button key={card.id} onClick={() => setActiveTab(card.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                gap: 14, padding: "18px 18px 16px",
                borderRadius: 18, cursor: "pointer", fontFamily: "inherit",
                textAlign: "right",
                background: active ? card.bg : "white",
                border: active ? `2px solid ${card.color}40` : "1.5px solid #f0ead8",
                boxShadow: active
                  ? `0 6px 24px ${card.color}22, 0 0 0 1px ${card.color}18`
                  : "0 2px 10px rgba(0,0,0,0.04)",
                transform: active ? "translateY(-2px)" : "translateY(0)",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.09)`; e.currentTarget.style.borderColor = `${card.color}30`; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#f0ead8"; } }}
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: active ? `${card.color}18` : `${card.color}0f`,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${card.color}${active ? "30" : "18"}`,
                transition: "all 0.18s",
              }}>
                <card.icon size={20} color={card.color} strokeWidth={1.8} />
              </div>

              {/* Count */}
              <div style={{ width: "100%" }}>
                <div style={{
                  fontSize: 28, fontWeight: 900, lineHeight: 1,
                  color: active ? card.color : "#1e293b",
                  transition: "color 0.18s",
                }}>
                  {count ?? "—"}
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 600, marginTop: 4,
                  color: active ? card.color : "#6b7280",
                  transition: "color 0.18s",
                }}>
                  {card.label}
                </div>
              </div>

              {/* Active indicator */}
              {active && (
                <div style={{
                  position: "absolute",
                  bottom: 0, right: 0, left: 0,
                  height: 3, borderRadius: "0 0 18px 18px",
                  background: `linear-gradient(90deg, ${card.color}40, ${card.color}, ${card.color}40)`,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search bar ── */}
      <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            placeholder="بحث برقم المناقصة أو اسم المشروع..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 36px 9px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", background: "#fafaf8", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s" }}
            onFocus={e => { e.target.style.borderColor = G; e.target.style.background = "white"; e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.12)`; }}
            onBlur={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#fafaf8"; e.target.style.boxShadow = "none"; }}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", background: "#fdf8ec", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", gap: 8 }}>
          <activeCard.icon size={15} color={activeCard.color} />
          <span style={{ fontSize: 13, fontWeight: 700, color: GR }}>{activeCard.label}</span>
          {!isLoading && (
            <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 700, background: `${activeCard.color}15`, color: activeCard.color, border: `1px solid ${activeCard.color}25`, borderRadius: 20, padding: "2px 10px" }}>
              {tenders?.length ?? 0}
            </span>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
            <thead>
              <tr style={{ background: "#fafaf8" }}>
                {[
                  { label: "رقم المناقصة",     icon: FileText   },
                  { label: "المشروع / الجهة",  icon: Building2  },
                  { label: "المهندس المسؤول",  icon: User2      },
                  { label: "الحالة",            icon: null       },
                  { label: "آخر موعد",          icon: Clock      },
                  { label: "قيمة العرض",       icon: Banknote   },
                  { label: "",                  icon: null       },
                ].map((h, i) => (
                  <th key={i} style={{ padding: "12px 16px", fontWeight: 700, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {h.icon && <h.icon size={12} color="#9ca3af" />}
                      {h.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} style={{ padding: "16px" }}>
                        <div style={{ height: 14, background: "#f1f5f9", borderRadius: 6, width: j === 1 ? 160 : 80, animation: "pulse 1.5s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !tenders?.length ? (
                <tr>
                  <td colSpan={7} style={{ padding: "64px 0", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 72, height: 72, borderRadius: 20, background: "#fdf8ec", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileText size={30} color="#e2d5b0" />
                      </div>
                      <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, fontWeight: 600 }}>لا توجد مناقصات</p>
                      <p style={{ color: "#cbd5e1", fontSize: 12, margin: 0 }}>لم يتم العثور على مناقصات تطابق معايير البحث</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tenders.map((tender, idx) => {
                  const urgent = isUrgent(tender.deadline, tender.status);
                  return (
                    <tr key={tender.id}
                      style={{ borderBottom: idx < tenders.length - 1 ? "1px solid #f5f0e6" : "none", transition: "background 0.1s", position: "relative" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fffdf5"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <Link href={`/tenders/${tender.id}`}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: GD, cursor: "pointer" }}>
                            {tender.tenderNumber}
                          </span>
                        </Link>
                      </td>
                      <td style={{ padding: "14px 16px", maxWidth: 240 }}>
                        <div style={{ fontWeight: 700, color: "#1e2a1e", fontSize: 13, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tender.projectName}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tender.governmentEntity || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>
                        {user?.role === "admin"
                          ? <EngineerDropdown tenderId={tender.id} currentEngineer={tender.responsibleEngineer ?? null} />
                          : <span>{tender.responsibleEngineer || "—"}</span>
                        }
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {(user?.role === "admin" || user?.fullName === tender.responsibleEngineer)
                          ? <StatusDropdown tenderId={tender.id} currentStatus={tender.status as TenderStatus} />
                          : <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border inline-flex items-center gap-1", STATUS_COLORS[tender.status])}>
                              {STATUS_ARABIC[tender.status] || tender.status}
                            </span>
                        }
                      </td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {urgent ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
                            <AlertCircle size={12} /> {formatDate(tender.deadline)}
                          </span>
                        ) : (
                          <span style={{ color: "#6b7280", fontSize: 12 }}>{formatDate(tender.deadline)}</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "left", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#374151" }}>
                        {formatCurrency(tender.offerValue)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <Link href={`/tenders/${tender.id}`}>
                          <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${G}12`, color: GD, border: `1px solid ${G}25`, cursor: "pointer", fontFamily: "inherit", transition: "background 0.1s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = `${G}22`)}
                            onMouseLeave={e => (e.currentTarget.style.background = `${G}12`)}
                          >
                            <Eye size={12} /> عرض
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        button { position: relative; }
      `}</style>
    </div>
  );
}
