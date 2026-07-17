import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Tags, Plus, Trash2, Lock, X } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#0b1a10";

const inp: React.CSSProperties = { padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#1e2a1e", background: "white", outline: "none", fontFamily: "inherit" };

export default function AdminTaskTypes() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [subtasksDraft, setSubtasksDraft] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");

  const { data: types = [], isLoading } = useQuery<any[]>({ queryKey: ["task-types"], queryFn: () => tasksApi.types.list() });

  const addMut = useMutation({
    mutationFn: () => tasksApi.types.create({ name: name.trim(), suggestedSubtasks: subtasksDraft.length ? subtasksDraft : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task-types"] }); setName(""); setSubtasksDraft([]); toast({ title: "✅ تم إضافة نوع المهمة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => tasksApi.types.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-types"] }),
  });

  if (me?.role !== "admin") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
        <Lock size={40} color="#e2d5b0" />
        <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>ليس لديك صلاحية الوصول</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,#E8BE55,${GD})` }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0 }}>أنواع المهام</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 18px 14px" }}>القائمة المركزية لأنواع المهام في مركز إدارة العمليات، مع قوالب مراحل فرعية اختيارية تُزرع تلقائيًا عند اختيار النوع</p>

      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input style={{ ...inp, flex: 1 }} value={name} onChange={e => setName(e.target.value)} placeholder="اسم نوع المهمة الجديد" />
          <button onClick={() => name.trim() && addMut.mutate()} disabled={!name.trim() || addMut.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            <Plus size={14} /> إضافة
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {subtasksDraft.map((s, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "#f1f5f9", fontSize: 11.5, color: "#374151" }}>
              {s}
              <button onClick={() => setSubtasksDraft(d => d.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#9ca3af" }}><X size={11} /></button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} placeholder="مرحلة فرعية مقترحة (اختياري)، مثال: مراجعة المستندات"
            onKeyDown={e => { if (e.key === "Enter" && subtaskInput.trim()) { setSubtasksDraft(d => [...d, subtaskInput.trim()]); setSubtaskInput(""); } }} />
          <button onClick={() => { if (subtaskInput.trim()) { setSubtasksDraft(d => [...d, subtaskInput.trim()]); setSubtaskInput(""); } }}
            style={{ padding: "0 14px", borderRadius: 9, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 12, color: "#6b7280", fontFamily: "inherit" }}>إضافة مرحلة</button>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>جاري التحميل...</div>
        ) : types.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
            <Tags size={30} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>لا توجد أنواع مهام مضافة بعد</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {types.map((t: any) => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, padding: "10px 14px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fdfcf8" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Tags size={12} color={GD} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{t.name}</span>
                  </div>
                  {t.suggestedSubtasks?.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                      {t.suggestedSubtasks.map((s: string, i: number) => (
                        <span key={i} style={{ fontSize: 10.5, color: "#9ca3af", background: "#f1f5f9", borderRadius: 10, padding: "1px 8px" }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { if (confirm(`حذف نوع "${t.name}"؟`)) delMut.mutate(t.id); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#dc2626", flexShrink: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
