import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { correspondenceApi } from "@/lib/api";
import { Mail, Inbox, Send, Plus, Paperclip, Loader2, UploadCloud } from "lucide-react";
import LetterEditorDialog from "./letter-editor";
import QuickUploadIncoming from "./quick-upload-incoming";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  sent: "مُرسل",
  received: "وارد",
  closed: "مغلق",
  cancelled: "ملغي",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  sent: "#2563eb",
  received: "#16a34a",
  closed: "#9ca3af",
  cancelled: "#dc2626",
};

export type CorrespondenceSourceType =
  | "tender" | "practice" | "contract" | "purchase_order" | "supplier" | "project" | "government_entity";

interface Props {
  sourceType?: CorrespondenceSourceType;
  sourceId?: number;
  governmentEntityId?: number | null;
}

export default function CorrespondenceListPanel({ sourceType, sourceId, governmentEntityId }: Props) {
  const [openLetterId, setOpenLetterId] = useState<number | null | "new">(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["correspondence", { sourceType, sourceId }],
    queryFn: () => correspondenceApi.list({ sourceType, sourceId }),
    enabled: sourceType ? !!sourceId : true,
  });

  const rows = data?.rows ?? [];

  return (
    <div dir="rtl">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mail size={16} color={GD} />
          <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>المراسلات</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>({rows.length})</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowQuickUpload(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
              background: "white", color: GD, fontSize: 12.5, fontWeight: 800,
              border: `1px solid ${G}88`, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <UploadCloud size={14} /> رفع كتاب وارد
          </button>
          <button
            onClick={() => setOpenLetterId("new")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
              background: `linear-gradient(135deg, ${G}, ${GD})`, color: "white", fontSize: 12.5, fontWeight: 800,
              border: "none", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Plus size={14} /> خطاب جديد
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={22} color={G} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 13 }}>
          لا توجد مراسلات مسجّلة بعد
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((letter: any) => {
            const isCancelled = letter.status === "cancelled";
            return (
              <div
                key={letter.id}
                onClick={() => setOpenLetterId(letter.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                  border: "1px solid #eee", cursor: "pointer", background: isCancelled ? "#fafafa" : "white",
                  opacity: isCancelled ? 0.6 : 1, transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = G)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#eee")}
              >
                <div
                  style={{
                    width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: letter.direction === "outgoing" ? "#eff6ff" : "#f0fdf4", flexShrink: 0,
                  }}
                >
                  {letter.direction === "outgoing" ? <Send size={14} color="#2563eb" /> : <Inbox size={14} color="#16a34a" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: GR, textDecoration: isCancelled ? "line-through" : "none" }}>{letter.letterNumber}</span>
                    <span
                      style={{
                        fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        color: "white", background: STATUS_COLORS[letter.status] ?? "#9ca3af",
                      }}
                    >
                      {STATUS_LABELS[letter.status] ?? letter.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#4b5563", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isCancelled ? "line-through" : "none" }}>
                    {letter.subject}
                  </p>
                </div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", flexShrink: 0 }}>{letter.letterDate}</div>
              </div>
            );
          })}
        </div>
      )}

      {openLetterId !== null && (
        <LetterEditorDialog
          letterId={openLetterId === "new" ? null : openLetterId}
          sourceType={sourceType}
          sourceId={sourceId}
          governmentEntityId={governmentEntityId}
          onClose={() => setOpenLetterId(null)}
          onSaved={() => { refetch(); setOpenLetterId(null); }}
        />
      )}

      {showQuickUpload && (
        <QuickUploadIncoming
          sourceType={sourceType}
          sourceId={sourceId}
          governmentEntityId={governmentEntityId}
          onClose={() => setShowQuickUpload(false)}
          onSaved={() => { refetch(); setShowQuickUpload(false); }}
        />
      )}
    </div>
  );
}
