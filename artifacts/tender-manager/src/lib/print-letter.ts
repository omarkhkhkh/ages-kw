import { generateHTML } from "@tiptap/core";
import { tiptapExtensions } from "./tiptap-extensions";

const DEFAULT_COMPANY_NAME = "المجموعة العربية للخدمات التعليمية";

interface PrintableLetter {
  letterNumber: string;
  subject: string;
  letterDate: string;
  direction?: "outgoing" | "incoming";
  recipientName?: string | null;
  attentionLine?: string | null;
  senderName?: string | null;
  companyName?: string | null;
  bodyJson?: string | null;
  bodyHtml?: string | null;
  /** النسخة النهائية المصدَّرة: يُطبع رقم الكتاب عموديًا على حافة الصفحة (بدون تاريخ) */
  finalNumbered?: boolean;
}

/**
 * Opens a standalone popup window with the letter rendered in the company's
 * standard formal-letter shape ("السادة ... المحترمين" recipient block, greeting,
 * centered underlined subject, body, closing phrases, left-aligned signature) and
 * triggers the browser print dialog. Isolated from the app's own CSS — used for
 * both "طباعة" and "تصدير PDF" (print-to-PDF via the browser).
 */
/** Tiered spacing so a one-line letter doesn't look like a stranded paragraph on an
 *  otherwise-empty page, while a long letter stays compact instead of overflowing. */
function spacingForWordCount(words: number) {
  if (words < 40) {
    return { subjectMargin: "34px 0 40px", bodyLineHeight: 2.3, bodyPMargin: "20px 0", closingMarginTop: "76px", signatureMarginTop: "54px", greetingMargin: "22px 0" };
  }
  if (words > 150) {
    return { subjectMargin: "16px 0", bodyLineHeight: 1.6, bodyPMargin: "6px 0", closingMarginTop: "18px", signatureMarginTop: "20px", greetingMargin: "10px 0" };
  }
  return { subjectMargin: "22px 0", bodyLineHeight: 1.9, bodyPMargin: "8px 0", closingMarginTop: "30px", signatureMarginTop: "34px", greetingMargin: "14px 0" };
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

/** تاريخ الكتاب بصيغة DD/MM/YYYY كما في نموذج الشركة المعتمد */
function formatLetterDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function printLetter(letter: PrintableLetter) {
  let bodyHtml = letter.bodyHtml ?? "";
  if (letter.bodyJson) {
    try {
      bodyHtml = generateHTML(JSON.parse(letter.bodyJson), tiptapExtensions);
    } catch {
      // fall back to cached bodyHtml if bodyJson fails to parse
    }
  }

  const spacing = spacingForWordCount(countWords(bodyHtml));
  const isOutgoing = letter.direction !== "incoming";
  const recipientLine = isOutgoing && letter.recipientName
    ? `<p class="recipient"><span>السادة: ${escapeHtml(letter.recipientName)}</span><span class="honorific">المحترمين</span></p>`
    : !isOutgoing && letter.senderName
      ? `<p class="recipient"><span>من: ${escapeHtml(letter.senderName)}</span></p>`
      : "";
  const attentionLine = isOutgoing && letter.attentionLine
    ? `<p class="recipient attention"><span>${escapeHtml(letter.attentionLine)}</span><span class="honorific">المحترمين</span></p>`
    : "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(letter.letterNumber)}</title>
<style>
  /* هامش الصفحة صفر يمنع المتصفح من طباعة ترويسته (التاريخ/الوقت والعنوان والرابط)
     — والهوامش الفعلية للكتاب تُطبق عبر padding على الـbody */
  @page { size: letter; margin: 0; }
  /* خط الكتاب الرسمي — نفس خطوط نموذج الشركة (Arabic Typesetting/Aldhabi) مع بدائل */
  body { font-family: 'Arabic Typesetting', 'Traditional Arabic', 'Aldhabi', 'Cairo', serif; color: #1a1a1a; direction: rtl; font-size: 14pt; margin: 0; padding: 2.2cm 2.5cm; }
  /* رأس الكتاب: المرجع أعلى اليمين والتاريخ أعلى اليسار على نفس السطر */
  .ref-row { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 16px; font-size: 14pt; font-weight: 600; }
  .recipient { font-size: 16pt; font-weight: 800; margin: 4px 0 0; display: flex; justify-content: space-between; align-items: baseline; }
  .honorific { margin-right: 24px; }
  .attention { font-size: 15pt; }
  .greeting { font-weight: 800; font-size: 16pt; margin: ${spacing.greetingMargin}; }
  h1.subject { font-size: 15pt; font-weight: 800; text-decoration: underline; text-align: center; margin: ${spacing.subjectMargin}; }
  .body { font-weight: 700; font-size: 12.5pt; }
  .body table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  .body table td, .body table th { border: 1px solid #ccc; padding: 6px 10px; }
  .body p { line-height: ${spacing.bodyLineHeight}; margin: ${spacing.bodyPMargin}; text-align: justify; }
  .body img { max-width: 220px; margin-top: 24px; }
  .closing { text-align: center; font-weight: 800; font-size: 14pt; margin: ${spacing.closingMarginTop} 0 10px; }
  .closing p { margin: 4px 0; }
  .signature { margin-top: ${spacing.signatureMarginTop}; font-weight: 800; font-size: 13pt; text-align: left; }
</style>
</head>
<body>
  <div class="ref-row">
    <span>مرجع رقم : ${escapeHtml(letter.letterNumber)}</span>
    <span>التاريخ: ${escapeHtml(formatLetterDate(letter.letterDate))}</span>
  </div>
  ${recipientLine}
  ${attentionLine}
  <p class="greeting">تحية طيبة وبعد ،،،،،</p>
  <h1 class="subject">الموضوع / ${escapeHtml(letter.subject)}</h1>
  <div class="body">${bodyHtml}</div>
  <div class="closing">
    <p>شاكرين لكم حسن تعاونكم معنا</p>
    <p>وتفضلوا بقبول فائق التحية</p>
  </div>
  <div class="signature">${escapeHtml(letter.companyName?.trim() || DEFAULT_COMPANY_NAME)}</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
