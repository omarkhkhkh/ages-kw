import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { correspondenceTemplatesApi } from "@/lib/api";
import { FileText, X, Loader2 } from "lucide-react";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "quote_request", label: "طلب عرض سعر" },
  { key: "inquiry", label: "استفسار" },
  { key: "extension_request", label: "طلب تمديد" },
  { key: "approval", label: "اعتماد" },
  { key: "apology", label: "اعتذار" },
  { key: "thanks", label: "شكر" },
  { key: "meeting_invitation", label: "دعوة اجتماع" },
  { key: "supply_request", label: "طلب توريد" },
  { key: "purchase_order", label: "أمر شراء" },
  { key: "financial_claim", label: "مطالبة مالية" },
  { key: "custom", label: "مخصص" },
];

/** Recursively replaces {{token}} placeholders in Tiptap JSON text nodes with values from `data`. */
function fillPlaceholders(node: any, data: Record<string, string | undefined>): any {
  if (Array.isArray(node)) return node.map((n) => fillPlaceholders(n, data));
  if (node && typeof node === "object") {
    const copy: any = { ...node };
    if (copy.type === "text" && typeof copy.text === "string") {
      copy.text = copy.text.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => data[key] ?? "");
    }
    if (copy.content) copy.content = fillPlaceholders(copy.content, data);
    return copy;
  }
  return node;
}

interface Props {
  placeholderData: Record<string, string | undefined>;
  onSelect: (bodyJson: any, templateId: number) => void;
  onClose: () => void;
}

export default function TemplatePicker({ placeholderData, onSelect, onClose }: Props) {
  const [category, setCategory] = useState<string>("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["correspondence-templates", category],
    queryFn: () => correspondenceTemplatesApi.list(category || undefined),
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1300, background: "rgba(11,26,16,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(5px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        style={{
          width: "100%", maxWidth: 640, maxHeight: "80vh", background: "white", borderRadius: 20,
          boxShadow: "0 32px 80px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ color: "white", fontSize: 15, fontWeight: 800, margin: 0 }}>اختر نموذج خطاب</h3>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={15} color="white" />
          </button>
        </div>

        <div style={{ padding: "12px 22px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid #eee" }}>
          <button
            onClick={() => setCategory("")}
            style={{
              padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${category === "" ? G : "#e5e7eb"}`,
              background: category === "" ? "#fdf8ec" : "white", color: category === "" ? GD : "#6b7280",
            }}
          >
            الكل
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              style={{
                padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${category === c.key ? G : "#e5e7eb"}`,
                background: category === c.key ? "#fdf8ec" : "white", color: category === c.key ? GD : "#6b7280",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
              <Loader2 size={20} color={G} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 20 }}>لا توجد نماذج في هذه الفئة</div>
          ) : (
            templates.map((t: any) => (
              <button
                key={t.id}
                onClick={() => onSelect(fillPlaceholders(JSON.parse(t.bodyJson), placeholderData), t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12,
                  border: "1px solid #eee", background: "white", cursor: "pointer", textAlign: "right", fontFamily: "inherit",
                }}
              >
                <FileText size={16} color={GD} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GR }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
