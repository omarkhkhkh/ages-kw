import { Clock, Calendar, User, CheckCircle2, MessageSquare } from "lucide-react";
import { OpTask, PRIORITY_MAP, STATUS_MAP, fmtDate, badge, isOverdue, GR, G } from "./shared";

export default function ListView({ tasks, onOpen }: { tasks: OpTask[]; onOpen: (t: OpTask) => void }) {
  if (tasks.length === 0) {
    return (
      <div style={{ padding: "64px 0", textAlign: "center" }}>
        <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد مهام مطابقة</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
      {tasks.map(task => {
        const pri = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.medium;
        const sta = STATUS_MAP[task.status] ?? STATUS_MAP.pending;
        const PriIcon = pri.icon;
        const overdue = isOverdue(task);
        const completed = task.status === "completed";
        const borderColor = overdue ? "#fecaca" : completed ? "#bbf7d0" : "#f0ead8";

        return (
          <div key={task.id} onClick={() => onOpen(task)}
            style={{ background: completed ? "#fafffe" : "white", borderRadius: 16, border: `1.5px solid ${borderColor}`, boxShadow: "0 2px 14px rgba(0,0,0,0.05)", overflow: "hidden", cursor: "pointer", transition: "transform 0.12s, box-shadow 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 14px rgba(0,0,0,0.05)"; }}>
            <div style={{ height: 4, background: completed ? "linear-gradient(90deg,#16a34a,#86efac)" : `linear-gradient(90deg,${pri.color},${pri.color}44)` }} />
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: GR, flex: 1 }}>{task.title}</span>
                {!task.notesReadByAdmin && task.employeeNotes && <MessageSquare size={13} color="#b45309" />}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={badge(sta.label, sta.color, sta.bg)}>{sta.label}</span>
                <span style={{ ...badge(pri.label, pri.color, pri.bg), display: "flex", alignItems: "center", gap: 4 }}><PriIcon size={10} /> {pri.label}</span>
                {(task.taskTypeName || task.taskType) && <span style={badge(task.taskTypeName || task.taskType || "", "#475569", "#f1f5f9")}>{task.taskTypeName || task.taskType}</span>}
              </div>
              {task.progressPercent > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ height: 5, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${task.progressPercent}%`, background: `linear-gradient(90deg,${G},${pri.color})`, borderRadius: 3 }} />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #f5f0e6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#6b7280" }}>
                  <User size={11} /> <span>{task.assigneeName ?? "غير مُسندة"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#9ca3af" }}>
                  {completed && task.completedAt ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#16a34a", fontWeight: 700 }}><CheckCircle2 size={11} /> {fmtDate(task.completedAt)}</span>
                  ) : task.dueDate ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: overdue ? "#dc2626" : "#9ca3af", fontWeight: overdue ? 700 : 400 }}><Calendar size={11} /> {overdue ? "متأخرة!" : fmtDate(task.dueDate)}</span>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {fmtDate(task.createdAt)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
