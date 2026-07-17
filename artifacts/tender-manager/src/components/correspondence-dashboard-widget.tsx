import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { correspondenceApi } from "@/lib/api";
import { Mail, Send, Inbox, AlertCircle, Clock, ArrowLeft } from "lucide-react";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

export default function CorrespondenceDashboardWidget() {
  const { data } = useQuery({ queryKey: ["correspondence-stats"], queryFn: () => correspondenceApi.stats() });

  const tiles = [
    { label: "الصادر", value: data?.outgoingCount ?? 0, icon: Send, color: "#2563eb" },
    { label: "الوارد", value: data?.incomingCount ?? 0, icon: Inbox, color: "#16a34a" },
    { label: "بدون رد", value: data?.unanswered ?? 0, icon: AlertCircle, color: "#dc2626" },
    { label: "قيد الاعتماد", value: data?.pendingApproval ?? 0, icon: Clock, color: GD },
  ];

  return (
    <div dir="rtl" style={{ background: "white", borderRadius: 16, border: "1px solid #eee", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mail size={16} color={GD} />
          <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>المراسلات</span>
        </div>
        <Link href="/correspondence" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: GD, textDecoration: "none" }}>
          عرض الكل <ArrowLeft size={12} />
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ padding: "10px 8px", borderRadius: 10, background: "#fafafa", textAlign: "center" }}>
            <t.icon size={14} color={t.color} style={{ margin: "0 auto 4px" }} />
            <div style={{ fontSize: 17, fontWeight: 900, color: GR }}>{t.value}</div>
            <div style={{ fontSize: 10.5, color: "#9ca3af" }}>{t.label}</div>
          </div>
        ))}
      </div>

      {data?.latest?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.latest.slice(0, 5).map((letter: any) => (
            <div key={letter.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderTop: "1px solid #f3f4f6" }}>
              <span style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{letter.subject}</span>
              <span style={{ color: "#9ca3af", fontSize: 11 }}>{letter.letterNumber}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
