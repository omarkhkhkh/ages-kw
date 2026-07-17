/**
 * المتابعة اليومية — Daily performance hub
 * المدير: نسب إنجاز الموظفين اليوم + إدارة المهام الدورية (قوالب التكرار).
 * الموظف: قائمته اليومية التفاعلية مع إثبات الإنجاز (ملف/ملاحظة) قبل الإكمال.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { tasksApi } from "@/lib/api";
import {
  X, Save, Loader2, Repeat, Plus, Trash2, Paperclip, StickyNote,
  CheckCircle2, Clock, Power, Timer,
} from "lucide-react";
import { PRIORITY_MAP, STATUS_MAP, G, GD, GR } from "./shared";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const card: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };

const RULE_LABELS: Record<string, string> = { daily: "يومي", weekly: "أسبوعي", monthly: "شهري" };
const PROOF_LABELS: Record<string, string> = { none: "بدون إثبات", file: "يتطلب رفع ملف", note: "يتطلب ملاحظة إنجاز" };
const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

interface DailyTask {
  id: number; title: string; status: string; priority: string;
  assignedTo: number | null; assigneeName: string | null;
  dueDate: string | null; completedAt: string | null;
  proofType: "none" | "file" | "note"; recurringTemplateId: number | null;
  employeeNotes: string | null; attachmentCount: number;
}

/* ── عدّاد الوقت المتبقي لنهاية اليوم ── */
function remainingToday(): string {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const mins = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}س ${mins % 60}د`;
}

/* ── نافذة إثبات الإنجاز ── */
function ProofModal({ task, onClose, onDone }: { task: DailyTask; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);

  const completeMut = useMutation({
    mutationFn: (data: any) => tasksApi.update(task.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["daily-performance"] }); qc.invalidateQueries({ queryKey: ["op-tasks"] }); onDone(); },
    onError: (e: any) => setError(e?.message || "تعذر الإكمال"),
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (res: any) =>
      tasksApi.attachments.create(task.id, { fileName: res.metadata.name, objectPath: res.objectPath }).then(() => setUploaded(true)),
    onError: (err: Error) => setError(`فشل رفع الملف: ${err.message}`),
  });

  const confirm = () => {
    setError("");
    if (task.proofType === "note") {
      if (!note.trim()) { setError("اكتب ملاحظة الإنجاز أولاً"); return; }
      completeMut.mutate({ employeeNotes: note.trim(), status: "completed" });
    } else {
      completeMut.mutate({ status: "completed" });
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "white", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "14px 18px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "white", fontSize: 14, fontWeight: 800 }}>إتمام المهمة: {task.title}</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}><X size={14} color="white" /></button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {task.proofType === "file" && (
            <>
              <p style={{ margin: 0, fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
                📄 يرجى إرفاق ملف الإثبات (تقرير/مستند) لإتمام هذه المهمة
              </p>
              <input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) { setError(""); uploadFile(f); } }}
                style={{ fontSize: 12, fontFamily: "inherit" }} />
              {isUploading && <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> جاري الرفع...</span>}
              {(uploaded || task.attachmentCount > 0) && !isUploading && (
                <span style={{ fontSize: 12, color: "#15803d", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} /> {uploaded ? "تم رفع الملف — يمكنك تأكيد الإتمام" : `يوجد ${task.attachmentCount} مرفق مسبقًا على المهمة`}
                </span>
              )}
            </>
          )}
          {task.proofType === "note" && (
            <>
              <p style={{ margin: 0, fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
                📝 اكتب ملاحظة إنجاز موجزة لإتمام هذه المهمة
              </p>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="ماذا أنجزت في هذه المهمة؟"
                style={{ ...inp, height: 80, resize: "vertical" }} />
            </>
          )}
          {task.proofType === "none" && (
            <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>هل أنت متأكد من إتمام هذه المهمة؟</p>
          )}
          {error && <p style={{ margin: 0, fontSize: 12, color: "#dc2626", fontWeight: 700 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={confirm}
              disabled={completeMut.isPending || isUploading || (task.proofType === "file" && !uploaded && task.attachmentCount === 0)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,#16a34a,#15803d)`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: completeMut.isPending || isUploading || (task.proofType === "file" && !uploaded && task.attachmentCount === 0) ? 0.5 : 1 }}>
              {completeMut.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={13} />} تأكيد الإتمام
            </button>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#374151" }}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── نموذج مهمة دورية جديدة (مدير) ── */
function TemplateModal({ onClose, employees }: { onClose: () => void; employees: { id: number; fullName: string }[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", assignedTo: "", priority: "medium", recurrenceRule: "daily", dayOfWeek: "0", dayOfMonth: "1", proofType: "none" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const [error, setError] = useState("");

  const saveMut = useMutation({
    mutationFn: () => tasksApi.recurringTemplates.create({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      assignedTo: form.assignedTo ? Number(form.assignedTo) : undefined,
      priority: form.priority,
      recurrenceRule: form.recurrenceRule,
      dayOfWeek: form.recurrenceRule === "weekly" ? Number(form.dayOfWeek) : undefined,
      dayOfMonth: form.recurrenceRule === "monthly" ? Number(form.dayOfMonth) : undefined,
      proofType: form.proofType,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-templates"] });
      qc.invalidateQueries({ queryKey: ["daily-performance"] });
      qc.invalidateQueries({ queryKey: ["op-tasks"] });
      onClose();
    },
    onError: (e: any) => setError(e?.message || "فشل الحفظ"),
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 500, background: "white", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "14px 18px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "white", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Repeat size={14} /> مهمة دورية جديدة</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}><X size={14} color="white" /></button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>عنوان المهمة *</label>
            <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="مثال: تحديث ملفات تقارير الصيانة اليومية" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>الموظف المكلَّف *</label>
              <select style={inp} value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)}>
                <option value="">— اختر —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>مستوى الأهمية</label>
              <select style={inp} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: form.recurrenceRule === "daily" ? "1fr" : "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>نوع التكرار</label>
              <select style={inp} value={form.recurrenceRule} onChange={e => set("recurrenceRule", e.target.value)}>
                <option value="daily">يومي (تتجدد تلقائيًا كل يوم)</option>
                <option value="weekly">أسبوعي</option>
                <option value="monthly">شهري</option>
              </select>
            </div>
            {form.recurrenceRule === "weekly" && (
              <div>
                <label style={lbl}>يوم الأسبوع</label>
                <select style={inp} value={form.dayOfWeek} onChange={e => set("dayOfWeek", e.target.value)}>
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {form.recurrenceRule === "monthly" && (
              <div>
                <label style={lbl}>يوم الشهر</label>
                <select style={inp} value={form.dayOfMonth} onChange={e => set("dayOfMonth", e.target.value)}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>شرط الإنجاز (Proof of Work)</label>
            <select style={inp} value={form.proofType} onChange={e => set("proofType", e.target.value)}>
              <option value="none">بدون إثبات — علامة "تم" مباشرة</option>
              <option value="file">يتطلب رفع ملف (تقرير/مستند) قبل الإكمال</option>
              <option value="note">يتطلب كتابة ملاحظة إنجاز قبل الإكمال</option>
            </select>
          </div>
          <div>
            <label style={lbl}>التفاصيل</label>
            <textarea style={{ ...inp, height: 60, resize: "vertical" }} value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          {error && <p style={{ margin: 0, fontSize: 12, color: "#dc2626", fontWeight: 700 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { if (form.title.trim() && form.assignedTo) saveMut.mutate(); }}
              disabled={!form.title.trim() || !form.assignedTo || saveMut.isPending}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: !form.title.trim() || !form.assignedTo ? 0.5 : 1 }}>
              {saveMut.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />} حفظ وإرسال فورًا
            </button>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#374151" }}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ Main ══════════════════════ */
export default function DailyView({ isAdmin, employees, onOpenTask }: {
  isAdmin: boolean;
  employees: { id: number; fullName: string }[];
  onOpenTask: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [proofTask, setProofTask] = useState<DailyTask | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);

  // التحديث اللحظي: polling كل 10 ثوانٍ
  const { data, isLoading } = useQuery<{ employees: any[]; tasks: DailyTask[] }>({
    queryKey: ["daily-performance"],
    queryFn: () => tasksApi.dailyPerformance(),
    refetchInterval: 10000,
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["recurring-templates"],
    queryFn: () => tasksApi.recurringTemplates.list(),
    enabled: isAdmin,
  });

  const toggleTemplateMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => tasksApi.recurringTemplates.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-templates"] }),
  });
  const deleteTemplateMut = useMutation({
    mutationFn: (id: number) => tasksApi.recurringTemplates.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-templates"] }),
  });

  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e.fullName])), [employees]);
  const rows = data?.employees ?? [];
  const tasks = useMemo(() => {
    const all = data?.tasks ?? [];
    return selectedEmployee ? all.filter(t => t.assignedTo === selectedEmployee) : all;
  }, [data, selectedEmployee]);

  if (isLoading) return <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>جاري التحميل...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {proofTask && <ProofModal task={proofTask} onClose={() => setProofTask(null)} onDone={() => setProofTask(null)} />}
      {showTemplateModal && <TemplateModal onClose={() => setShowTemplateModal(false)} employees={employees} />}

      {/* ── شريط عدّاد اليوم ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: `linear-gradient(135deg,${GR},#1e4028)`, borderRadius: 14, padding: "12px 18px" }}>
        <span style={{ color: "white", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <Timer size={15} color={G} /> مهام اليوم — {new Date().toLocaleDateString("ar-KW", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <span style={{ color: G, fontSize: 12, fontWeight: 700 }}>المتبقي حتى نهاية اليوم: {remainingToday()}</span>
        {isAdmin && (
          <button onClick={() => setShowTemplateModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" }}>
            <Repeat size={13} /> مهمة دورية جديدة
          </button>
        )}
      </div>

      {/* ── (مدير) نسب إنجاز الموظفين اليوم ── */}
      {isAdmin && (
        <div style={card}>
          <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 800, color: GR }}>نسبة إنجاز مهام اليوم لكل موظف</p>
          {rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "#9ca3af" }}>لا توجد مهام مستحقة اليوم لأي موظف — أنشئ مهمة دورية أو أسند مهمة بموعد استحقاق اليوم</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r: any) => {
                const active = selectedEmployee === r.userId;
                const color = r.pct >= 100 ? "#16a34a" : r.pct >= 50 ? "#d97706" : "#dc2626";
                return (
                  <div key={r.userId} onClick={() => setSelectedEmployee(active ? null : r.userId)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, cursor: "pointer", background: active ? "#fffbeb" : "#f9fafb", border: `1.5px solid ${active ? G : "transparent"}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: GR, width: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fullName}</span>
                    <div style={{ flex: 1, height: 9, background: "#e5e7eb", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r.pct}%`, background: color, borderRadius: 5, transition: "width 0.5s ease" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 900, color, minWidth: 44, textAlign: "left" }}>{r.pct}%</span>
                    <span style={{ fontSize: 11, color: "#6b7280", minWidth: 46 }}>{r.completed}/{r.total}</span>
                  </div>
                );
              })}
            </div>
          )}
          {selectedEmployee && (
            <p style={{ margin: "10px 0 0", fontSize: 11.5, color: GD, fontWeight: 700 }}>
              يعرض الجدول أدناه مهام: {empMap[selectedEmployee] ?? "الموظف المحدد"} — اضغط مجددًا لإلغاء الفلتر
            </p>
          )}
        </div>
      )}

      {/* ── قائمة مهام اليوم ── */}
      <div style={card}>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 800, color: GR }}>
          {isAdmin ? "مهام اليوم (كل الموظفين)" : "قائمتي اليومية"}
          <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 10px", borderRadius: 10, marginRight: 8 }}>{tasks.length} مهمة</span>
        </p>
        {tasks.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "#9ca3af" }}>لا توجد مهام مستحقة اليوم 🎉</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map(t => {
              const done = t.status === "completed";
              const pri = PRIORITY_MAP[t.priority] ?? PRIORITY_MAP.medium;
              const sta = STATUS_MAP[t.status] ?? STATUS_MAP.pending;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: done ? "#f0fdf4" : "white", border: `1.5px solid ${done ? "#bbf7d0" : t.priority === "urgent" || t.priority === "critical" ? "#fecaca" : "#e5e7eb"}`, borderRight: `4px solid ${done ? "#16a34a" : pri.color}` }}>
                  {/* Checkbox (للموظف على مهمته / المدير كذلك) */}
                  <button
                    onClick={() => { if (!done) setProofTask(t); }}
                    disabled={done}
                    title={done ? "مكتملة" : "إتمام المهمة"}
                    style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, border: `2px solid ${done ? "#16a34a" : "#d1d5db"}`, background: done ? "#16a34a" : "white", cursor: done ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {done && <CheckCircle2 size={15} color="white" />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenTask(t.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: done ? "#6b7280" : GR, textDecoration: done ? "line-through" : "none" }}>{t.title}</span>
                      {t.recurringTemplateId != null && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#0891b2", background: "#ecfeff", padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Repeat size={9} /> دورية
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 800, color: pri.color, background: pri.bg, padding: "2px 8px", borderRadius: 10 }}>{pri.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: sta.color, background: sta.bg, padding: "2px 8px", borderRadius: 10 }}>{sta.label}</span>
                      {t.proofType === "file" && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: t.attachmentCount > 0 ? "#15803d" : "#a16207", background: t.attachmentCount > 0 ? "#f0fdf4" : "#fefce8", padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Paperclip size={9} /> {t.attachmentCount > 0 ? `${t.attachmentCount} مرفق` : "يتطلب ملف"}
                        </span>
                      )}
                      {t.proofType === "note" && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#a16207", background: "#fefce8", padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <StickyNote size={9} /> يتطلب ملاحظة
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, fontSize: 11, color: "#6b7280" }}>
                      {isAdmin && t.assigneeName && <span>👤 {t.assigneeName}</span>}
                      {done && t.completedAt
                        ? <span style={{ color: "#15803d", fontWeight: 700 }}>🕒 أُنجزت {new Date(t.completedAt).toLocaleTimeString("ar-KW", { hour: "2-digit", minute: "2-digit" })}</span>
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={10} /> تستحق قبل نهاية اليوم</span>}
                      {done && t.employeeNotes && <span style={{ color: "#0891b2" }}>📝 {t.employeeNotes.slice(0, 60)}{t.employeeNotes.length > 60 ? "…" : ""}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── (مدير) قوالب المهام الدورية ── */}
      {isAdmin && (
        <div style={card}>
          <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 8 }}>
            <Repeat size={14} color={G} /> المهام الدورية المجدولة ({templates.length})
          </p>
          {templates.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "#9ca3af" }}>لا توجد مهام دورية — أنشئ واحدة ليتم توليدها تلقائيًا كل يوم/أسبوع/شهر</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map((tpl: any) => (
                <div key={tpl.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: tpl.isActive ? "#f9fafb" : "#fef2f2", opacity: tpl.isActive ? 1 : 0.7 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: GR }}>{tpl.title}</span>
                    <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: "#6b7280", flexWrap: "wrap" }}>
                      <span>🔄 {RULE_LABELS[tpl.recurrenceRule] ?? tpl.recurrenceRule}{tpl.recurrenceRule === "weekly" ? ` (${WEEKDAYS[tpl.dayOfWeek ?? 0]})` : tpl.recurrenceRule === "monthly" ? ` (يوم ${tpl.dayOfMonth})` : ""}</span>
                      <span>👤 {empMap[tpl.assignedTo] ?? "غير مُسندة"}</span>
                      <span>🛡 {PROOF_LABELS[tpl.proofType] ?? tpl.proofType}</span>
                      <span>⚡ {(PRIORITY_MAP[tpl.priority] ?? PRIORITY_MAP.medium).label}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleTemplateMut.mutate({ id: tpl.id, isActive: !tpl.isActive })}
                    title={tpl.isActive ? "إيقاف التوليد" : "تفعيل التوليد"}
                    style={{ border: "none", background: tpl.isActive ? "#f0fdf4" : "#f3f4f6", color: tpl.isActive ? "#16a34a" : "#9ca3af", borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => { if (window.confirm("حذف هذا القالب الدوري؟ (المهام المولّدة سابقًا تبقى)")) deleteTemplateMut.mutate(tpl.id); }}
                    style={{ border: "none", background: "#fff1f2", color: "#dc2626", borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
