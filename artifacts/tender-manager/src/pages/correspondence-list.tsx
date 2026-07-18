import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { correspondenceApi, entitiesApi } from "@/lib/api";
import { Mail, Plus, Search, Send, Inbox, UploadCloud, BadgeCheck, PenLine } from "lucide-react";
import LetterEditorDialog from "@/components/correspondence/letter-editor";
import QuickUploadIncoming from "@/components/correspondence/quick-upload-incoming";
import { printLetter } from "@/lib/print-letter";

const G = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

const STATUS_LABELS: Record<string, string> = { draft: "مسودة", sent: "مُرسل", received: "وارد", closed: "مغلق", cancelled: "ملغي" };
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#f3f4f6", text: "#374151" },
  sent: { bg: "#dbeafe", text: "#1e40af" },
  received: { bg: "#dcfce7", text: "#166534" },
  closed: { bg: "#f3f4f6", text: "#6b7280" },
  cancelled: { bg: "#fee2e2", text: "#991b1b" },
};

async function apiFetch<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" as const },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` },
  filtersRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, marginBottom: 18 },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", width: 260 },
  select: { padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e5dfc8", fontSize: 12.5, background: "white", outline: "none", color: "#1e2a1e", maxWidth: 220 },
  dateInput: { padding: "7px 10px", borderRadius: 10, border: "1.5px solid #e5dfc8", fontSize: 12.5, background: "white", outline: "none", color: "#1e2a1e" },
  tableCard: { background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" },
  thead: { background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" },
  th: { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td: { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
};

export default function CorrespondenceList() {
  const [tab, setTab] = useState<"outgoing" | "incoming">("outgoing");
  const [search, setSearch] = useState("");
  const [entityId, setEntityId] = useState("");
  const [contractId, setContractId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openLetterId, setOpenLetterId] = useState<number | "new" | null>(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);

  const { data: entities = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list() });
  const { data: contracts = [] } = useQuery<any[]>({ queryKey: ["contracts-for-corr-filter"], queryFn: () => apiFetch("/api/contracts"), staleTime: 5 * 60_000 });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["correspondence", "all", { search, direction: tab, entityId, contractId, dateFrom, dateTo }],
    queryFn: () => correspondenceApi.list({
      search, direction: tab, dateFrom, dateTo,
      ...(entityId ? { governmentEntityId: Number(entityId) } : {}),
      ...(contractId ? { sourceType: "contract", sourceId: Number(contractId) } : {}),
      limit: 100,
    }),
  });

  const rows = data?.rows ?? [];
  const isOutgoing = tab === "outgoing";

  // النسخة النهائية المرقّمة — مباشرة من الجدول للكتب المُرسلة/المغلقة
  const exportFinal = (letter: any, e: React.MouseEvent) => {
    e.stopPropagation();
    printLetter({
      letterNumber: letter.letterNumber,
      subject: letter.subject,
      letterDate: letter.letterDate,
      direction: letter.direction,
      recipientName: letter.recipientName,
      attentionLine: letter.attentionLine,
      recipientHonorific: letter.recipientHonorific,
      attentionHonorific: letter.attentionHonorific,
      senderName: letter.senderName,
      companyName: letter.companyName,
      bodyJson: letter.bodyJson,
      bodyHtml: letter.bodyHtml,
      finalNumbered: true,
    });
  };

  const tabBtn = (key: "outgoing" | "incoming", label: string, icon: React.ReactNode, hint: string) => (
    <button
      onClick={() => setTab(key)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: "12px 12px 0 0",
        border: "1.5px solid #f0ead8", borderBottom: tab === key ? "2.5px solid white" : "1.5px solid #f0ead8",
        background: tab === key ? "white" : "#f6f2e7", cursor: "pointer", fontFamily: "inherit",
        fontWeight: 800, fontSize: 13.5, color: tab === key ? "#132a18" : "#8a8060",
        marginBottom: -1.5, position: "relative" as const, zIndex: tab === key ? 2 : 1,
      }}
      title={hint}
    >
      {icon} {label}
      <span style={{ fontSize: 10, fontWeight: 600, color: tab === key ? GD : "#a89f85" }}>{hint}</span>
    </button>
  );

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: "flex", gap: 14 }}>
          <div style={S.accentBar} />
          <div>
            <div style={S.titleRow}>
              <Mail size={20} color={GD} />
              <h1 style={S.title}>المراسلات</h1>
            </div>
            <p style={S.subtitle}>الأرشيف الموحّد لكل الكتب الصادرة والواردة — {data?.total ?? 0} خطاب</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {isOutgoing ? (
            <button style={S.btnPrimary} onClick={() => setOpenLetterId("new")}>
              <PenLine size={15} /> كتاب صادر جديد (مكتوب)
            </button>
          ) : (
            <button style={S.btnPrimary} onClick={() => setShowQuickUpload(true)}>
              <UploadCloud size={15} /> رفع كتاب وارد
            </button>
          )}
        </div>
      </div>

      {/* تبويبا الصادر / الوارد */}
      <div style={{ display: "flex", gap: 6, paddingRight: 8 }}>
        {tabBtn("outgoing", "الكتب الصادرة", <Send size={14} color={tab === "outgoing" ? "#2563eb" : "#a89f85"} />, "كتاب مكتوب")}
        {tabBtn("incoming", "الكتب الواردة", <Inbox size={14} color={tab === "incoming" ? "#16a34a" : "#a89f85"} />, "كتاب مرفوع")}
      </div>

      <div style={{ ...S.tableCard, borderTopRightRadius: 0 }}>
        <div style={{ ...S.filtersRow, padding: "16px 18px 0", marginBottom: 12 }}>
          <div style={S.searchBar}>
            <Search size={15} color="#9ca3af" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الخطاب، الموضوع، الجهة..."
              style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent" }}
            />
          </div>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={S.select} title="فلترة حسب الجهة الحكومية">
            <option value="">كل الجهات</option>
            {entities.map((en: any) => <option key={en.id} value={en.id}>{en.name}</option>)}
          </select>
          <select value={contractId} onChange={(e) => setContractId(e.target.value)} style={S.select} title="فلترة حسب العقد">
            <option value="">كل العقود</option>
            {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNumber}{c.title ? ` — ${c.title}` : ""}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={S.dateInput} title="من تاريخ" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={S.dateInput} title="إلى تاريخ" />
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
            {isOutgoing ? "لا توجد كتب صادرة مطابقة" : "لا توجد كتب واردة مطابقة"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={S.thead}>
              <tr>
                <th style={S.th}></th>
                <th style={S.th}>رقم الخطاب</th>
                <th style={S.th}>الموضوع</th>
                <th style={S.th}>{isOutgoing ? "المرسل إليه" : "المرسل"}</th>
                <th style={S.th}>الحالة</th>
                <th style={S.th}>التاريخ</th>
                <th style={S.th}>الموظف المسؤول</th>
                {isOutgoing && <th style={S.th} title="تصدير النسخة النهائية الكاملة بالترقيم">نهائي</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((letter: any) => {
                const sc = STATUS_COLORS[letter.status] ?? STATUS_COLORS.draft;
                const isCancelled = letter.status === "cancelled";
                const canExportFinal = letter.direction === "outgoing" && (letter.status === "sent" || letter.status === "closed");
                return (
                  <tr
                    key={letter.id}
                    onClick={() => setOpenLetterId(letter.id)}
                    style={{ borderBottom: "1px solid #f3f0e4", cursor: "pointer", opacity: isCancelled ? 0.6 : 1 }}
                  >
                    <td style={{ ...S.td, width: 32 }}>
                      {letter.direction === "outgoing" ? <Send size={14} color="#2563eb" /> : <Inbox size={14} color="#16a34a" />}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: "#132a18", textDecoration: isCancelled ? "line-through" : "none" }}>{letter.letterNumber}</td>
                    <td style={{ ...S.td, textDecoration: isCancelled ? "line-through" : "none" }}>{letter.subject}</td>
                    <td style={{ ...S.td, color: "#4b5563" }}>{(letter.direction === "outgoing" ? letter.recipientName : letter.senderName) || "—"}</td>
                    <td style={S.td}>
                      <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text }}>
                        {STATUS_LABELS[letter.status] ?? letter.status}
                      </span>
                    </td>
                    <td style={S.td}>{letter.letterDate}</td>
                    <td style={S.td}>{letter.responsibleEmployee ?? "—"}</td>
                    {isOutgoing && (
                      <td style={{ ...S.td, width: 46 }}>
                        {canExportFinal && (
                          <button
                            onClick={(e) => exportFinal(letter, e)}
                            title="تصدير النسخة النهائية الكاملة — برقم الكتاب على جانب الصفحة"
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                              background: "#f0fdf4", border: "1.5px solid #16a34a66",
                            }}
                          >
                            <BadgeCheck size={15} color="#16a34a" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {openLetterId !== null && (
        <LetterEditorDialog
          letterId={openLetterId === "new" ? null : openLetterId}
          onClose={() => setOpenLetterId(null)}
          onSaved={() => setOpenLetterId(null)}
        />
      )}

      {showQuickUpload && (
        <QuickUploadIncoming
          onClose={() => setShowQuickUpload(false)}
          onSaved={() => { refetch(); setShowQuickUpload(false); }}
        />
      )}
    </div>
  );
}
