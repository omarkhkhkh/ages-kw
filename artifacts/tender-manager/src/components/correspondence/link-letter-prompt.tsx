import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { correspondenceApi, entitiesApi, projectsApi, contractsApi, purchaseOrdersApi, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { X, FolderInput, Loader2, Check } from "lucide-react";
import { LINK_OPTIONS, SOURCE_ID_FIELD, type LinkType } from "@/lib/correspondence-link-options";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

function inputStyle(): React.CSSProperties {
  return { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
}

interface Props {
  letterId: number;
  letterNumber: string;
  onDone: () => void;
}

/**
 * Shown right after a letter (outgoing or incoming) is saved/sent from the general
 * "خطاب جديد" flow with no pre-set source — asks where to file it (tender, practice,
 * contract, purchase order, project, or government entity), or lets the user skip.
 */
export default function LinkLetterPrompt({ letterId, letterNumber, onDone }: Props) {
  const { toast } = useToast();
  const [linkType, setLinkType] = useState<LinkType>("none");
  const [linkId, setLinkId] = useState<number | null>(null);

  const { data: tenders = [] } = useQuery({ queryKey: ["tenders"], queryFn: () => apiFetch<any[]>("/api/tenders"), enabled: linkType === "tender" });
  const { data: practices = [] } = useQuery({ queryKey: ["practices"], queryFn: () => apiFetch<any[]>("/api/practices"), enabled: linkType === "practice" });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list(), enabled: linkType === "contract" });
  const { data: purchaseOrders = [] } = useQuery({ queryKey: ["purchase-orders", "all"], queryFn: () => purchaseOrdersApi.list(), enabled: linkType === "purchase_order" });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => projectsApi.list(), enabled: linkType === "project" });
  const { data: entities = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list(), enabled: linkType === "government_entity" });

  const linkMutation = useMutation({
    mutationFn: () => {
      const idField = linkType !== "none" ? SOURCE_ID_FIELD[linkType] : undefined;
      return correspondenceApi.update(letterId, {
        sourceType: linkType === "none" ? null : linkType,
        ...(idField ? { [idField]: linkId } : {}),
        ...(linkType === "government_entity" ? { governmentEntityId: linkId } : {}),
      });
    },
    onSuccess: () => {
      toast({ title: "✅ تم ربط الخطاب" });
      onDone();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const canSave = linkType === "none" || !!linkId;

  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(11,26,16,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: 460, background: "white", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,0.35)", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(212,165,52,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderInput size={16} color={G} />
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 14.5, fontWeight: 800, margin: 0 }}>أين تريد وضع هذا الخطاب؟</h2>
              <p style={{ color: "rgba(212,165,52,0.55)", fontSize: 11, margin: "2px 0 0" }}>{letterNumber}</p>
            </div>
          </div>
          <button onClick={onDone} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="white" />
          </button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LINK_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setLinkType(opt.key); setLinkId(null); }}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${linkType === opt.key ? G : "#e5e7eb"}`,
                  background: linkType === opt.key ? "#fdf8ec" : "white", color: linkType === opt.key ? GD : "#6b7280",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {linkType === "tender" && (
            <select value={linkId ?? ""} onChange={(e) => setLinkId(e.target.value ? Number(e.target.value) : null)} style={inputStyle()}>
              <option value="">— اختر المناقصة —</option>
              {tenders.map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber} — {t.projectName}</option>)}
            </select>
          )}
          {linkType === "practice" && (
            <select value={linkId ?? ""} onChange={(e) => setLinkId(e.target.value ? Number(e.target.value) : null)} style={inputStyle()}>
              <option value="">— اختر الممارسة —</option>
              {practices.map((p: any) => <option key={p.id} value={p.id}>{p.practiceNumber} — {p.projectName}</option>)}
            </select>
          )}
          {linkType === "contract" && (
            <select value={linkId ?? ""} onChange={(e) => setLinkId(e.target.value ? Number(e.target.value) : null)} style={inputStyle()}>
              <option value="">— اختر العقد —</option>
              {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNumber}</option>)}
            </select>
          )}
          {linkType === "purchase_order" && (
            <select value={linkId ?? ""} onChange={(e) => setLinkId(e.target.value ? Number(e.target.value) : null)} style={inputStyle()}>
              <option value="">— اختر أمر الشراء —</option>
              {purchaseOrders.map((o: any) => <option key={o.id} value={o.id}>{o.orderNumber} — {o.description}</option>)}
            </select>
          )}
          {linkType === "project" && (
            <select value={linkId ?? ""} onChange={(e) => setLinkId(e.target.value ? Number(e.target.value) : null)} style={inputStyle()}>
              <option value="">— اختر المشروع —</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {linkType === "government_entity" && (
            <select value={linkId ?? ""} onChange={(e) => setLinkId(e.target.value ? Number(e.target.value) : null)} style={inputStyle()}>
              <option value="">— اختر الجهة —</option>
              {entities.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={onDone}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              تخطي
            </button>
            <button
              type="button"
              disabled={!canSave || linkMutation.isPending}
              onClick={() => linkMutation.mutate()}
              style={{
                flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10,
                background: `linear-gradient(135deg, ${G}, ${GD})`, color: "white", fontSize: 12.5, fontWeight: 800,
                border: "none", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.6, fontFamily: "inherit",
              }}
            >
              {linkMutation.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />} حفظ الموضع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
