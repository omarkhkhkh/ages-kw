import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, ImageRun, WidthType,
} from "docx";

const DEFAULT_COMPANY_NAME = "المجموعة العربية للخدمات التعليمية";

interface DocxLetter {
  letterNumber: string;
  subject: string;
  letterDate: string;
  direction?: "outgoing" | "incoming";
  recipientName?: string | null;
  attentionLine?: string | null;
  senderName?: string | null;
  companyName?: string | null;
  bodyJson?: string | null;
}

type TiptapMark = { type: string; attrs?: Record<string, any> };
type TiptapNode = { type: string; attrs?: any; content?: TiptapNode[]; text?: string; marks?: TiptapMark[] };

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/** "'IBM Plex Sans Arabic', sans-serif" -> "IBM Plex Sans Arabic" (docx wants a single font name). */
function primaryFontName(cssFontFamily: string): string {
  return cssFontFamily.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

/** "12pt" -> 24 (docx TextRun.size is in half-points). */
function fontSizeToHalfPoints(cssFontSize: string): number | undefined {
  const pt = parseFloat(cssFontSize);
  return Number.isFinite(pt) ? Math.round(pt * 2) : undefined;
}

function textRunsFromInline(nodes: TiptapNode[] | undefined): TextRun[] {
  if (!nodes) return [];
  const runs: TextRun[] = [];
  for (const n of nodes) {
    if (n.type !== "text" || !n.text) continue;
    const marks = new Set((n.marks ?? []).map((m) => m.type));
    const textStyleMark = (n.marks ?? []).find((m) => m.type === "textStyle");
    const fontFamily = textStyleMark?.attrs?.fontFamily as string | undefined;
    const fontSize = textStyleMark?.attrs?.fontSize as string | undefined;
    runs.push(new TextRun({
      text: n.text,
      bold: marks.has("bold"),
      italics: marks.has("italic"),
      underline: marks.has("underline") ? {} : undefined,
      font: fontFamily ? primaryFontName(fontFamily) : undefined,
      size: fontSize ? fontSizeToHalfPoints(fontSize) : undefined,
    }));
  }
  return runs;
}

function alignmentFor(attrs: any): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (attrs?.textAlign) {
    case "center": return AlignmentType.CENTER;
    case "left": return AlignmentType.LEFT;
    case "right": return AlignmentType.RIGHT;
    default: return undefined;
  }
}

function countWordsInTiptap(node: TiptapNode): number {
  let count = 0;
  if (node.type === "text" && node.text) count += node.text.trim().split(/\s+/).filter(Boolean).length;
  for (const child of node.content ?? []) count += countWordsInTiptap(child);
  return count;
}

/** Same tiering idea as print-letter.ts: short letters get looser paragraph spacing
 *  and extra breathing room before the closing, long letters stay compact. */
function docxSpacingForWordCount(words: number) {
  if (words < 40) return { before: 200, after: 200, extraBlankParagraphs: 3 };
  if (words > 150) return { before: 40, after: 40, extraBlankParagraphs: 0 };
  return { before: 100, after: 100, extraBlankParagraphs: 1 };
}

async function nodesToParagraphsAndTables(nodes: TiptapNode[], paraSpacing?: { before: number; after: number }): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        out.push(new Paragraph({
          children: textRunsFromInline(node.content),
          alignment: alignmentFor(node.attrs),
          bidirectional: true,
          spacing: paraSpacing,
        }));
        break;

      case "heading": {
        const level = node.attrs?.level ?? 1;
        const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
        };
        out.push(new Paragraph({
          heading: headingMap[level] ?? HeadingLevel.HEADING_1,
          children: textRunsFromInline(node.content),
          alignment: alignmentFor(node.attrs),
          bidirectional: true,
        }));
        break;
      }

      case "bulletList":
      case "orderedList": {
        const items = node.content ?? [];
        items.forEach((item, i) => {
          const prefix = node.type === "bulletList" ? "• " : `${i + 1}. `;
          const firstPara = item.content?.find((c) => c.type === "paragraph");
          out.push(new Paragraph({
            children: [new TextRun({ text: prefix }), ...textRunsFromInline(firstPara?.content)],
            bidirectional: true,
          }));
        });
        break;
      }

      case "table": {
        const rows: TableRow[] = [];
        for (const rowNode of node.content ?? []) {
          const cells: TableCell[] = [];
          for (const cellNode of rowNode.content ?? []) {
            const cellParas = await nodesToParagraphsAndTables(cellNode.content ?? []);
            cells.push(new TableCell({
              children: cellParas.filter((c): c is Paragraph => c instanceof Paragraph),
              width: { size: 100 / (rowNode.content?.length || 1), type: WidthType.PERCENTAGE },
            }));
          }
          rows.push(new TableRow({ children: cells }));
        }
        out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        break;
      }

      case "image": {
        const buf = node.attrs?.src ? await fetchAsArrayBuffer(node.attrs.src) : null;
        if (buf) {
          out.push(new Paragraph({
            children: [new ImageRun({ data: buf, transformation: { width: 160, height: 80 }, type: "png" })],
          }));
        }
        break;
      }

      default:
        break;
    }
  }

  return out;
}

/**
 * Builds a .docx Blob for a letter in the company's standard formal-letter shape:
 * "السادة ... المحترمين" recipient block (+ optional "عناية" attention line),
 * greeting, centered underlined subject, body, closing phrases, and a
 * left-aligned signature block with a manually-entered company name.
 */
export async function buildLetterDocx(letter: DocxLetter): Promise<Blob> {
  const bodyDoc: TiptapNode = letter.bodyJson ? JSON.parse(letter.bodyJson) : { type: "doc", content: [] };
  const spacing = docxSpacingForWordCount(countWordsInTiptap(bodyDoc));
  const bodyChildren = await nodesToParagraphsAndTables(bodyDoc.content ?? [], { before: spacing.before, after: spacing.after });
  const isOutgoing = letter.direction !== "incoming";

  const headerChildren: Paragraph[] = [];

  if (isOutgoing && letter.recipientName) {
    headerChildren.push(new Paragraph({
      children: [new TextRun({ text: `السادة: ${letter.recipientName}`, bold: true, size: 26 }), new TextRun({ text: "          المحترمين", bold: true, size: 26 })],
      bidirectional: true,
    }));
  } else if (!isOutgoing && letter.senderName) {
    headerChildren.push(new Paragraph({ children: [new TextRun({ text: `من: ${letter.senderName}`, bold: true, size: 26 })], bidirectional: true }));
  }

  if (isOutgoing && letter.attentionLine) {
    headerChildren.push(new Paragraph({
      children: [new TextRun({ text: `عناية: ${letter.attentionLine}`, bold: true, size: 24 }), new TextRun({ text: "          المحترم", bold: true, size: 24 })],
      bidirectional: true,
    }));
  }

  headerChildren.push(
    new Paragraph({ children: [new TextRun({ text: "تحية طيبة وبعد ،،،،،", bold: true, size: 26 })], bidirectional: true }),
    new Paragraph({
      children: [new TextRun({ text: `الموضوع / ${letter.subject}`, bold: true, size: 26, underline: {} })],
      alignment: AlignmentType.CENTER, bidirectional: true,
    }),
    new Paragraph({ text: "" }),
  );

  const closingChildren = [
    ...Array.from({ length: 1 + spacing.extraBlankParagraphs }, () => new Paragraph({ text: "" })),
    new Paragraph({ children: [new TextRun({ text: "شاكرين لكم حسن تعاونكم معنا", bold: true })], alignment: AlignmentType.CENTER, bidirectional: true }),
    new Paragraph({ children: [new TextRun({ text: "وتفضلوا بقبول فائق التحية", bold: true })], alignment: AlignmentType.CENTER, bidirectional: true }),
    new Paragraph({ text: "" }),
    new Paragraph({ children: [new TextRun({ text: letter.companyName?.trim() || DEFAULT_COMPANY_NAME, bold: true })], alignment: AlignmentType.LEFT, bidirectional: true }),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [...headerChildren, ...bodyChildren, ...closingChildren],
    }],
  });

  return Packer.toBlob(doc);
}

/** Triggers a browser download of a Blob with the given filename. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
