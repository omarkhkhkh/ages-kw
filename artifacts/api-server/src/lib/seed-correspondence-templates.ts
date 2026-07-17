import { sql } from "drizzle-orm";
import { db, correspondenceTemplatesTable } from "@workspace/db";
import { logger } from "./logger";

function paragraphDoc(lines: string[]) {
  return JSON.stringify({
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  });
}

// Body-only content: the reference/date header, recipient block ("السادة ... المحترمين"),
// greeting, centered underlined subject, and closing signature are all rendered
// automatically by print-letter.ts / docx-export.ts around this content — so templates
// hold only the actual message paragraph(s), matching the company's standard letter shape.
const SYSTEM_TEMPLATES: { name: string; category: string; lines: string[] }[] = [
  {
    name: "طلب عرض سعر",
    category: "quote_request",
    lines: [
      "بالإشارة الى الموضوع اعلاه، نفيدكم بأننا نرغب في الحصول على عرض أسعاركم الخاص بمشروع {{projectName}}، وذلك في أقرب وقت ممكن، راجين موافاتنا بالعرض وفق الأصناف والمواصفات المطلوبة.",
    ],
  },
  {
    name: "خطاب استفسار",
    category: "inquiry",
    lines: [
      "بالإشارة الى الموضوع اعلاه، نأمل منكم التكرم بالإفادة حول الموضوع المشار إليه أعلاه، وذلك حسب رقم المناقصة {{tenderNumber}}، وفق الأنظمة المتبعة.",
    ],
  },
  {
    name: "طلب تمديد",
    category: "extension_request",
    lines: [
      "بالإشارة الى الموضوع اعلاه، نأمل منكم التكرم بالموافقة على تمديد المدة المحددة لمشروع {{projectName}} لضمان استكمال الأعمال وفق المواصفات المطلوبة ضمن وثائق الممارسة.",
    ],
  },
  {
    name: "خطاب اعتماد",
    category: "approval",
    lines: [
      "بالإشارة الى الموضوع اعلاه، نفيدكم باعتماد الموضوع المشار إليه أعلاه، والمتعلق بمشروع {{projectName}}، راجين اتخاذ ما يلزم من إجراءات وفق الأنظمة المتبعة.",
    ],
  },
  {
    name: "خطاب اعتذار",
    category: "apology",
    lines: [
      "بالإشارة الى الموضوع اعلاه، نتقدم لسيادتكم باعتذارنا عن الموضوع المشار إليه أعلاه، آملين تفهمكم للظروف المحيطة، ونؤكد حرصنا الدائم على حسن التعاون معكم.",
    ],
  },
  {
    name: "خطاب شكر",
    category: "thanks",
    lines: [
      "بالإشارة الى الموضوع اعلاه، يسعدنا أن نتقدم لسيادتكم بجزيل الشكر والتقدير على حسن تعاونكم معنا بخصوص {{projectName}}.",
    ],
  },
  {
    name: "دعوة اجتماع",
    category: "meeting_invitation",
    lines: [
      "بالإشارة الى الموضوع اعلاه، يسرنا دعوتكم لحضور اجتماع بخصوص {{projectName}} في التاريخ والمكان اللذين سيتم تحديدهما لاحقاً، راجين تأكيد الحضور.",
    ],
  },
  {
    name: "طلب توريد",
    category: "supply_request",
    lines: [
      "بالإشارة الى الموضوع اعلاه، نأمل منكم التكرم بتوريد الأصناف والمواد اللازمة لمشروع {{projectName}} في أقرب وقت ممكن، وذلك وفقاً للأصناف والمواصفات المطلوبة ضمن وثائق الممارسة.",
    ],
  },
  {
    name: "أمر شراء",
    category: "purchase_order",
    lines: [
      "بالإشارة الى الموضوع اعلاه، وبناءً على الاتفاق المسبق، نفيدكم بإصدار أمر الشراء الخاص بمشروع {{projectName}}، راجين التكرم بالتوريد وفق الشروط والمواصفات المتفق عليها.",
    ],
  },
  {
    name: "مطالبة مالية",
    category: "financial_claim",
    lines: [
      "بالإشارة الى الموضوع اعلاه، نأمل منكم التكرم بصرف المستحقات المالية المتعلقة بمشروع {{projectName}} في أقرب وقت ممكن، وذلك وفق الأنظمة المتبعة.",
    ],
  },
];

/**
 * Idempotently seeds the 10 built-in correspondence letter templates on first server boot.
 * Safe to call on every startup — no-ops once system templates already exist.
 */
export async function ensureSystemCorrespondenceTemplates(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(correspondenceTemplatesTable)
    .where(sql`is_system = true`);

  if (count > 0) return;

  await db.insert(correspondenceTemplatesTable).values(
    SYSTEM_TEMPLATES.map((t) => ({
      name: t.name,
      category: t.category,
      bodyJson: paragraphDoc(t.lines),
      isSystem: true,
    })),
  );

  logger.info({ count: SYSTEM_TEMPLATES.length }, "Seeded system correspondence templates");
}
