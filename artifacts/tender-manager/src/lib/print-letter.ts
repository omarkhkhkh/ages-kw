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
    ? `<p class="recipient">السادة: ${escapeHtml(letter.recipientName)}<span class="honorific">المحترمين</span></p>`
    : !isOutgoing && letter.senderName
      ? `<p class="recipient">من: ${escapeHtml(letter.senderName)}</p>`
      : "";
  const attentionLine = isOutgoing && letter.attentionLine
    ? `<p class="attention">عناية: ${escapeHtml(letter.attentionLine)}<span class="honorific">المحترم</span></p>`
    : "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(letter.letterNumber)}</title>
<style>
  @page { size: letter; margin: 2.2cm 2.5cm; }
  body { font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; color: #1a1a1a; direction: rtl; font-size: 14px; padding-top: 18px; }
  .recipient { font-size: 17px; font-weight: 800; margin: 4px 0 0; }
  .honorific { margin-right: 40px; }
  .attention { font-size: 14px; font-weight: 700; margin: 4px 0 0; }
  .greeting { font-weight: 800; font-size: 16px; margin: ${spacing.greetingMargin}; }
  h1.subject { font-size: 16px; font-weight: 800; text-decoration: underline; text-align: center; margin: ${spacing.subjectMargin}; }
  .body { font-weight: 700; }
  .body table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  .body table td, .body table th { border: 1px solid #ccc; padding: 6px 10px; }
  .body p { line-height: ${spacing.bodyLineHeight}; margin: ${spacing.bodyPMargin}; text-align: justify; }
  .body img { max-width: 220px; margin-top: 24px; }
  .closing { text-align: center; font-weight: 800; margin: ${spacing.closingMarginTop} 0 10px; }
  .closing p { margin: 4px 0; }
  .signature { margin-top: ${spacing.signatureMarginTop}; font-weight: 800; text-align: left; }
</style>
</head>
<body>
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
