import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { costCentersApi, type CostCenter } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Trash2, Check, X, Pencil } from "lucide-react";

const G = "#D4A534", GL = "#E8BE55", GD = "#A87C20";

const TYPE_LABEL: Record<string, string> = {
  profit: "مركز ربح",
  cost: "مركز تكلفة",
  allocatable: "قابل للتحميل",
};
const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  profit: { bg: "#dcfce7", text: "#166534" },
  cost: { bg: "#dbeafe", text: "#1e40af" },
  allocatable: { bg: "#fef3c7", text: "#92400e" },
};

const inp: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

export default function AdminCostCenters() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [form, setForm] = useState({ name: "", type: "profit", evaluationMetric: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "profit", evaluationMetric: "" });

  const { data: centers = [], isLoading } = useQuery({ queryKey: ["cost-centers"], queryFn: () => costCentersApi.list(), enabled: isAdmin });

  const inv = () => qc.invalidateQueries({ queryKey: ["cost-centers"] });
  const createM = useMutation({
    mutationFn: () => costCentersApi.create({ name: form.name.trim(), type: form.type as any, evaluationMetric: form.evaluationMetric.trim() || null }),
    onSuccess: () => { inv(); setForm({ name: "", type: "profit", evaluationMetric: "" }); toast({ title: "✅ تم إضافة القسم" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const updateM = useMutation({
    mutationFn: (c: CostCenter) => costCentersApi.update(c.id, { name: editForm.name.trim(), type: editForm.type as any, evaluationMetric: editForm.evaluationMetric.trim() || null }),
    onSuccess: () => { inv(); setEditId(null); toast({ title: "✅ تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const toggleM = useMutation({
    mutationFn: (c: CostCenter) => costCentersApi.update(c.id, { isActive: !c.isActive }),
    onSuccess: inv,
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => costCentersApi.delete(id),
    onSuccess: () => { inv(); toast({ title: "🗑 تم حذف القسم" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (!isAdmin) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>هذه الصفحة للمدير فقط.</div>;

  const startEdit = (c: CostCenter) => { setEditId(c.id); setEditForm({ name: c.name, type: c.type, evaluationMetric: c.evaluationMetric ?? "" }); };

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl", maxWidth: 900, margin: "0 auto", padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
        <Building2 size={22} color={GD} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#132a18", margin: 0 }}>مراكز التكلفة والربح (أقسام الشركة)</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px 14px" }}>
        النواة الموحّدة للنظام المالي. كل حركة (دخل/مصروف) تُنسب لقسم، ويُقاس كل قسم بحسب نوعه.
      </p>

      {/* Add form */}
      <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GD, marginBottom: 12 }}>إضافة قسم جديد</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 2fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>اسم القسم *</label>
            <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: المبيعات" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>النوع</label>
            <select style={inp} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="profit">مركز ربح</option>
              <option value="cost">مركز تكلفة</option>
              <option value="allocatable">قابل للتحميل</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>معيار التقييم (اختياري)</label>
            <input style={inp} value={form.evaluationMetric} onChange={e => setForm(p => ({ ...p, evaluationMetric: e.target.value }))} placeholder="نسبة/هامش…" />
          </div>
          <button type="button" disabled={!form.name.trim() || createM.isPending}
            onClick={() => form.name.trim() && createM.mutate()}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 16px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${G}, ${GD})`, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", height: 38 }}>
            <Plus size={15} /> إضافة
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جاري التحميل…</div>
        ) : centers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>لا توجد أقسام بعد</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right" }}>
            <thead style={{ background: "#faf8f2" }}>
              <tr>{["القسم", "النوع", "معيار التقييم", "الحالة", ""].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {centers.map(c => {
                const tc = TYPE_COLOR[c.type] ?? TYPE_COLOR.profit;
                const editing = editId === c.id;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f5f0e6" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#132a18" }}>
                      {editing ? <input style={inp} value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /> : c.name}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {editing ? (
                        <select style={inp} value={editForm.type} onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))}>
                          <option value="profit">مركز ربح</option>
                          <option value="cost">مركز تكلفة</option>
                          <option value="allocatable">قابل للتحميل</option>
                        </select>
                      ) : (
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.text }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>
                      {editing ? <input style={inp} value={editForm.evaluationMetric} onChange={e => setEditForm(p => ({ ...p, evaluationMetric: e.target.value }))} /> : (c.evaluationMetric || "—")}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => toggleM.mutate(c)} style={{ cursor: "pointer", border: "none", background: "none", padding: 0 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.isActive ? "#dcfce7" : "#f3f4f6", color: c.isActive ? "#166534" : "#6b7280" }}>
                          {c.isActive ? "فعّال" : "مؤرشف"}
                        </span>
                      </button>
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                        {editing ? (
                          <>
                            <button onClick={() => updateM.mutate(c)} title="حفظ" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex" }}><Check size={14} color="#16a34a" /></button>
                            <button onClick={() => setEditId(null)} title="إلغاء" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex" }}><X size={14} color="#64748b" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(c)} title="تعديل" style={{ background: "#fdf8ec", border: "1px solid #f0e4b0", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex" }}><Pencil size={14} color={GD} /></button>
                            <button onClick={() => { if (confirm(`حذف قسم "${c.name}"؟ (لن تُحذف حركاته المالية، بل يُصفّر ربطها بالقسم)`)) deleteM.mutate(c.id); }} title="حذف" style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, padding: 5, cursor: "pointer", display: "flex" }}><Trash2 size={14} color="#dc2626" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
