import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import { useUpload } from "@workspace/object-storage-web";
import { tiptapExtensions, FONT_FAMILIES, FONT_SIZES } from "@/lib/tiptap-extensions";
import { printLetter } from "@/lib/print-letter";
import { buildLetterDocx, downloadBlob } from "@/lib/docx-export";
import { correspondenceApi, entitiesApi, entityDirectoryApi } from "@/lib/api";
import { objectPathToUrl } from "@/components/file-upload";
import { useToast } from "@/hooks/use-toast";
import TemplatePicker from "./template-picker";
import AttachmentsPanel from "./attachments-panel";
import LinkLetterPrompt from "./link-letter-prompt";
import {
  X, Save, Send, Printer, FileDown, FileText, Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Table as TableIcon, Image as ImageIcon, AlignRight, AlignCenter, Loader2, Ban, BadgeCheck,
} from "lucide-react";
import type { CorrespondenceSourceType } from "./correspondence-list-panel";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const LETTER_TYPES = [
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
  { key: "incoming_general", label: "وارد عام" },
  { key: "other", label: "أخرى" },
];

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

interface Props {
  letterId?: number | null;
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

export default function LetterEditorDialog({ letterId, sourceType, sourceId, governmentEntityId, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!letterId;

  const { data: existing } = useQuery({
    queryKey: ["correspondence", letterId],
    queryFn: () => correspondenceApi.get(letterId!),
    enabled: isEdit,
  });

  const { data: entities = [] } = useQuery({ queryKey: ["government-entities"], queryFn: () => entitiesApi.list() });

  const [savedLetterId, setSavedLetterId] = useState<number | null>(letterId ?? null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [linkPromptLetter, setLinkPromptLetter] = useState<{ id: number; number: string } | null>(null);
  const isCancelled = existing?.status === "cancelled";
  // Prompt for a filing location only for brand-new, non-pre-scoped letters (created from the
  // general "خطاب جديد" flow) — never re-prompt when editing an already-saved letter.
  const shouldPromptForLink = !isEdit && !sourceType;
  const [form, setForm] = useState({
    direction: "outgoing" as "outgoing" | "incoming",
    subject: "",
    letterType: "",
    letterDate: new Date().toISOString().slice(0, 10),
    senderName: "",
    recipientName: "",
    attentionLine: "",
    recipientHonorific: "المحترمين",
    attentionHonorific: "المحترمين",
    companyName: "",
    referenceNumber: "",
    governmentEntityId: governmentEntityId ?? null as number | null,
    departmentId: null as number | null,
    contactId: null as number | null,
    deadlineDate: "",
    responsibleEmployee: "",
    notes: "",
  });

  const editor = useEditor({ extensions: tiptapExtensions, content: EMPTY_DOC, editable: !isCancelled });

  useEffect(() => {
    editor?.setEditable(!isCancelled);
  }, [editor, isCancelled]);

  useEffect(() => {
    if (!existing) return;
    setForm({
      direction: existing.direction,
      subject: existing.subject ?? "",
      letterType: existing.letterType ?? "",
      letterDate: existing.letterDate ?? new Date().toISOString().slice(0, 10),
      senderName: existing.senderName ?? "",
      recipientName: existing.recipientName ?? "",
      attentionLine: existing.attentionLine ?? "",
      recipientHonorific: existing.recipientHonorific ?? "المحترمين",
      attentionHonorific: existing.attentionHonorific ?? "المحترمين",
      companyName: existing.companyName ?? "",
      referenceNumber: existing.referenceNumber ?? "",
      governmentEntityId: existing.governmentEntityId ?? null,
      departmentId: existing.departmentId ?? null,
      contactId: existing.contactId ?? null,
      deadlineDate: existing.deadlineDate ?? "",
      responsibleEmployee: existing.responsibleEmployee ?? "",
      notes: existing.notes ?? "",
    });
    if (editor && existing.bodyJson) {
      try { editor.commands.setContent(JSON.parse(existing.bodyJson)); } catch { /* ignore */ }
    }
  }, [existing, editor]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const entityName = useMemo(
    () => entities.find((e: any) => e.id === form.governmentEntityId)?.name,
    [entities, form.governmentEntityId],
  );

  const { data: directory } = useQuery({
    queryKey: ["entity-directory", form.governmentEntityId],
    queryFn: () => entityDirectoryApi.getDirectory(form.governmentEntityId!),
    enabled: !!form.governmentEntityId,
  });
  const departments = directory?.departments ?? [];
  const selectedDept = departments.find((d: any) => d.id === form.departmentId);
  const contacts = selectedDept?.contacts ?? [];

  const buildPayload = () => ({
    direction: form.direction,
    subject: form.subject,
    letterType: form.letterType || null,
    letterDate: form.letterDate,
    senderName: form.senderName || null,
    recipientName: form.recipientName || null,
    attentionLine: form.attentionLine || null,
    recipientHonorific: form.recipientHonorific,
    attentionHonorific: form.attentionHonorific,
    companyName: form.companyName || null,
    referenceNumber: form.referenceNumber || null,
    governmentEntityId: form.governmentEntityId,
    departmentId: form.departmentId,
    contactId: form.contactId,
    deadlineDate: form.deadlineDate || null,
    responsibleEmployee: form.responsibleEmployee || null,
    notes: form.notes || null,
    sourceType: sourceType ?? null,
    tenderId: sourceType === "tender" ? sourceId : null,
    practiceId: sourceType === "practice" ? sourceId : null,
    contractId: sourceType === "contract" ? sourceId : null,
    purchaseOrderId: sourceType === "purchase_order" ? sourceId : null,
    supplierId: sourceType === "supplier" ? sourceId : null,
    projectId: sourceType === "project" ? sourceId : null,
    bodyJson: editor ? JSON.stringify(editor.getJSON()) : null,
    bodyHtml: editor ? editor.getHTML() : null,
  });

  const saveMutation = useMutation({
    mutationFn: () => (savedLetterId ? correspondenceApi.update(savedLetterId, buildPayload()) : correspondenceApi.create(buildPayload())),
    onSuccess: (row: any) => {
      const isFirstSave = savedLetterId === null;
      setSavedLetterId(row.id);
      qc.invalidateQueries({ queryKey: ["correspondence"] });
      toast({ title: "✅ تم الحفظ", description: `رقم الخطاب: ${row.letterNumber}` });
      if (isFirstSave && shouldPromptForLink) {
        setLinkPromptLetter({ id: row.id, number: row.letterNumber });
      } else {
        onSaved();
      }
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const isFirstSave = savedLetterId === null;
      const row: any = savedLetterId ? await correspondenceApi.update(savedLetterId, buildPayload()) : await correspondenceApi.create(buildPayload());
      const sent = await correspondenceApi.markSent(row.id);
      return { sent, isFirstSave };
    },
    onSuccess: ({ sent: row, isFirstSave }: any) => {
      setSavedLetterId(row.id);
      qc.invalidateQueries({ queryKey: ["correspondence"] });
      toast({ title: "✅ تم إرسال الخطاب" });
      if (isFirstSave && shouldPromptForLink) {
        setLinkPromptLetter({ id: row.id, number: row.letterNumber });
      } else {
        onSaved();
      }
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => correspondenceApi.cancel(savedLetterId!),
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["correspondence"] });
      toast({
        title: "🚫 تم إلغاء الخطاب",
        description: row.numberReclaimed ? "تم استرجاع رقمه ليُستخدم في الخطاب التالي" : "رقمه محجوز ولا يمكن إعادة استخدامه لوجود خطابات لاحقة",
      });
      onSaved();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const { uploadFile: uploadImage, isUploading: uploadingImage } = useUpload({
    onSuccess: (res) => {
      const url = objectPathToUrl(res.objectPath);
      if (url && editor) editor.chain().focus().setImage({ src: url }).run();
    },
    onError: (err) => toast({ title: "فشل رفع الصورة", description: err.message, variant: "destructive" }),
  });

  const handleImagePick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => { const f = input.files?.[0]; if (f) uploadImage(f); };
    input.click();
  };

  const exportPayload = (finalNumbered = false) => ({
    letterNumber: existing?.letterNumber ?? "(مسودة)",
    subject: form.subject,
    letterDate: form.letterDate,
    direction: form.direction,
    recipientName: form.recipientName,
    attentionLine: form.attentionLine,
    recipientHonorific: form.recipientHonorific,
    attentionHonorific: form.attentionHonorific,
    senderName: form.senderName,
    companyName: form.companyName,
    bodyJson: editor ? JSON.stringify(editor.getJSON()) : null,
    finalNumbered,
  });

  const handlePrint = () => printLetter(exportPayload());

  const handleExportDocx = async (finalNumbered = false) => {
    const blob = await buildLetterDocx(exportPayload(finalNumbered));
    downloadBlob(blob, `${existing?.letterNumber ?? "خطاب"}${finalNumbered ? "-نهائي" : ""}.docx`);
  };

  // الكتاب "تم" (أُرسل أو أُغلق) → تتاح النسخة النهائية المرقّمة على جانب الصفحة
  const isFinalized = existing?.status === "sent" || existing?.status === "closed";
  const handleFinalPrint = () => printLetter(exportPayload(true));

  const toolbarBtn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <button
      type="button" title={title} onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6,
        border: `1px solid ${active ? G : "#e5e7eb"}`, background: active ? "#fdf8ec" : "white", color: active ? GD : "#6b7280",
        cursor: "pointer",
      }}
    >
      {icon}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(11,26,16,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: 1000, maxHeight: "94vh", background: "white", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <h2 style={{ color: "white", fontSize: 15, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ textDecoration: isCancelled ? "line-through" : "none" }}>{isEdit ? existing?.letterNumber ?? "خطاب" : "خطاب جديد"}</span>
                {isCancelled && (
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 999, background: "#dc2626", color: "white" }}>
                    ملغي
                  </span>
                )}
              </h2>
              <p style={{ color: "rgba(212,165,52,0.55)", fontSize: 11, margin: "2px 0 0" }}>
                {form.direction === "outgoing" ? "خطاب صادر" : "خطاب وارد"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="white" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          {/* Left: editor */}
          <div>
            {/* meta fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle()}>الاتجاه</label>
                <select value={form.direction} onChange={(e) => set("direction", e.target.value)} style={inputStyle()}>
                  <option value="outgoing">صادر</option>
                  <option value="incoming">وارد</option>
                </select>
              </div>
              <div>
                <label style={labelStyle()}>نوع الخطاب</label>
                <select value={form.letterType} onChange={(e) => set("letterType", e.target.value)} style={inputStyle()}>
                  <option value="">— اختر —</option>
                  {LETTER_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle()}>التاريخ</label>
                <input type="date" value={form.letterDate} onChange={(e) => set("letterDate", e.target.value)} style={inputStyle()} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle()}>الموضوع</label>
              <input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="موضوع الخطاب" style={inputStyle()} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={labelStyle()}>نص الخطاب</label>
              <button
                type="button" onClick={() => setShowTemplates(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, background: "white", border: `1px solid ${G}88`, color: GD, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                <FileText size={12} /> اختر قالباً
              </button>
            </div>

            {/* toolbar */}
            {editor && (
              <div style={{ display: "flex", gap: 6, padding: "6px 8px", border: "1px solid #e5e7eb", borderBottom: "none", borderRadius: "10px 10px 0 0", background: "#fafafa" }}>
                {toolbarBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold size={13} />, "غامق")}
                {toolbarBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={13} />, "مائل")}
                {toolbarBtn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={13} />, "تحته خط")}
                <div style={{ width: 1, background: "#e5e7eb", margin: "2px 4px" }} />
                <select
                  title="نوع الخط"
                  value={editor.getAttributes("textStyle").fontFamily ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) editor.chain().focus().setFontFamily(val).run();
                    else editor.chain().focus().unsetFontFamily().run();
                  }}
                  style={{ height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 11.5, padding: "0 4px", cursor: "pointer" }}
                >
                  {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                </select>
                <select
                  title="حجم الخط"
                  value={editor.getAttributes("textStyle").fontSize ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) editor.chain().focus().setFontSize(val).run();
                    else editor.chain().focus().unsetFontSize().run();
                  }}
                  style={{ height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 11.5, padding: "0 4px", cursor: "pointer" }}
                >
                  <option value="">الحجم الافتراضي</option>
                  {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ width: 1, background: "#e5e7eb", margin: "2px 4px" }} />
                {toolbarBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List size={13} />, "قائمة نقطية")}
                {toolbarBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={13} />, "قائمة مرقمة")}
                <div style={{ width: 1, background: "#e5e7eb", margin: "2px 4px" }} />
                {toolbarBtn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), <AlignRight size={13} />, "محاذاة يمين")}
                {toolbarBtn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), <AlignCenter size={13} />, "توسيط")}
                <div style={{ width: 1, background: "#e5e7eb", margin: "2px 4px" }} />
                {toolbarBtn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <TableIcon size={13} />, "إدراج جدول")}
                {toolbarBtn(false, handleImagePick, uploadingImage ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <ImageIcon size={13} />, "إدراج صورة (توقيع/ختم)")}
              </div>
            )}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "0 0 10px 10px", padding: "14px 16px", minHeight: 280, background: "#fdfbf6" }}>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Right: sidebar meta + attachments */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle()}>الجهة الحكومية</label>
              <select value={form.governmentEntityId ?? ""} onChange={(e) => setForm(f => ({ ...f, governmentEntityId: e.target.value ? Number(e.target.value) : null, departmentId: null, contactId: null }))} style={inputStyle()}>
                <option value="">— بدون —</option>
                {entities.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {entityName && <p style={{ fontSize: 10.5, color: "#9ca3af", margin: "4px 0 0" }}>يحدد بادئة ترقيم الخطاب</p>}
            </div>
            {form.governmentEntityId && (
              <div>
                <label style={labelStyle()}>الاختصاص</label>
                <select value={form.departmentId ?? ""} onChange={(e) => setForm(f => ({ ...f, departmentId: e.target.value ? Number(e.target.value) : null, contactId: null }))} style={inputStyle()}>
                  <option value="">— بدون —</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {form.departmentId && (
              <div>
                <label style={labelStyle()}>المسؤول</label>
                <select value={form.contactId ?? ""} onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const contact = contacts.find((c: any) => c.id === id);
                  setForm(f => ({
                    ...f, contactId: id,
                    attentionLine: contact && f.direction === "outgoing" && !f.attentionLine ? `${contact.name}${contact.role ? " — " + contact.role : ""}` : f.attentionLine,
                  }));
                }} style={inputStyle()}>
                  <option value="">— بدون —</option>
                  {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ""}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle()}>{form.direction === "outgoing" ? "المرسل إليه" : "المرسل"}</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={form.direction === "outgoing" ? form.recipientName : form.senderName}
                  onChange={(e) => set(form.direction === "outgoing" ? "recipientName" : "senderName", e.target.value)}
                  style={{ ...inputStyle(), flex: 1 }}
                />
                {form.direction === "outgoing" && (
                  <select value={form.recipientHonorific} onChange={(e) => set("recipientHonorific", e.target.value)}
                    title="لقب المخاطبة" style={{ ...inputStyle(), width: 110, cursor: "pointer" }}>
                    <option value="المحترمين">المحترمين</option>
                    <option value="المحترم">المحترم</option>
                    <option value="المحترمة">المحترمة</option>
                  </select>
                )}
              </div>
            </div>
            {form.direction === "outgoing" && (
              <div>
                <label style={labelStyle()}>عناية (توجيه إضافي)</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={form.attentionLine} onChange={(e) => set("attentionLine", e.target.value)} placeholder="مثال: السيد/ فلان الفلاني" style={{ ...inputStyle(), flex: 1 }} />
                  <select value={form.attentionHonorific} onChange={(e) => set("attentionHonorific", e.target.value)}
                    title="لقب المخاطبة" style={{ ...inputStyle(), width: 110, cursor: "pointer" }}>
                    <option value="المحترمين">المحترمين</option>
                    <option value="المحترم">المحترم</option>
                    <option value="المحترمة">المحترمة</option>
                  </select>
                </div>
              </div>
            )}
            <div>
              <label style={labelStyle()}>اسم الشركة (التوقيع)</label>
              <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="المجموعة العربية للخدمات التعليمية" style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>رقم إشارة الطرف الآخر</label>
              <input value={form.referenceNumber} onChange={(e) => set("referenceNumber", e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>الموعد النهائي للرد</label>
              <input type="date" value={form.deadlineDate} onChange={(e) => set("deadlineDate", e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>الموظف المسؤول</label>
              <input value={form.responsibleEmployee} onChange={(e) => set("responsibleEmployee", e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>ملاحظات</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ ...inputStyle(), resize: "vertical" }} />
            </div>

            {savedLetterId && (
              <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
                <AttachmentsPanel letterId={savedLetterId} />
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
          {isEdit && !isCancelled && (
            <button
              onClick={() => { if (confirm("هل تريد إلغاء هذا الخطاب؟ لن يمكن التراجع عن الإلغاء.")) cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}
              style={{ ...footerBtnStyle("outline"), color: "#dc2626", borderColor: "#dc262688", marginLeft: "auto" }}
            >
              {cancelMutation.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Ban size={13} />} إلغاء الخطاب
            </button>
          )}
          <button onClick={handlePrint} style={footerBtnStyle("outline")}><Printer size={13} /> طباعة</button>
          <button onClick={() => handleExportDocx(false)} style={footerBtnStyle("outline")}><FileDown size={13} /> تصدير Word</button>
          <button onClick={handlePrint} style={footerBtnStyle("outline")}><FileDown size={13} /> تصدير PDF</button>
          {isFinalized && (
            <>
              <button onClick={handleFinalPrint} title="النسخة النهائية الكاملة برقم الكتاب على جانب الصفحة"
                style={{ ...footerBtnStyle("outline"), background: "#f0fdf4", borderColor: "#16a34a88", color: "#166534" }}>
                <BadgeCheck size={13} /> النسخة النهائية (PDF)
              </button>
              <button onClick={() => handleExportDocx(true)} title="النسخة النهائية الكاملة برقم الكتاب"
                style={{ ...footerBtnStyle("outline"), background: "#f0fdf4", borderColor: "#16a34a88", color: "#166534" }}>
                <BadgeCheck size={13} /> النسخة النهائية (Word)
              </button>
            </>
          )}
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isCancelled} style={footerBtnStyle("secondary")}>
            {saveMutation.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />} حفظ كمسودة
          </button>
          <button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || isCancelled} style={footerBtnStyle("primary")}>
            {sendMutation.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />} إرسال
          </button>
        </div>
      </div>

      {linkPromptLetter && (
        <LinkLetterPrompt
          letterId={linkPromptLetter.id}
          letterNumber={linkPromptLetter.number}
          onDone={() => { setLinkPromptLetter(null); onSaved(); }}
        />
      )}
    </div>
  );
}

function footerBtnStyle(variant: "primary" | "secondary" | "outline"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit", border: "none",
  };
  if (variant === "primary") return { ...base, background: `linear-gradient(135deg, ${G}, ${GD})`, color: "white" };
  if (variant === "secondary") return { ...base, background: "#f3f4f6", color: GR };
  return { ...base, background: "white", color: GD, border: `1px solid ${G}88` };
}
