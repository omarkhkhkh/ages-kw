import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entityDirectoryApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Tags, Plus, Trash2, Lock } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#1e2a1e", background: "white", outline: "none", fontFamily: "inherit" };

export default function AdminServiceTypes() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");

  const { data: types = [], isLoading } = useQuery<any[]>({ queryKey: ["service-types"], queryFn: () => entityDirectoryApi.serviceTypes.list() });

  const addMut = useMutation({
    mutationFn: () => entityDirectoryApi.serviceTypes.create(name.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-types"] }); setName(""); toast({ title: "✅ تم إضافة النوع" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => entityDirectoryApi.serviceTypes.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-types"] }),
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
        <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0 }}>أنواع التعامل</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 18px 14px" }}>القائمة المركزية لأنواع التعامل المتاحة لإدارات الجهات الحكومية</p>

      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <input style={{ ...inp, flex: 1 }} value={name} onChange={e => setName(e.target.value)} placeholder="اسم نوع التعامل الجديد" onKeyDown={e => e.key === "Enter" && name.trim() && addMut.mutate()} />
          <button onClick={() => name.trim() && addMut.mutate()} disabled={!name.trim() || addMut.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            <Plus size={14} /> إضافة
          </button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>جاري التحميل...</div>
        ) : types.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
            <Tags size={30} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>لا توجد أنواع تعامل مضافة بعد</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {types.map((t: any) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 20, border: "1.5px solid #e5e7eb", background: "#fdfcf8" }}>
                <Tags size={12} color={GD} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{t.name}</span>
                <button onClick={() => { if (confirm(`حذف نوع "${t.name}"؟`)) delMut.mutate(t.id); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#dc2626" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
