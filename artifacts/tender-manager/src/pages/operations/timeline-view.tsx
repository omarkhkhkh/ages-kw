import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { History, Plus, Repeat, MessageSquare, Paperclip, ThumbsUp, UserPlus } from "lucide-react";
import { GR, GD } from "./shared";

const CHANGE_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  created:      { label: "إنشاء",  icon: Plus,        color: "#16a34a" },
  field_update: { label: "تعديل",  icon: Repeat,       color: "#2563eb" },
  status_change:{ label: "تغيير حالة", icon: Repeat,   color: "#d97706" },
  comment:      { label: "تعليق",  icon: MessageSquare, color: "#7c3aed" },
  attachment:   { label: "مرفق",   icon: Paperclip,    color: "#0891b2" },
  approval:     { label: "اعتماد", icon: ThumbsUp,     color: "#be123c" },
  assignment:   { label: "إسناد",  icon: UserPlus,     color: GD },
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("ar-KW", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TimelineView({ linkedEntityType, linkedEntityId, taskId }: { linkedEntityType?: string; linkedEntityId?: number; taskId?: number }) {
  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ["op-activity-feed", linkedEntityType, linkedEntityId, taskId],
    queryFn: () => tasksApi.activityFeed({ linkedEntityType, linkedEntityId, taskId }),
  });

  if (isLoading) return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>جاري التحميل...</div>;
  if (!entries.length) return (
    <div style={{ textAlign: "center", padding: 48 }}>
      <History size={32} color="#e2d5b0" style={{ margin: "0 auto 10px", display: "block" }} />
      <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, margin: 0 }}>لا يوجد نشاط مسجّل بعد</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {entries.map((e: any) => {
        const meta = CHANGE_TYPE_META[e.changeType] ?? { label: e.changeType, icon: Repeat, color: "#6b7280" };
        const Icon = meta.icon;
        return (
          <div key={e.id} style={{ display: "flex", gap: 12, padding: "10px 4px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={13} color={meta.color} />
              </div>
              <div style={{ flex: 1, width: 1, background: "#f0ead8", marginTop: 2 }} />
            </div>
            <div style={{ paddingBottom: 10, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, background: `${meta.color}15`, borderRadius: 10, padding: "1px 8px" }}>{meta.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: GR }}>{e.taskTitle}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{e.userName ?? "النظام"}</span>
              </div>
              {(e.field || e.note) && (
                <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>
                  {e.field && <span>{e.field}: {e.oldValue ?? "—"} ← {e.newValue ?? "—"}</span>}
                  {e.note && <span>{e.note}</span>}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: "#c4b5a0", marginTop: 3 }}>{fmtDateTime(e.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
