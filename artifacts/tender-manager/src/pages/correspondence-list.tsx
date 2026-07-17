import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { correspondenceApi } from "@/lib/api";
import { Mail, Plus, Search, Send, Inbox, UploadCloud } from "lucide-react";
import LetterEditorDialog from "@/components/correspondence/letter-editor";
import QuickUploadIncoming from "@/components/correspondence/quick-upload-incoming";

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

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 },
  accentBar: { width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 14px ${G}44` },
  filtersRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, marginBottom: 18 },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "white", border: "1.5px solid #e5dfc8", borderRadius: 12, padding: "8px 14px", width: 280 },
  select: { padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e5dfc8", fontSize: 12.5, background: "white", outline: "none", color: "#1e2a1e" },
  dateInput: { padding: "7px 10px", borderRadius: 10, border: "1.5px solid #e5dfc8", fontSize: 12.5, background: "white", outline: "none", color: "#1e2a1e" },
  tableCard: { background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" },
  thead: { background: "#f9f6ee", borderBottom: "1.5px solid #f0ead8" },
  th: { padding: "14px 18px", fontWeight: 700, color: "#4a3f1a", fontSize: 12, whiteSpace: "nowrap" as const, textAlign: "right" as const },
  td: { padding: "13px 18px", fontSize: 13, textAlign: "right" as const, verticalAlign: "middle" as const },
};

export default function CorrespondenceList() {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openLetterId, setOpenLetterId] = useState<number | "new" | null>(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["correspondence", "all", { search, direction, dateFrom, dateTo }],
    queryFn: () => correspondenceApi.list({ search, direction, dateFrom, dateTo, limit: 100 }),
  });

  const rows = data?.rows ?? [];

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
          <button
            style={{ display: "flex", alignItems: "center", gap: 6, background: "white", color: GD, border: `1.5px solid ${G}66`, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            onClick={() => setShowQuickUpload(true)}
          >
            <UploadCloud size={15} /> رفع كتاب وارد
          </button>
          <button style={S.btnPrimary} onClick={() => setOpenLetterId("new")}>
            <Plus size={16} /> خطاب جديد
          </button>
        </div>
      </div>

      <div style={S.filtersRow}>
        <div style={S.searchBar}>
          <Search size={15} color="#9ca3af" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم الخطاب، الموضوع، الجهة..."
            style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent" }}
          />
        </div>
        <select value={direction} onChange={(e) => setDirection(e.target.value)} style={S.select}>
          <option value="">كل الاتجاهات</option>
          <option value="outgoing">صادر</option>
          <option value="incoming">وارد</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={S.dateInput} title="من تاريخ" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={S.dateInput} title="إلى تاريخ" />
      </div>

      <div style={S.tableCard}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>لا توجد مراسلات مطابقة</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={S.thead}>
              <tr>
                <th style={S.th}></th>
                <th style={S.th}>رقم الخطاب</th>
                <th style={S.th}>الموضوع</th>
                <th style={S.th}>الجهة</th>
                <th style={S.th}>الحالة</th>
                <th style={S.th}>التاريخ</th>
                <th style={S.th}>الموظف المسؤول</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((letter: any) => {
                const sc = STATUS_COLORS[letter.status] ?? STATUS_COLORS.draft;
                const isCancelled = letter.status === "cancelled";
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
