import { useGetTenderStats, useListTenders } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  FileText, AlertCircle, Trophy, Banknote, Percent,
  Building2, Users, ClipboardList, ShoppingCart,
  FolderOpen, ShieldCheck, FileSignature, Calendar,
  ArrowLeftCircle, TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import { useAuth } from "@/contexts/auth";

/* ─── brand palette ─── */
const G  = "#D4A534";   // gold
const GL = "#E8BE55";   // gold light
const GD = "#A87C20";   // gold dark
const GR = "#0b1a10";   // green dark

/* ─── module shortcuts ─── */
const MODULES = [
  { href: "/tenders",        label: "سجل المناقصات",          icon: FileText,      accent: "#D4A534", bg: "#fdf8ec" },
  { href: "/entities",       label: "الجهات الحكومية",        icon: Building2,     accent: "#1a7a3a", bg: "#edf7f0" },
  { href: "/suppliers",      label: "الموردون",               icon: Users,         accent: "#2563eb", bg: "#eff6ff" },
  { href: "/projects",       label: "المشاريع",               icon: FolderOpen,    accent: "#7c3aed", bg: "#f5f3ff" },
  { href: "/guarantees",     label: "الكفالات البنكية",       icon: ShieldCheck,   accent: "#dc2626", bg: "#fff1f2" },
  { href: "/contracts",      label: "العقود",                 icon: FileSignature, accent: "#0891b2", bg: "#ecfeff" },
  { href: "/rfq",            label: "طلبات عروض الأسعار",    icon: ClipboardList, accent: "#d97706", bg: "#fffbeb" },
  { href: "/purchase-orders",label: "أوامر الشراء المباشر",  icon: ShoppingCart,  accent: "#16a34a", bg: "#f0fdf4" },
  { href: "/calendar",       label: "جدول الأعمال",           icon: Calendar,      accent: "#9333ea", bg: "#faf5ff" },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetTenderStats();
  const { data: recentTenders, isLoading: tendersLoading } = useListTenders({});
  const { user } = useAuth();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "صباح الخير";
    if (h < 17) return "مساء الخير";
    return "مساء النور";
  };

  const statCards = [
    {
      title: "إجمالي المناقصات",
      value: stats?.total ?? 0,
      icon: FileText,
      accent: G,
      bg: "#fdf8ec",
      sub: "مناقصة مسجّلة",
    },
    {
      title: "مناقصات عاجلة",
      value: stats?.urgentCount ?? 0,
      icon: AlertCircle,
      accent: "#dc2626",
      bg: "#fff1f2",
      sub: "تستحق المتابعة",
    },
    {
      title: "رست علينا",
      value: stats?.wonCount ?? 0,
      icon: Trophy,
      accent: "#16a34a",
      bg: "#f0fdf4",
      sub: "مناقصة ناجحة",
    },
    {
      title: "قيمة العروض",
      value: formatCurrency(stats?.totalOfferValue),
      icon: Banknote,
      accent: "#0891b2",
      bg: "#ecfeff",
      sub: "د.ك إجمالي",
    },
    {
      title: "نسبة النجاح",
      value: `${(stats?.winRate ?? 0).toFixed(1)}%`,
      icon: Percent,
      accent: "#7c3aed",
      bg: "#f5f3ff",
      sub: "معدل الفوز",
    },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif", display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${GR} 0%, #132a18 60%, #1e4028 100%)`,
        borderRadius: 20,
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 8px 32px rgba(11,26,16,0.35)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative ring */}
        <div style={{
          position: "absolute", left: -60, top: -60,
          width: 280, height: 280, borderRadius: "50%",
          border: `1px solid rgba(212,165,52,0.15)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: -20, top: -20,
          width: 180, height: 180, borderRadius: "50%",
          border: `1px solid rgba(212,165,52,0.1)`,
          pointerEvents: "none",
        }} />
        <div>
          <p style={{ color: `rgba(212,165,52,0.6)`, fontSize: 13, margin: 0, marginBottom: 4 }}>
            {greeting()} ،
          </p>
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 800, margin: 0 }}>
            {user?.fullName ?? "مرحباً"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "6px 0 0" }}>
            نظرة عامة على حالة المناقصات والأعمال الجارية
          </p>
        </div>
        <div style={{
          background: "rgba(212,165,52,0.15)",
          border: `1px solid rgba(212,165,52,0.3)`,
          borderRadius: 14, padding: "10px 20px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <TrendingUp size={18} color={GL} />
          <span style={{ color: GL, fontSize: 13, fontWeight: 700 }}>لوحة التحكم</span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {statsLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 110, background: "#f1f5f9", borderRadius: 16, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {statCards.map((s, i) => (
            <div key={i} style={{
              background: "white",
              border: `1.5px solid ${s.bg}`,
              borderRadius: 18,
              padding: "20px 22px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              transition: "transform 0.15s, box-shadow 0.15s",
              cursor: "default",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px rgba(0,0,0,0.10)`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 16px rgba(0,0,0,0.06)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{s.title}</span>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: s.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <s.icon size={18} color={s.accent} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.sub}</div>
              </div>
              {/* bottom accent bar */}
              <div style={{ height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${s.accent}, transparent)` }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Module Shortcuts ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#132a18", margin: 0 }}>الوحدات الرئيسية</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href}>
              <div style={{
                background: "white",
                border: `1.5px solid ${m.bg}`,
                borderRadius: 18,
                padding: "22px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                textDecoration: "none",
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateY(-4px)";
                  el.style.boxShadow = `0 12px 32px rgba(0,0,0,0.12)`;
                  el.style.borderColor = m.accent;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.05)";
                  el.style.borderColor = m.bg;
                }}
              >
                {/* Icon circle */}
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: m.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 4px 12px ${m.accent}22`,
                }}>
                  <m.icon size={26} color={m.accent} strokeWidth={1.8} />
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: "#1e2a1e", textAlign: "center", lineHeight: 1.4,
                }}>
                  {m.label}
                </span>
                {/* arrow */}
                <ArrowLeftCircle size={15} color={`${m.accent}88`} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Tenders ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 22, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#132a18", margin: 0 }}>أحدث المناقصات</h2>
          </div>
          <Link href="/tenders">
            <span style={{ fontSize: 13, color: G, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
              عرض الكل ←
            </span>
          </Link>
        </div>

        <div style={{
          background: "white",
          borderRadius: 18,
          border: "1.5px solid #f0ead8",
          boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}>
          {tendersLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>جارٍ التحميل...</div>
          ) : !recentTenders?.length ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              <FileText size={36} color="#e2d5b0" style={{ margin: "0 auto 12px" }} />
              <p style={{ margin: 0 }}>لا توجد مناقصات حالياً</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
                <thead>
                  <tr style={{ background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" }}>
                    {["رقم المناقصة", "المشروع", "الجهة", "آخر موعد", "الحالة"].map(h => (
                      <th key={h} style={{ padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTenders.slice(0, 7).map((tender, idx) => {
                    const urgent = isUrgent(tender.deadline, tender.status);
                    return (
                      <tr key={tender.id} style={{
                        borderBottom: idx < 6 ? "1px solid #f5f0e6" : "none",
                        background: "white",
                        transition: "background 0.1s",
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fffdf5"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}
                      >
                        <td style={{ padding: "13px 18px" }}>
                          <Link href={`/tenders/${tender.id}`}>
                            <span style={{ color: GD, fontWeight: 700, fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>
                              {tender.tenderNumber}
                            </span>
                          </Link>
                        </td>
                        <td style={{ padding: "13px 18px", fontWeight: 600, color: "#1e2a1e", maxWidth: 220 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tender.projectName}
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", color: "#6b7280", maxWidth: 160 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tender.governmentEntity || "—"}
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: urgent ? "#dc2626" : "#374151", fontWeight: urgent ? 700 : 400 }}>
                            {urgent && <AlertCircle size={13} />}
                            {formatDate(tender.deadline)}
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", whiteSpace: "nowrap" }}>
                          <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border", STATUS_COLORS[tender.status])}>
                            {STATUS_ARABIC[tender.status] || tender.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1 } 50% { opacity:0.4 }
        }
      `}</style>
    </div>
  );
}
