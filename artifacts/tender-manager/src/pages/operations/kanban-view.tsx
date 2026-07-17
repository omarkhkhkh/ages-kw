import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { OpTask, PRIORITY_MAP, STATUS_MAP, STATUS_ORDER, GR } from "./shared";

export default function KanbanView({ tasks, onOpen, canDrag }: { tasks: OpTask[]; onOpen: (t: OpTask) => void; canDrag: boolean }) {
  const qc = useQueryClient();
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => tasksApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["op-tasks"] }),
  });

  const handleDrop = (status: string) => {
    if (draggedId != null) updateStatusMut.mutate({ id: draggedId, status });
    setDraggedId(null);
  };

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {STATUS_ORDER.map(statusKey => {
        const meta = STATUS_MAP[statusKey];
        const colTasks = tasks.filter(t => t.status === statusKey);
        return (
          <div key={statusKey}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(statusKey)}
            style={{ minWidth: 250, flex: "0 0 250px", background: "#fbfaf6", borderRadius: 14, border: "1.5px solid #f0ead8", display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
            <div style={{ padding: "10px 14px", borderBottom: `2px solid ${meta.color}33`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", background: "white", borderRadius: 10, padding: "1px 8px" }}>{colTasks.length}</span>
            </div>
            <div style={{ padding: 8, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {colTasks.map(t => {
                const pri = PRIORITY_MAP[t.priority] ?? PRIORITY_MAP.medium;
                return (
                  <div key={t.id}
                    draggable={canDrag}
                    onDragStart={() => setDraggedId(t.id)}
                    onClick={() => onOpen(t)}
                    style={{ background: "white", borderRadius: 10, border: "1px solid #eee", borderRight: `3px solid ${pri.color}`, padding: "9px 11px", cursor: canDrag ? "grab" : "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: GR, marginBottom: 5 }}>{t.title}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10.5, color: "#9ca3af" }}>
                      <span>{t.assigneeName ?? "—"}</span>
                      <span style={{ color: pri.color, fontWeight: 700 }}>{pri.label}</span>
                    </div>
                  </div>
                );
              })}
              {colTasks.length === 0 && <div style={{ padding: "16px 0", textAlign: "center", fontSize: 11, color: "#c4b5a0" }}>لا توجد مهام</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
