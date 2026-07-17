import { useMemo } from "react";
import { CalendarWidget, type CalendarEvent } from "@/components/calendar-widget";
import { OpTask } from "./shared";

export default function CalendarView({ tasks }: { tasks: OpTask[] }) {
  const events: CalendarEvent[] = useMemo(() => tasks
    .filter(t => t.dueDate)
    .map(t => ({
      id: `task-${t.id}`,
      date: new Date(t.dueDate!),
      type: "task" as const,
      title: t.title,
      subLabel: t.taskTypeName || t.taskType || "",
      priority: t.priority,
      status: t.status,
      assigneeName: t.assigneeName ?? undefined,
    })), [tasks]);

  return (
    <div>
      <CalendarWidget events={events} />
      <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10 }}>يعرض التقويم المهام حسب تاريخ الاستحقاق. انقر على مهمة من القائمة لعرض تفاصيلها.</p>
    </div>
  );
}
