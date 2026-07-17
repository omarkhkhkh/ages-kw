import {
  Clock, AlertCircle, AlertTriangle, ChevronDown, Flame,
} from "lucide-react";

export const G  = "#D4A534";
export const GD = "#A87C20";
export const GR = "#0b1a10";

export interface OpTask {
  id: number; title: string; taskType: string | null; taskTypeId: number | null; taskTypeName: string | null;
  description: string | null;
  priority: string; status: string;
  assignedTo: number | null; requestedBy: number | null; createdBy: number | null;
  linkedEntityType: string | null; linkedEntityId: number | null;
  startDate: string | null; dueDate: string | null;
  expectedDurationHours: string | null; actualTimeHours: string | null;
  progressPercent: number; budget: string | null; actualCost: string | null;
  qualityRating: number | null; sourceType: string | null;
  recurringTemplateId: number | null;
  proofType: "none" | "file" | "note";
  isArchived: boolean;
  completedAt: string | null;
  employeeNotes: string | null; notesUpdatedAt: string | null; notesReadByAdmin: boolean;
  createdAt: string; updatedAt: string;
  assigneeName: string | null; creatorName: string | null; requesterName: string | null;
}

export const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  low:      { label: "منخفضة", color: "#6b7280", bg: "#f9fafb", icon: ChevronDown },
  medium:   { label: "متوسطة", color: "#d97706", bg: "#fffbeb", icon: Clock },
  high:     { label: "عالية",  color: "#dc2626", bg: "#fff1f2", icon: AlertCircle },
  urgent:   { label: "عاجلة",  color: "#7c3aed", bg: "#f5f3ff", icon: AlertTriangle },
  critical: { label: "حرجة",   color: "#be123c", bg: "#fff1f2", icon: Flame },
};

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:            { label: "جديدة",                color: "#d97706", bg: "#fffbeb" },
  under_review:       { label: "قيد المراجعة",          color: "#0891b2", bg: "#ecfeff" },
  in_progress:        { label: "قيد التنفيذ",           color: "#2563eb", bg: "#eff6ff" },
  awaiting_reply:     { label: "بانتظار الرد",          color: "#a16207", bg: "#fefce8" },
  awaiting_external:  { label: "بانتظار جهة خارجية",    color: "#b45309", bg: "#fff7ed" },
  blocked:            { label: "متوقفة",                color: "#dc2626", bg: "#fff1f2" },
  needs_approval:     { label: "تحتاج اعتماد",           color: "#7c3aed", bg: "#f5f3ff" },
  completed:          { label: "مكتملة ✓",               color: "#16a34a", bg: "#f0fdf4" },
  cancelled:          { label: "ملغاة",                  color: "#6b7280", bg: "#f9fafb" },
};

export const STATUS_ORDER = [
  "pending", "under_review", "in_progress", "awaiting_reply", "awaiting_external",
  "blocked", "needs_approval", "completed", "cancelled",
];

export const LINKED_ENTITY_LABELS: Record<string, string> = {
  tender: "مناقصة", practice: "ممارسة", contract: "عقد", governmentEntity: "جهة حكومية",
  supplier: "مورد", project: "مشروع", purchaseOrder: "أمر شراء", vehicle: "مركبة",
  correspondence: "مراسلة", maintenanceWorkOrder: "أمر صيانة", rfq: "طلب عرض سعر",
  bankGuarantee: "ضمان بنكي", governmentRegistration: "تسجيل جهة", transportationOrder: "أمر نقل",
  company: "شركة",
};

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ar-KW", { year: "numeric", month: "short", day: "numeric" }) : "—";

export const badge = (label: string, color: string, bg: string) => ({
  padding: "3px 10px", borderRadius: 10, background: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const,
});

export function isOverdue(task: OpTask) {
  return !!task.dueDate && task.status !== "completed" && task.status !== "cancelled" && new Date(task.dueDate) < new Date();
}
