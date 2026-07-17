import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { residencyApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { Building2, Plus, Pencil, Trash2, X, Save, Users, IdCard } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 };

interface CompanyRow {
  id: number;
  name: string;
  notes: string | null;
  workerCount: number;
}

const emptyForm = { name: "", notes: "" };

export default function ResidencyCompanies() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: companies = [], isLoading } = useQuery<CompanyRow[]>({
    queryKey: ["residency-companies"],
    queryFn: () => residencyApi.companies.list(),
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setDrawerOpen(true); };
  const openEdit = (c: CompanyRow) => { setEditing(c); setForm({ name: c.name, notes: c.notes ?? "" }); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const createMut = useMutation({
    mutationFn: (d: any) => residencyApi.companies.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["residency-companies"] }); closeDrawer(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: any }) => residencyApi.companies.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["residency-companies"] }); closeDrawer(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => residencyApi.companies.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["residency-companies"] }),
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    const d = { name: form.name.trim(), notes: form.notes || null };
    if (editing) updateMut.mutate({ id: editing.id, d });
    else createMut.mutate(d);
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>إدارة الإقامات</h1>
          </div>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>الشركات الكفيلة وعمالها — الإقامات والجوازات والمستندات</p>
        </div>
        {canEdit && (
          <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px rgba(212,165,52,0.4)` }}>
            <Plus size={14} /> شركة كفيلة جديدة
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {[...Array(3)].map((_, i) => <div key={i} style={{ background: "white", borderRadius: 16, height: 130, animation: "pulse 1.5s infinite", border: "1.5px solid #f0ead8" }} />)}
        </div>
      ) : companies.length === 0 ? (
        <div style={{ background: "white", borderRadius: 20, border: "1.5px solid #f0ead8", padding: "64px 0", textAlign: "center" }}>
          <Building2 size={44} color="#e2d5b0" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد شركات كفيلة بعد</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {companies.map((c) => (
            <div key={c.id} onClick={() => navigate(`/residency/${c.id}`)}
              style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12, transition: "border-color 0.15s, box-shadow 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = G; e.currentTarget.style.boxShadow = "0 4px 16px rgba(212,165,52,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#f0ead8"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${G}15`, border: `1px solid ${G}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={18} color={G} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: GR }}>{c.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#6b7280", marginTop: 2 }}><Users size={11} />{c.workerCount} عامل</div>
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)} style={{ display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: 8, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer" }}><Pencil size={12} /></button>
                    <button onClick={() => { if (confirm(`حذف شركة "${c.name}"؟`)) deleteMut.mutate(c.id); }} style={{ display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: 8, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer" }}><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
              {c.notes && <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit drawer */}
      <div onClick={closeDrawer} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(11,26,16,0.62)", display: drawerOpen ? "flex" : "none", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
        <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ width: "100%", maxWidth: 440, background: "white", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,0.35)", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", background: `linear-gradient(135deg,${GR},#1e4028)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IdCard size={16} color={G} />
              <h2 style={{ color: "white", fontSize: 14.5, fontWeight: 800, margin: 0 }}>{editing ? "تعديل الشركة" : "شركة كفيلة جديدة"}</h2>
            </div>
            <button onClick={closeDrawer} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={15} color="white" />
            </button>
          </div>
          <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={lbl}>اسم الشركة *</label><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="اسم الشركة الكفيلة" style={inp} /></div>
            <div><label style={lbl}>ملاحظات</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" } as any} /></div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={closeDrawer} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "white", color: "#6b7280", border: "1.5px solid #e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
              <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 12.5, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <Save size={13} /> حفظ
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
