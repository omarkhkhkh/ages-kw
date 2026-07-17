import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { ClipboardList, Plus, ExternalLink } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";

export type LinkedEntityType =
  | "tender" | "practice" | "contract" | "governmentEntity" | "supplier" | "project"
  | "purchaseOrder" | "vehicle" | "correspondence" | "maintenanceWorkOrder"
  | "rfq" | "bankGuarantee" | "governmentRegistration" | "transportationOrder" | "company"
  | "department";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#f1f5f9", text: "#64748b" },
};

export default function LinkedTasks({ entityType, entityId }: { entityType: LinkedEntityType; entityId: number | null | undefined }) {
  const qc = useQueryClient();
  const [showQuick, setShowQuick] = useState(false);
  const [title, setTitle] = useState("");

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["linked-tasks", entityType, entityId],
    queryFn: () => tasksApi.list({ linkedEntityType: entityType, linkedEntityId: entityId! }),
    enabled: !!entityId,
  });

  const createM = useMutation({
    mutationFn: () => tasksApi.create({ title: title.trim(), linkedEntityType: entityType, linkedEntityId: entityId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linked-tasks"] }); setTitle(""); setShowQuick(false); },
  });

  if (!entityId) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af" }}>المهام المرتبطة ({tasks.length})</span>
        <button onClick={() => setShowQuick(s => !s)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${G}15`, color: GD, border: "none", cursor: "pointer" }}>
          <Plus size={12} /> مهمة جديدة مرتبطة
        </button>
      </div>

      {showQuick && (
        <div style={{ display: "flex", gap: 6 }}>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان المهمة"
            style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12, fontFamily: "inherit", outline: "none" }}
            onKeyDown={e => e.key === "Enter" && title.trim() && createM.mutate()} />
          <button onClick={() => title.trim() && createM.mutate()} disabled={!title.trim() || createM.isPending}
            style={{ padding: "0 12px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>حفظ</button>
        </div>
      )}

      {isLoading ? (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "12px 0" }}>جارٍ التحميل...</div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af" }}>
          <ClipboardList size={24} style={{ margin: "0 auto 6px", opacity: 0.3, display: "block" }} />
          <div style={{ fontSize: 12 }}>لا توجد مهام مرتبطة</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks.map((t: any) => {
            const st = STATUS_COLORS[t.status] || { bg: "#fffbeb", text: "#b45309" };
            return (
              <a key={t.id} href="/tasks" onClick={e => { e.preventDefault(); window.location.href = "/tasks"; }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 12px", borderRadius: 10, border: "1.5px solid #f0ead8", background: "#fdfaf5", cursor: "pointer", textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  {t.assigneeName && <span style={{ fontSize: 10, color: "#9ca3af" }}>({t.assigneeName})</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: st.bg, color: st.text }}>{t.status}</span>
                  <ExternalLink size={11} color="#9ca3af" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
