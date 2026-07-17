import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import {
  ClipboardList, Plus, X, Save, Loader2,
  List, KanbanSquare, Calendar as CalendarIcon, History, GanttChartSquare, CalendarCheck,
} from "lucide-react";
import { PRIORITY_MAP, STATUS_MAP, OpTask, G, GD, GR } from "./operations/shared";
import DailyView from "./operations/daily-view";
import ListView from "./operations/list-view";
import KanbanView from "./operations/kanban-view";
import CalendarView from "./operations/calendar-view";
import TimelineView from "./operations/timeline-view";
import GanttView from "./operations/gantt-view";
import TaskDetailDrawer from "./operations/task-detail-drawer";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };

const VIEW_MODES = [
  { key: "daily", label: "المتابعة اليومية", icon: CalendarCheck },
  { key: "list", label: "قائمة", icon: List },
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "calendar", label: "تقويم", icon: CalendarIcon },
  { key: "timeline", label: "Timeline", icon: History },
  { key: "gantt", label: "Gantt", icon: GanttChartSquare },
] as const;
type ViewMode = typeof VIEW_MODES[number]["key"];

function NewTaskModal({ onClose, employees }: { onClose: () => void; employees: { id: number; fullName: string }[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => tasksApi.create({ ...form, assignedTo: form.assignedTo || undefined, dueDate: form.dueDate || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["op-tasks"] }); onClose(); },
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,26,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "white", borderRadius: 20, boxShadow: "0 32px 80px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>مهمة جديدة</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}><X size={15} color="white" /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>عنوان المهمة *</label>
            <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="وصف موجز للمهمة" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>الأولوية</label>
              <select style={inp} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الموظف المعيّن</label>
              <select style={inp} value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)}>
                <option value="">بدون إسناد</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>تاريخ الاستحقاق</label>
            <input type="date" style={{ ...inp, direction: "ltr" }} value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>الوصف التفصيلي</label>
            <textarea style={{ ...inp, height: 70, resize: "vertical" }} value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => form.title.trim() && saveMut.mutate()} disabled={!form.title.trim() || saveMut.isPending}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              {saveMut.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />} إضافة
            </button>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#374151" }}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TasksList() {
  const { user } = useAuth();
  const isAdminUser = user?.role === "admin";
  const canApprove = isAdminUser || !!user?.taskCanApprove;

  const [view, setView] = useState<ViewMode>(() => {
    const q = new URLSearchParams(window.location.search).get("view");
    return (VIEW_MODES.some(v => v.key === q) ? q : "list") as ViewMode;
  });
  const [showNew, setShowNew] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const { data: tasks = [], isLoading } = useQuery<OpTask[]>({
    queryKey: ["op-tasks", statusFilter, priorityFilter],
    queryFn: () => tasksApi.list({ status: statusFilter || undefined, priority: priorityFilter || undefined }),
    refetchInterval: 10000,
  });

  const { data: stats } = useQuery<any>({ queryKey: ["op-tasks-stats"], queryFn: () => tasksApi.stats(), refetchInterval: 10000 });

  const { data: employees = [] } = useQuery<{ id: number; fullName: string }[]>({
    queryKey: ["users-directory"], queryFn: () => fetch("/api/users/directory", { credentials: "include" }).then(r => r.json()),
    enabled: isAdminUser,
  });

  const statCards = stats ? [
    { label: "مهام مفتوحة", value: stats.openCount ?? 0, color: "#374151", bg: "#f9fafb" },
    { label: "متأخرة", value: stats.overdueCount ?? 0, color: "#dc2626", bg: "#fff1f2" },
    { label: "عاجلة/حرجة", value: stats.urgentCount ?? 0, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "أُنجزت اليوم", value: stats.completedTodayCount ?? 0, color: "#16a34a", bg: "#f0fdf4" },
    { label: "إجمالي المُنجز", value: stats.completedTotalCount ?? 0, color: "#0891b2", bg: "#ecfeff" },
  ] : [];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} employees={employees} />}
      {openTaskId && (
        <TaskDetailDrawer taskId={openTaskId} isAdmin={isAdminUser} canApprove={canApprove} currentUserId={user?.id ?? null} onClose={() => setOpenTaskId(null)} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>مركز إدارة العمليات</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>متابعة جميع أعمال الشركة، المسؤولين، نسبة الإنجاز، والأداء</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}>
          <Plus size={15} /> مهمة جديدة
        </button>
      </div>

      {/* Stat cards */}
      {statCards.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
          {statCards.map(c => (
            <div key={c.label} style={{ background: c.bg, borderRadius: 16, border: `1.5px solid ${c.color}20`, padding: "16px 18px" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.color, marginTop: 4, opacity: 0.85 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* View mode tabs + filters */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 12, border: "1.5px solid #f0ead8", padding: 4, flexWrap: "wrap" }}>
          {VIEW_MODES.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: view === v.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: view === v.key ? "white" : "#6b7280" }}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "7px 10px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12, background: "white", color: "#374151", fontFamily: "inherit" }}>
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ padding: "7px 10px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12, background: "white", color: "#374151", fontFamily: "inherit" }}>
            <option value="">كل الأولويات</option>
            {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* View body */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>جاري التحميل...</div>
      ) : (
        <>
          {view === "daily" && <DailyView isAdmin={isAdminUser} employees={employees} onOpenTask={id => setOpenTaskId(id)} />}
          {view === "list" && <ListView tasks={tasks} onOpen={t => setOpenTaskId(t.id)} />}
          {view === "kanban" && <KanbanView tasks={tasks} onOpen={t => setOpenTaskId(t.id)} canDrag={isAdminUser} />}
          {view === "calendar" && <CalendarView tasks={tasks} />}
          {view === "timeline" && <TimelineView />}
          {view === "gantt" && <GanttView tasks={tasks} onOpen={t => setOpenTaskId(t.id)} />}
        </>
      )}

      {tasks.length === 0 && !isLoading && view !== "list" && view !== "daily" && (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
          <ClipboardList size={36} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
          لا توجد مهام مطابقة
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
