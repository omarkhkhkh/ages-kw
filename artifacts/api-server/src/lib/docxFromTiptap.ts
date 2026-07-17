import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

type TiptapMark = { type: string; attrs?: Record<string, any> };
type TiptapNode = { type: string; attrs?: any; content?: TiptapNode[]; text?: string; marks?: TiptapMark[] };

/** "'IBM Plex Sans Arabic', sans-serif" -> "IBM Plex Sans Arabic" (docx wants a single font name). */
function primaryFontName(cssFontFamily: string): string {
  return cssFontFamily.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

/** "12pt" -> 24 (docx TextRun.size is in half-points). */
function fontSizeToHalfPoints(cssFontSize: string): number | undefined {
  const pt = parseFloat(cssFontSize);
  return Number.isFinite(pt) ? Math.round(pt * 2) : undefined;
}

/**
 * Converts a paragraph's inline Tiptap nodes to docx TextRuns. `reportToken`
 * nodes are substituted with their real value here — since each token is a
 * single atomic Tiptap node (never split across marks), the substitution is
 * always whole and correctly formatted; no docxtemplater/run-repair needed.
 */
function textRunsFromInline(nodes: TiptapNode[] | undefined, values: Record<string, string>): TextRun[] {
  if (!nodes) return [];
  const runs: TextRun[] = [];
  for (const n of nodes) {
    if (n.type === "reportToken") {
      const token = n.attrs?.token as string | undefined;
      if (token) runs.push(new TextRun({ text: values[token] ?? "" }));
      continue;
    }
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

function nodesToParagraphs(nodes: TiptapNode[], values: Record<string, string>): Paragraph[] {
  const out: Paragraph[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        out.push(new Paragraph({
          children: textRunsFromInline(node.content, values),
          alignment: alignmentFor(node.attrs),
          bidirectional: true,
        }));
        break;

      case "heading": {
        const level = node.attrs?.level ?? 1;
        const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
        };
        out.push(new Paragraph({
          heading: headingMap[level] ?? HeadingLevel.HEADING_1,
          children: textRunsFromInline(node.content, values),
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
            children: [new TextRun({ text: prefix }), ...textRunsFromInline(firstPara?.content, values)],
            bidirectional: true,
          }));
        });
        break;
      }

      default:
        break;
    }
  }

  return out;
}

/**
 * Builds a .docx Buffer for an in-site-composed report template, substituting
 * `{{Token}}` merge-field nodes with real values as the Tiptap JSON tree is
 * walked (see textRunsFromInline above) — a generalized, boilerplate-free
 * port of the frontend's docx-export.ts conversion logic.
 */
export async function buildTemplateDocx(bodyJson: string, values: Record<string, string>): Promise<Buffer> {
  const bodyDoc: TiptapNode = JSON.parse(bodyJson);
  const bodyChildren = nodesToParagraphs(bodyDoc.content ?? [], values);

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: bodyChildren,
    }],
  });

  return Packer.toBuffer(doc);
}
