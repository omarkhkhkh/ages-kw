import { useMemo } from "react";
import { Gantt, ViewMode, type Task as GanttTaskType } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { OpTask, PRIORITY_MAP } from "./shared";

function addDays(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

export default function GanttView({ tasks, onOpen }: { tasks: OpTask[]; onOpen: (t: OpTask) => void }) {
  const qc = useQueryClient();
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => tasksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["op-tasks"] }),
  });

  const ganttTasks: GanttTaskType[] = useMemo(() => {
    const withDates = tasks.filter(t => t.dueDate);
    return withDates.map(t => {
      const end = new Date(t.dueDate!);
      const start = t.startDate ? new Date(t.startDate) : addDays(end, -3);
      const pri = PRIORITY_MAP[t.priority] ?? PRIORITY_MAP.medium;
      return {
        id: String(t.id),
        type: "task",
        name: t.title,
        start: start < end ? start : addDays(end, -1),
        end,
        progress: t.progressPercent ?? 0,
        styles: { backgroundColor: pri.color, backgroundSelectedColor: pri.color, progressColor: "#132a18", progressSelectedColor: "#132a18" },
      };
    });
  }, [tasks]);

  if (!ganttTasks.length) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
        لا توجد مهام لها تاريخ استحقاق لعرضها في مخطط Gantt
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", overflow: "hidden" }}>
      <Gantt
        tasks={ganttTasks}
        viewMode={ViewMode.Week}
        locale="ar"
        rtl
        listCellWidth=""
        columnWidth={65}
        onClick={(t) => { const found = tasks.find(x => String(x.id) === t.id); if (found) onOpen(found); }}
        onDateChange={(t) => {
          const found = tasks.find(x => String(x.id) === t.id);
          if (found) updateMut.mutate({ id: found.id, data: { startDate: t.start.toISOString().slice(0, 10), dueDate: t.end.toISOString().slice(0, 10) } });
          return true;
        }}
        onProgressChange={(t) => {
          const found = tasks.find(x => String(x.id) === t.id);
          if (found) updateMut.mutate({ id: found.id, data: { progressPercent: t.progress } });
          return true;
        }}
      />
    </div>
  );
}
