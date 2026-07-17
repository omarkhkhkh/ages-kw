import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { correspondenceApi, entitiesApi, projectsApi, contractsApi, purchaseOrdersApi, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { X, Inbox, UploadCloud, Loader2, Paperclip } from "lucide-react";
import type { CorrespondenceSourceType } from "./correspondence-list-panel";
import { LINK_OPTIONS, SOURCE_ID_FIELD, type LinkType } from "@/lib/correspondence-link-options";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

interface Props {
  /** Pre-set when opened from a specific record's panel (e.g. a project or entity's own correspondence tab). */
  sourceType?: CorrespondenceSourceType;
  sourceId?: number;
  governmentEntityId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

function inputStyle(): React.CSSProperties {
  return { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
}
function labelStyle(): React.CSSProperties {
  return { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
}

export default function QuickUploadIncoming({ sourceType, sourceId, governmentEntityId, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const isPreScoped = !!sourceType && !!sourceId;

  const [linkType, setLinkType] = useState<LinkType>(isPreScoped ? sourceType! : "none");
  const [linkId, setLinkId] = useState<number | null>(isPreScoped ? sourceId! : null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    senderName: "",
    subject: "",
    letterDate: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
  });

  const showPicker = !isPreScoped;
  const { data: tenders = [] } = useQuery({ queryKey: ["tenders"], queryFn: () => apiFetch<any[]>("/api/tenders"), enabled: showPicker && linkType === "tender" });
  const { data: practices = [] } = useQuery({ queryKey: ["practices"], queryFn: () => apiFetch<any[]>("/api/practices"), enabled: showPicker && linkType === "practice" });
  const { data: contracts = [] } = useQuery({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list(), enabled: showPicker && linkType === "contract" });
  const { data: purchaseOrders = [] } = useQuery({ queryKey: ["purchase-orders", "all"], queryFn: () => purchaseOrdersApi.list(), enabled: showPicker && linkType === "purchase_order" });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => projectsApi.list(), enabled: showPicker && linkType === "project" });
  const { data: entities = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list(), enabled: showPicker && linkType === "government_entity" });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const { uploadFile, isUploading, progress } = useUpload({
    onError: (err) => toast({ title: "فشل رفع الملف", description: err.message, variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPendingFile(f);
    e.target.value = "";
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const resolvedGovernmentEntityId = linkType === "government_entity" ? linkId : governmentEntityId ?? null;
      const idField = linkType !== "none" ? SOURCE_ID_FIELD[linkType] : undefined;

      const letter: any = await correspondenceApi.create({
        direction: "incoming",
        status: "received",
        subject: form.subject,
        letterDate: form.letterDate,
        senderName: form.senderName || null,
        referenceNumber: form.referenceNumber || null,
        sourceType: linkType === "none" ? null : linkType,
        ...(idField ? { [idField]: linkId } : {}),
        governmentEntityId: resolvedGovernmentEntityId,
        bodyJson: null,
        bodyHtml: null,
      });

      if (pendingFile) {
        const uploadRes = await uploadFile(pendingFile);
        if (uploadRes) {
          await correspondenceApi.addAttachment(letter.id, {
            fileName: uploadRes.metadata.name,
            fileUrl: uploadRes.objectPath,
            mimeType: uploadRes.metadata.contentType,
            fileSize: uploadRes.metadata.size,
            attachmentType: "main_copy",
          });
        }
      }
      return letter;
    },
    onSuccess: (letter: any) => {
      qc.invalidateQueries({ queryKey: ["correspondence"] });
      toast({ title: "✅ تم رفع الكتاب الوارد", description: `رقم الخطاب: ${letter.letterNumber}` });
      onSaved();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const canSubmit = form.subject.trim() && form.senderName.trim() && !saveMutation.isPending && !isUploading;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(11,26,16,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: "white", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,0.35)" }}>
        <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(212,165,52,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Inbox size={16} color={G} />
            </div>
            <h2 style={{ color: "white", fontSize: 15, fontWeight: 800, margin: 0 }}>رفع كتاب وارد</h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="white" />
          </button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle()}>اسم المرسل / الجهة *</label>
            <input value={form.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="مثال: وزارة التربية" style={inputStyle()} />
          </div>
          <div>
            <label style={labelStyle()}>الموضوع *</label>
            <input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="موضوع الكتاب" style={inputStyle()} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle()}>تاريخ الكتاب</label>
              <input type="date" value={form.letterDate} onChange={(e) => set("letterDate", e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>رقم إشارة الكتاب</label>
              <input value={form.referenceNumber} onChange={(e) => set("referenceNumber", e.target.value)} style={inputStyle()} />
            </div>
          </div>

          {showPicker && (
            <div>
              <label style={labelStyle()}>الربط بـ</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
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
            </div>
          )}

          <div>
            <label style={labelStyle()}>نسخة الكتاب (PDF / صورة)</label>
            {pendingFile ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${G}44`, background: "#fdf8ec" }}>
                <Paperclip size={13} color={GD} />
                <span style={{ fontSize: 12, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingFile.name}</span>
                <button type="button" onClick={() => setPendingFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex" }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => inputRef.current?.click()}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "16px 14px", borderRadius: 10, cursor: "pointer", border: "2px dashed #d1d5db", background: "#fafafa" }}
              >
                <UploadCloud size={18} color="#9ca3af" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>اختر ملف</span>
              </div>
            )}
            <input ref={inputRef} type="file" accept="application/pdf,image/*,.doc,.docx" style={{ display: "none" }} onChange={handleFile} />
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => saveMutation.mutate()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 10,
              background: `linear-gradient(135deg, ${G}, ${GD})`, color: "white", fontSize: 13.5, fontWeight: 800,
              border: "none", cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.6, fontFamily: "inherit", marginTop: 6,
            }}
          >
            {saveMutation.isPending || isUploading
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> {isUploading ? `جارِ الرفع... ${progress}%` : "جارِ الحفظ..."}</>
              : <><Inbox size={14} /> حفظ الكتاب الوارد</>}
          </button>
        </div>
      </div>
    </div>
  );
}
