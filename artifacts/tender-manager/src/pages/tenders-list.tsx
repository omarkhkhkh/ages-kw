import { useState } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatDate, isUrgent, cn } from "@/lib/utils";
import { STATUS_ARABIC, STATUS_COLORS } from "@/lib/constants";
import {
  Search, Plus, Download, AlertCircle, FileText,
  Clock, CheckCircle2, XCircle, Loader2, Trophy,
  Eye, ChevronLeft, Building2, User2, Banknote,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { exportTendersToExcel } from "@/lib/export";
import { TenderStatus } from "@workspace/api-client-react";

/* ── brand ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

/* ── status tab config ── */
const TABS = [
  { id: "all",                              label: "الجميع",        icon: FileText,     color: "#64748b" },
  { id: "urgent",                           label: "عاجلة",         icon: AlertCircle,  color: "#dc2626" },
  { id: TenderStatus.studying,              label: "جاري الدراسة", icon: Loader2,       color: "#2563eb" },
  { id: TenderStatus.preparing_technical,   label: "إعداد العروض", icon: Clock,         color: "#d97706" },
  { id: TenderStatus.under_evaluation,      label: "تحت التقييم",  icon: CheckCircle2, color: "#7c3aed" },
  { id: "won",                              label: "رست علينا",     icon: Trophy,       color: "#16a34a" },
];

export default function TendersList() {
  const { user } = useAuth();
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const queryParams: any = {};
  if (search)   queryParams.search = search;
  if (activeTab === "urgent") queryParams.urgent = true;
  if (activeTab === "won")    queryParams.won    = true;
  if (activeTab !== "all" && activeTab !== "urgent" && activeTab !== "won")
    queryParams.status = activeTab;

  const { data: tenders, isLoading } = useListTenders(queryParams);

  const activeTabCfg = TABS.find(t => t.id === activeTab)!;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>سجل المناقصات</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
            {isLoading ? "جارٍ التحميل..." : `${tenders?.length ?? 0} مناقصة مسجّلة`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(user?.role === "admin" || user?.canDownload) && (
            <button
              onClick={() => exportTendersToExcel(tenders ?? [])}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "white", border: "1.5px solid #e5e7eb", color: "#374151",
                fontFamily: "inherit", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = G)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
            >
              <Download size={15} /> تصدير Excel
            </button>
          )}
          {(user?.role === "admin" || user?.canEdit) && (
            <Link href="/tenders/new">
              <button style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white",
                fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)`,
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 20px rgba(212,165,52,0.5)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 14px rgba(212,165,52,0.4)`; }}
              >
                <Plus size={15} /> مناقصة جديدة
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        background: "white", borderRadius: 16, border: "1.5px solid #f0ead8",
        padding: "14px 16px", display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "space-between", gap: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(tab => {
            const active = tab.id === activeTab;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  border: active ? `1.5px solid ${tab.color}22` : "1.5px solid transparent",
                  background: active ? `${tab.color}12` : "transparent",
                  color: active ? tab.color : "#6b7280",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Search */}
        <div style={{ position: "relative", minWidth: 240 }}>
          <Search size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            placeholder="بحث برقم المناقصة أو المشروع..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 36px 8px 12px", borderRadius: 10,
              border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151",
              background: "#f9fafb", outline: "none", fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = G; e.target.style.background = "white"; }}
            onBlur={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
          />
        </div>
      </div>

      {/* ── Table card ── */}
      <div style={{
        background: "white", borderRadius: 18,
        border: "1.5px solid #f0ead8",
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}>
        {/* Table header bar */}
        <div style={{
          padding: "12px 20px",
          background: "#fdf8ec",
          borderBottom: "1.5px solid #f0ead8",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <activeTabCfg.icon size={15} color={activeTabCfg.color} />
          <span style={{ fontSize: 13, fontWeight: 700, color: GR }}>{activeTabCfg.label}</span>
          {!isLoading && (
            <span style={{
              marginRight: "auto", fontSize: 11, fontWeight: 700,
              background: `${activeTabCfg.color}15`, color: activeTabCfg.color,
              border: `1px solid ${activeTabCfg.color}25`,
              borderRadius: 20, padding: "2px 10px",
            }}>
              {tenders?.length ?? 0}
            </span>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
            <thead>
              <tr style={{ background: "#fafaf8" }}>
                {[
                  { label: "رقم المناقصة", icon: FileText },
                  { label: "المشروع / الجهة", icon: Building2 },
                  { label: "المهندس المسؤول", icon: User2 },
                  { label: "الحالة", icon: null },
                  { label: "آخر موعد", icon: Clock },
                  { label: "قيمة العرض", icon: Banknote },
                  { label: "", icon: null },
                ].map((h, i) => (
                  <th key={i} style={{
                    padding: "12px 16px", fontWeight: 700, fontSize: 11,
                    color: "#6b7280", borderBottom: "1.5px solid #f0ead8",
                    whiteSpace: "nowrap",
                    textAlign: i === 5 ? "left" : "right",
                  }}>
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
                  <td colSpan={7} style={{ padding: "56px 0", textAlign: "center" }}>
                    <FileText size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
                    <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 4px", fontWeight: 600 }}>لا توجد مناقصات</p>
                    <p style={{ color: "#cbd5e1", fontSize: 12, margin: 0 }}>لم يتم العثور على مناقصات تطابق معايير البحث</p>
                  </td>
                </tr>
              ) : (
                tenders.map((tender, idx) => {
                  const urgent = isUrgent(tender.deadline, tender.status);
                  return (
                    <tr key={tender.id}
                      style={{ borderBottom: idx < tenders.length - 1 ? "1px solid #f5f0e6" : "none", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fffdf5"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "white"}
                    >
                      {/* Tender number */}
                      <td style={{ padding: "14px 16px" }}>
                        <Link href={`/tenders/${tender.id}`}>
                          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: GD, cursor: "pointer" }}>
                            {tender.tenderNumber}
                          </span>
                        </Link>
                      </td>
                      {/* Project / Entity */}
                      <td style={{ padding: "14px 16px", maxWidth: 240 }}>
                        <div style={{ fontWeight: 700, color: "#1e2a1e", fontSize: 13, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tender.projectName}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tender.governmentEntity || "—"}
                        </div>
                      </td>
                      {/* Engineer */}
                      <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: 12 }}>
                        {tender.responsibleEngineer || "—"}
                      </td>
                      {/* Status badge */}
                      <td style={{ padding: "14px 16px" }}>
                        <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border inline-flex items-center gap-1", STATUS_COLORS[tender.status])}>
                          {STATUS_ARABIC[tender.status] || tender.status}
                        </span>
                      </td>
                      {/* Deadline */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {urgent ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            background: "#fff1f2", color: "#dc2626",
                            border: "1px solid #fecaca",
                            borderRadius: 8, padding: "4px 10px",
                            fontSize: 11, fontWeight: 700,
                          }}>
                            <AlertCircle size={12} /> {formatDate(tender.deadline)}
                          </span>
                        ) : (
                          <span style={{ color: "#6b7280", fontSize: 12 }}>{formatDate(tender.deadline)}</span>
                        )}
                      </td>
                      {/* Value */}
                      <td style={{ padding: "14px 16px", textAlign: "left", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#374151" }}>
                        {formatCurrency(tender.offerValue)}
                      </td>
                      {/* Action */}
                      <td style={{ padding: "14px 16px" }}>
                        <Link href={`/tenders/${tender.id}`}>
                          <button style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                            background: `${G}12`, color: GD,
                            border: `1px solid ${G}25`,
                            cursor: "pointer", fontFamily: "inherit",
                            transition: "background 0.1s",
                          }}
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

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
