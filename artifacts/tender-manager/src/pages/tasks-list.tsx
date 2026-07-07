import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import {
  ClipboardList, Plus, Pencil, Trash2, X, Save,
  CheckCircle2, Clock, AlertCircle, AlertTriangle,
  MessageSquare, User, Calendar, Loader2,
  ChevronDown, ThumbsUp, Flag,
} from "lucide-react";

/* ── Brand ── */
const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#0b1a10";

/* ── Constants ── */
const TASK_TYPES = [
  "مراجعة مستندات", "متابعة عقد", "تسليم مشروع", "إعداد تقرير",
  "اجتماع", "تواصل مع جهة", "تقديم مناقصة", "متابعة ضمان",
  "إعداد عرض سعر", "أمر شراء", "مهمة إدارية", "أخرى",
];
const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  low:    { label: "منخفضة",  color: "#6b7280", bg: "#f9fafb",  icon: ChevronDown },
  medium: { label: "متوسطة",  color: "#d97706", bg: "#fffbeb",  icon: Clock },
  high:   { label: "عالية",   color: "#dc2626", bg: "#fff1f2",  icon: AlertCircle },
  urgent: { label: "عاجلة",   color: "#7c3aed", bg: "#f5f3ff",  icon: AlertTriangle },
};
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: "قيد الانتظار",       color: "#d97706", bg: "#fffbeb" },
  in_progress:      { label: "جارٍ التنفيذ",       color: "#2563eb", bg: "#eff6ff" },
  pending_approval: { label: "في انتظار الموافقة", color: "#7c3aed", bg: "#f5f3ff" },
  completed:        { label: "مكتملة ✓",            color: "#16a34a", bg: "#f0fdf4" },
  cancelled:        { label: "ملغاة",               color: "#6b7280", bg: "#f9fafb" },
};

interface Task {
  id: number; title: string; taskType: string; description: string | null;
  priority: string; status: string; assignedTo: number; createdBy: number;
  dueDate: string | null; completedAt: string | null;
  employeeNotes: string | null; notesUpdatedAt: string | null;
  notesReadByAdmin: boolean; createdAt: string; updatedAt: string;
  assigneeName: string | null; creatorName: string | null;
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ar-KW", { year: "numeric", month: "short", day: "numeric" }) : "—";

const badge = (label: string, color: string, bg: string) => (
  <span style={{ padding: "3px 10px", borderRadius: 10, background: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const }}>{label}</span>
);

/* ════════════════════════════════
   TASK FORM MODAL (admin)
════════════════════════════════ */
interface FormState { title: string; taskType: string; description: string; priority: string; status: string; assignedTo: string; dueDate: string; }
const emptyForm: FormState = { title: "", taskType: "", description: "", priority: "medium", status: "pending", assignedTo: "", dueDate: "" };

function TaskFormModal({ open, editing, onClose, employees }: {
  open: boolean; editing: Task | null;
  onClose: () => void; employees: { id: number; fullName: string }[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => editing ? {
    title: editing.title, taskType: editing.taskType,
    description: editing.description ?? "",
    priority: editing.priority, status: editing.status,
    assignedTo: String(editing.assignedTo), dueDate: editing.dueDate?.slice(0, 10) ?? "",
  } : emptyForm);

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data: any) => editing
      ? apiFetch(`/api/tasks/${editing.id}`, { method: "PATCH", body: JSON.stringify(data) })
      : apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-unread"] }); onClose(); },
  });

  if (!open) return null;

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, background: "#fafaf8", outline: "none", fontFamily: "inherit", color: "#1e2a1e" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)", animation: "fadeIn 0.2s" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 580, background: "white", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,0.3)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "slideUp 0.22s" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `rgba(212,165,52,0.2)`, border: `1px solid rgba(212,165,52,0.35)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={18} color={G} />
            </div>
            <h2 style={{ color: "white", fontSize: 16, fontWeight: 800, margin: 0 }}>{editing ? "تعديل المهمة" : "إضافة مهمة جديدة"}</h2>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Title */}
          <div>
            <label style={lbl}>عنوان المهمة *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="وصف موجز للمهمة" style={inp} />
          </div>

          {/* Type + Priority */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>نوع المهمة *</label>
              <select value={form.taskType} onChange={e => set("taskType", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="">اختر النوع</option>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الأولوية</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Assigned to + Due date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>الموظف المعيّن *</label>
              <select value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="">اختر الموظف</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>تاريخ الاستحقاق</label>
              <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} style={{ ...inp, direction: "ltr" }} />
            </div>
          </div>

          {/* Status (edit only) */}
          {editing && (
            <div>
              <label style={lbl}>الحالة</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label style={lbl}>الوصف التفصيلي</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="تفاصيل المهمة والتعليمات..." style={{ ...inp, resize: "vertical" }} />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button onClick={() => saveMut.mutate({ ...form, assignedTo: Number(form.assignedTo) || undefined, dueDate: form.dueDate || undefined })}
              disabled={saveMut.isPending}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 24px", borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: saveMut.isPending ? "not-allowed" : "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", opacity: saveMut.isPending ? 0.7 : 1 }}>
              {saveMut.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
              {editing ? "حفظ التعديلات" : "إضافة المهمة"}
            </button>
            <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
              إلغاء
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(28px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ════════════════════════════════
   EMPLOYEE NOTES MODAL
════════════════════════════════ */
function NotesModal({ task, onClose, isAdmin }: { task: Task; onClose: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(task.employeeNotes ?? "");

  const saveMut = useMutation({
    mutationFn: () => apiFetch(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ employeeNotes: notes }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-unread"] }); onClose(); },
  });

  const markReadMut = useMutation({
    mutationFn: () => apiFetch(`/api/tasks/${task.id}/mark-notes-read`, { method: "PATCH" }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-unread"] }); },
  });

  // Auto mark read when admin opens a task with unread notes
  useEffect(() => {
    if (isAdmin && !task.notesReadByAdmin && task.employeeNotes) {
      markReadMut.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const pri = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.medium;
  const sta = STATUS_MAP[task.status]     ?? STATUS_MAP.pending;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(11,26,16,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)", animation: "fadeIn 0.2s" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "white", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,0.3)", overflow: "hidden", animation: "slideUp 0.22s" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(212,165,52,0.2)", border: "1px solid rgba(212,165,52,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={18} color={G} />
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: 15, fontWeight: 800, margin: 0 }}>{task.title}</h2>
              <p style={{ color: "rgba(212,165,52,0.55)", fontSize: 11, margin: "2px 0 0" }}>{task.assigneeName} · {task.taskType}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Task meta */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {badge(sta.label, sta.color, sta.bg)}
            {badge(pri.label, pri.color, pri.bg)}
            {task.dueDate && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 10, background: "#f8fafc", color: "#374151", fontSize: 11, fontWeight: 600, border: "1px solid #e2e8f0" }}>
                <Calendar size={11} /> {fmtDate(task.dueDate)}
              </span>
            )}
          </div>

          {/* Task description */}
          {task.description && (
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f9f7f2", border: "1px solid #f0ead8", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              {task.description}
            </div>
          )}

          {/* Notes area */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: GR, marginBottom: 8 }}>
              {isAdmin ? "ملاحظات الموظف" : "ملاحظاتي على المهمة"}
            </label>
            {isAdmin ? (
              <div style={{ padding: "14px 16px", borderRadius: 12, background: task.employeeNotes ? "#f0fdf4" : "#f9fafb", border: `1.5px solid ${task.employeeNotes ? "#bbf7d0" : "#e5e7eb"}`, minHeight: 80, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                {task.employeeNotes || <span style={{ color: "#9ca3af" }}>لم يضع الموظف ملاحظات بعد</span>}
              </div>
            ) : (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={5}
                placeholder="اكتب ملاحظاتك على هذه المهمة هنا... سيراها المدير في قسم الملاحظات."
                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 13, resize: "vertical", fontFamily: "inherit", background: "#fafaf8", color: "#1e2a1e", outline: "none" }}
              />
            )}
          </div>

          {/* Notes timestamp */}
          {task.notesUpdatedAt && (
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
              آخر تحديث: {fmtDate(task.notesUpdatedAt)}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            {!isAdmin && (
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: saveMut.isPending ? "not-allowed" : "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", opacity: saveMut.isPending ? 0.7 : 1 }}>
                {saveMut.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                حفظ الملاحظة
              </button>
            )}
            <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#f9fafb", border: "1.5px solid #e5e7eb", color: "#374151", fontFamily: "inherit" }}>
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   TASK CARD
════════════════════════════════ */
function TaskCard({ task, isAdmin, onEdit, onDelete, onNotes, onMarkDone, onApprove }: {
  task: Task; isAdmin: boolean;
  onEdit: () => void; onDelete: () => void; onNotes: () => void;
  onMarkDone: () => void; onApprove: () => void;
}) {
  const pri = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.medium;
  const sta = STATUS_MAP[task.status]     ?? STATUS_MAP.pending;
  const PriIcon = pri.icon;

  const isOverdue = task.dueDate && task.status !== "completed" && task.status !== "cancelled"
    && new Date(task.dueDate) < new Date();

  const isPendingApproval = task.status === "pending_approval";
  const isActive = task.status === "pending" || task.status === "in_progress";
  const isCompleted = task.status === "completed";

  const borderColor = isPendingApproval ? "#c4b5fd" : isOverdue ? "#fecaca" : isCompleted ? "#bbf7d0" : "#f0ead8";
  const shadowColor = isPendingApproval ? "rgba(124,58,237,0.10)" : isOverdue ? "rgba(220,38,38,0.08)" : "rgba(0,0,0,0.05)";

  return (
    <div style={{ background: isCompleted ? "#fafffe" : isPendingApproval ? "#fdfcff" : "white", borderRadius: 16, border: `1.5px solid ${borderColor}`, boxShadow: `0 2px 14px ${shadowColor}`, overflow: "hidden", transition: "transform 0.12s, box-shadow 0.12s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 14px ${shadowColor}`; }}>

      {/* Priority stripe — purple for pending_approval, green for completed */}
      <div style={{ height: 4, background: isPendingApproval ? "linear-gradient(90deg,#7c3aed,#c4b5fd)" : isCompleted ? "linear-gradient(90deg,#16a34a,#86efac)" : `linear-gradient(90deg,${pri.color},${pri.color}44)` }} />

      <div style={{ padding: "16px 18px" }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>{task.title}</span>
              {/* Pending approval badge */}
              {isPendingApproval && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 8, background: "#f5f3ff", color: "#7c3aed", fontSize: 11, fontWeight: 700, border: "1px solid #ddd6fe" }}>
                  <Flag size={10} /> في انتظار الموافقة
                </span>
              )}
              {/* Unread notes badge */}
              {isAdmin && !task.notesReadByAdmin && task.employeeNotes && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 8, background: "#fef9c3", color: "#b45309", fontSize: 11, fontWeight: 700, border: "1px solid #fde68a" }}>
                  <MessageSquare size={10} /> ملاحظة جديدة
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {badge(sta.label, sta.color, sta.bg)}
              <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 10, background: pri.bg, color: pri.color, fontSize: 11, fontWeight: 700 }}>
                <PriIcon size={10} /> {pri.label}
              </span>
              <span style={{ padding: "3px 10px", borderRadius: 10, background: "#f1f5f9", color: "#475569", fontSize: 11, fontWeight: 600 }}>{task.taskType}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={onNotes} title={isAdmin ? "عرض الملاحظات" : "ملاحظاتي"}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: (!task.notesReadByAdmin && task.employeeNotes && isAdmin) ? "#fef9c3" : "#f8fafc", color: (!task.notesReadByAdmin && task.employeeNotes && isAdmin) ? "#b45309" : "#64748b", border: `1px solid ${(!task.notesReadByAdmin && task.employeeNotes && isAdmin) ? "#fde68a" : "#e2e8f0"}`, cursor: "pointer", fontFamily: "inherit" }}>
              <MessageSquare size={12} /> {isAdmin ? "ملاحظة" : "ملاحظة"}
            </button>

            {/* ── Employee: "أنهيت المهمة" button ── */}
            {!isAdmin && isActive && (
              <button onClick={onMarkDone}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", color: "white", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}>
                <CheckCircle2 size={12} /> أنهيت المهمة
              </button>
            )}

            {/* ── Admin: "موافقة على الإنجاز" button ── */}
            {isAdmin && isPendingApproval && (
              <button onClick={onApprove}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: "linear-gradient(135deg,#16a34a,#15803d)", border: "none", color: "white", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(22,163,74,0.3)" }}>
                <ThumbsUp size={12} /> موافقة على الإنجاز
              </button>
            )}

            {isAdmin && (
              <>
                <button onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", fontFamily: "inherit" }}><Pencil size={12} /></button>
                <button onClick={onDelete} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit" }}><Trash2 size={12} /></button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 8, borderTop: "1px solid #f5f0e6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
            <User size={12} />
            <span>{task.assigneeName ?? "—"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#9ca3af" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} /> {fmtDate(task.createdAt)}
            </span>
            {isCompleted && task.completedAt && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#16a34a", fontWeight: 700 }}>
                <CheckCircle2 size={11} /> أُنجزت: {fmtDate(task.completedAt)}
              </span>
            )}
            {!isCompleted && task.dueDate && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: isOverdue ? "#dc2626" : "#9ca3af", fontWeight: isOverdue ? 700 : 400 }}>
                <Calendar size={11} /> {isOverdue ? "متأخرة!" : "يستحق:"} {fmtDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   MAIN PAGE
════════════════════════════════ */
export default function TasksList() {
  const { user } = useAuth();
  const isAdminUser = user?.role === "admin";
  const qc = useQueryClient();

  const [tab,        setTab]        = useState<"all"|"pending"|"approval"|"completed"|"notes">("all");
  const [showForm,   setShowForm]   = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [notesTask,  setNotesTask]  = useState<Task | null>(null);
  const [filterPri,  setFilterPri]  = useState("all");

  const { data: tasks = [], isLoading, isError } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => apiFetch("/api/tasks"),
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery<{ count: number; tasks: Task[] }>({
    queryKey: ["tasks-unread"],
    queryFn: () => apiFetch("/api/tasks/unread-notes"),
    enabled: isAdminUser,
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery<{ id: number; fullName: string }[]>({
    queryKey: ["users-directory"],
    queryFn: () => apiFetch("/api/users/directory"),
    enabled: isAdminUser,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const patchStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks-unread"] });
    },
  });

  const filteredTasks = tasks.filter(t => {
    if (tab === "pending")   return t.status === "pending" || t.status === "in_progress";
    if (tab === "approval")  return t.status === "pending_approval";
    if (tab === "completed") return t.status === "completed";
    if (tab === "notes")     return isAdminUser && t.employeeNotes && t.employeeNotes.trim() !== "";
    return true;
  }).filter(t => filterPri === "all" || tab === "notes" || tab === "completed" || t.priority === filterPri);

  const unreadCount = unreadData?.count ?? 0;

  const approvalCount  = tasks.filter(t => t.status === "pending_approval").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;

  const statCards = isAdminUser ? [
    { label: "إجمالي المهام",        value: tasks.length,                                        color: "#374151", bg: "#f9fafb" },
    { label: "قيد الانتظار",        value: tasks.filter(t => t.status === "pending").length,     color: "#d97706", bg: "#fffbeb" },
    { label: "جارٍ التنفيذ",        value: tasks.filter(t => t.status === "in_progress").length, color: "#2563eb", bg: "#eff6ff" },
    { label: "تنتظر الموافقة",      value: approvalCount,                                        color: "#7c3aed", bg: "#f5f3ff" },
    { label: "مكتملة",               value: completedCount,                                       color: "#16a34a", bg: "#f0fdf4" },
    { label: "ملاحظات جديدة",       value: unreadCount,                                          color: "#b45309", bg: "#fef9c3" },
  ] : [
    { label: "مهامي",                value: tasks.length,                                        color: "#374151", bg: "#f9fafb" },
    { label: "قيد الانتظار",        value: tasks.filter(t => t.status === "pending").length,     color: "#d97706", bg: "#fffbeb" },
    { label: "جارٍ التنفيذ",        value: tasks.filter(t => t.status === "in_progress").length, color: "#2563eb", bg: "#eff6ff" },
    { label: "مكتملة",               value: completedCount,                                       color: "#16a34a", bg: "#f0fdf4" },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Modals */}
      {(showForm || editingTask) && (
        <TaskFormModal open employees={employees} editing={editingTask}
          onClose={() => { setShowForm(false); setEditingTask(null); }} />
      )}
      {notesTask && (
        <NotesModal task={notesTask} isAdmin={isAdminUser} onClose={() => setNotesTask(null)} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>
              {isAdminUser ? "إدارة المهام" : "مهامي"}
            </h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>
            {isAdminUser ? "توزيع المهام ومتابعة التنفيذ والملاحظات" : "المهام المعيّنة لك وإضافة ملاحظاتك"}
          </p>
        </div>
        {isAdminUser && (
          <button onClick={() => { setEditingTask(null); setShowForm(true); }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}>
            <Plus size={15} /> مهمة جديدة
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 16, border: `1.5px solid ${c.color}20`, padding: "16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.color, marginTop: 4, opacity: 0.85 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 12, border: "1.5px solid #f0ead8", padding: 4, flexWrap: "wrap" }}>
          {[
            { key: "all",       label: "الكل",              count: tasks.length,                                                                    accent: G },
            { key: "pending",   label: "النشطة",             count: tasks.filter(t => t.status === "pending" || t.status === "in_progress").length,  accent: G },
            ...(isAdminUser ? [{ key: "approval", label: "تنتظر الموافقة", count: approvalCount,  accent: "#7c3aed" }] : []),
            { key: "completed", label: "المنجز",             count: completedCount,                                                                  accent: "#16a34a" },
            ...(isAdminUser ? [{ key: "notes",    label: "الملاحظات",       count: unreadCount,    accent: "#b45309" }] : []),
          ].map(t => {
            const isActive = tab === t.key;
            const bg = isActive
              ? t.accent === "#7c3aed" ? "linear-gradient(135deg,#7c3aed,#6d28d9)"
              : t.accent === "#16a34a" ? "linear-gradient(135deg,#16a34a,#15803d)"
              : t.accent === "#b45309" ? "linear-gradient(135deg,#b45309,#92400e)"
              : `linear-gradient(135deg,${G},${GD})`
              : "transparent";
            return (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: bg, color: isActive ? "white" : "#6b7280", transition: "all 0.15s" }}>
                {t.label}
                {t.count > 0 && (
                  <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: isActive ? "rgba(255,255,255,0.25)" : "#f3f4f6", color: isActive ? "white" : "#374151", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <select value={filterPri} onChange={e => setFilterPri(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 12, fontWeight: 600, background: "white", color: "#374151", fontFamily: "inherit", cursor: "pointer" }}>
          <option value="all">كل الأولويات</option>
          {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Tasks grid */}
      {isError ? (
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <AlertCircle size={36} color="#fca5a5" style={{ margin: "0 auto 10px", display: "block" }} />
          <p style={{ color: "#dc2626", fontSize: 14, fontWeight: 600, margin: 0 }}>تعذّر تحميل المهام، حاول مرة أخرى</p>
        </div>
      ) : isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 160, borderRadius: 16, background: "#f1f5f9", animation: "pulse 1.5s infinite" }} />)}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
          <ClipboardList size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>
            {tab === "notes" ? "لا توجد ملاحظات غير مقروءة" : "لا توجد مهام"}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 14 }}>
          {filteredTasks.map(t => (
            <TaskCard key={t.id} task={t} isAdmin={isAdminUser}
              onEdit={() => { setEditingTask(t); setShowForm(false); }}
              onDelete={() => { if (confirm(`حذف "${t.title}"؟`)) deleteMut.mutate(t.id); }}
              onNotes={() => setNotesTask(t)}
              onMarkDone={() => {
                if (confirm("هل أنهيت هذه المهمة؟ سيتم إرسالها للمدير للموافقة."))
                  patchStatusMut.mutate({ id: t.id, status: "pending_approval" });
              }}
              onApprove={() => {
                if (confirm(`الموافقة على إنجاز مهمة "${t.title}"؟`))
                  patchStatusMut.mutate({ id: t.id, status: "completed" });
              }} />
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
