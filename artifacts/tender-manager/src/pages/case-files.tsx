import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { caseFilesApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { FolderOpen, ShieldAlert } from "lucide-react";
import { StatusChip } from "@/components/case-file-panel";

/* ═══ الملفات والاعتمادات — للمطّلعين الثلاثة (العام/التنفيذي/المالي) ═══ */

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const card: CSSProperties = { background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 0, marginBottom: 16, overflowX: "auto" };
const th: CSSProperties = { padding: "9px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", textAlign: "right", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f5f0e6" };
const fmtDT = (d: any) => (d ? new Date(d).toLocaleString("ar-KW", { dateStyle: "short", timeStyle: "short" }) : "—");

const FILTERS = ["الكل", "بانتظار الاعتماد", "موقوف ماليًا", "قيد العمل", "معتمد", "مرفوض"] as const;

export default function CaseFilesPage() {
  const { user } = useAuth();
  const positions = user?.positions ?? [];
  const canSee = user?.role === "admin" || positions.includes("executive_manager") || positions.includes("financial_manager") || positions.includes("general_manager");
  const [filter, setFilter] = useState<string>("الكل");

  const { data: files = [] } = useQuery<any[]>({
    queryKey: ["case-files", filter],
    queryFn: () => caseFilesApi.list(filter === "الكل" ? undefined : filter),
    enabled: canSee,
  });

  if (!canSee) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>هذه الصفحة للمديرين.</div>;

  const pendingCount = files.filter((f) => f.status === "بانتظار الاعتماد").length;
  const heldCount = files.filter((f) => f.status === "موقوف ماليًا").length;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Segoe UI',Tahoma,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
        <FolderOpen size={22} color={GD} />
        <h1 style={{ fontSize: 21, fontWeight: 800, color: GR, margin: 0 }}>الملفات والاعتمادات</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px 14px" }}>
        ملفات المناقصات والممارسات: مساراتها وحالاتها وقراراتها.
        {filter === "الكل" && (pendingCount > 0 || heldCount > 0) && (
          <span> — <b style={{ color: "#b45309" }}>{pendingCount} بانتظار الاعتماد</b> · <b style={{ color: "#dc2626" }}>{heldCount} موقوف ماليًا</b></span>
        )}
      </p>

      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 12, border: "1.5px solid #f0ead8", padding: 5, marginBottom: 14, flexWrap: "wrap", alignSelf: "flex-start", width: "fit-content" }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: filter === f ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: filter === f ? "white" : "#374151" }}>
            {f}
          </button>
        ))}
      </div>

      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead style={{ background: "#faf8f2" }}>
            <tr>{["الملف", "النوع", "رفعه", "مسار التوريد", "الحالة", "آخر تحديث", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {files.length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={7}>لا ملفات{filter !== "الكل" ? ` بحالة «${filter}»` : " بعد — تُفتح من داخل صفحة المناقصة/الممارسة"}</td></tr> :
              files.map((f) => (
                <tr key={f.id}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {f.title ?? `#${f.entityId}`}
                    {f.gmOverride && <span title="مرّ بتجاوز مسجَّل" style={{ marginRight: 6, color: "#7c3aed" }}><ShieldAlert size={12} style={{ display: "inline" }} /></span>}
                  </td>
                  <td style={td}>{f.entityType === "tender" ? "مناقصة" : "ممارسة"}</td>
                  <td style={td}>{f.raisedByName ?? "—"}</td>
                  <td style={td}>{f.sourcingPath ?? "—"}{f.sourcingPath === "فريق البحث" && f.researcherName ? ` (${f.researcherName})` : ""}{f.sourcingPath === "مصدر خاص" && f.ownSourceSupplierName ? ` (${f.ownSourceSupplierName})` : ""}</td>
                  <td style={td}><StatusChip status={f.status} /></td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{fmtDT(f.submittedAt ?? f.heldAt ?? f.decidedAt)}</td>
                  <td style={td}>
                    <Link href={f.entityType === "tender" ? `/tenders/${f.entityId}` : `/practices/${f.entityId}`}>
                      <button style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: "#fdf8ec", color: GD, border: `1px solid ${G}40`, cursor: "pointer", fontFamily: "inherit" }}>فتح</button>
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
