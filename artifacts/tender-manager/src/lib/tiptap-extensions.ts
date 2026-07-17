import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { Extension, Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    reportToken: {
      insertReportToken: (token: string) => ReturnType;
    };
  }
}

// Tiptap ships no built-in font-size control — this adds a `fontSize` attribute
// to the same `textStyle` mark FontFamily uses, rendered as inline CSS so it
// round-trips through generateHTML() (print) and the docx exporter alike.
type FontSizeOptions = { types: string[] };

const FontSize = Extension.create<FontSizeOptions>({
  name: "fontSize",

  addOptions() {
    return { types: ["textStyle"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => {
        return chain().setMark("textStyle", { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
      },
    };
  },
});

// Atomic merge-field node for report templates — a "{{Token}}" placeholder that
// can never be split or partially formatted (unlike plain text), so it always
// survives intact into docx generation. Renders as a distinguishable badge.
const ReportToken = Node.create({
  name: "reportToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      token: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-report-token]",
        getAttrs: (el) => ({ token: (el as HTMLElement).getAttribute("data-report-token") || "" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-report-token": node.attrs.token,
        style: "background:#fdf3d8;color:#a87c20;border:1px solid #eadfb8;border-radius:6px;padding:1px 6px;font-family:monospace;font-size:0.9em;white-space:nowrap;",
      }),
      `{{${node.attrs.token}}}`,
    ];
  },

  addCommands() {
    return {
      insertReportToken: (token: string) => ({ chain }: any) => {
        return chain().insertContent({ type: this.name, attrs: { token } }).run();
      },
    };
  },
});

// Shared extension set used by both the live editor (letter-editor.tsx) and the
// print/PDF renderer (print-letter.ts) via generateHTML() — must stay identical
// so printed output matches what the editor shows.
export const tiptapExtensions = [
  StarterKit,
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  Image,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  TextStyle,
  FontFamily,
  FontSize,
  ReportToken,
];

export const FONT_FAMILIES = [
  { label: "الخط الافتراضي", value: "" },
  { label: "Cairo", value: "Cairo, sans-serif" },
  { label: "IBM Plex Sans Arabic", value: "'IBM Plex Sans Arabic', sans-serif" },
  { label: "Traditional Arabic", value: "'Traditional Arabic', serif" },
  { label: "Simplified Arabic", value: "'Simplified Arabic', serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
];

export const FONT_SIZES = ["10pt", "11pt", "12pt", "13pt", "14pt", "16pt", "18pt", "20pt", "24pt"];
