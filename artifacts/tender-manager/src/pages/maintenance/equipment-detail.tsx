import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { maintenanceApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import FileUpload from "@/components/file-upload";
import { ArrowRight, Save, Trash2, ClipboardList, CalendarClock } from "lucide-react";
import { EQUIPMENT_STATUS, MAINTENANCE_TYPE_LABELS, STAGE_LABELS, PRIORITY_MAP } from "./index";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };

export default function EquipmentDetail() {
  const params = useParams();
  const equipmentId = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const qc = useQueryClient();

  const [form, setForm] = useState<any>(null);

  const { data: equipment } = useQuery<any>({ queryKey: ["maintenance-equipment-item", equipmentId], queryFn: () => maintenanceApi.equipment.get(equipmentId), enabled: !!equipmentId });
  const { data: history = [] } = useQuery<any[]>({ queryKey: ["maintenance-equipment-history", equipmentId], queryFn: () => maintenanceApi.equipment.history(equipmentId), enabled: !!equipmentId });
  const { data: plans = [] } = useQuery<any[]>({ queryKey: ["maintenance-preventive-plans", equipmentId], queryFn: () => maintenanceApi.preventivePlans.list(equipmentId), enabled: !!equipmentId });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch("/api/users/directory") });

  useEffect(() => { if (equipment) setForm({ ...equipment }); }, [equipment]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const updateMut = useMutation({
    mutationFn: (d: any) => maintenanceApi.equipment.update(equipmentId, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance-equipment-item", equipmentId] }); qc.invalidateQueries({ queryKey: ["maintenance-equipment"] }); },
  });
  const deleteMut = useMutation({ mutationFn: () => maintenanceApi.equipment.delete(equipmentId), onSuccess: () => navigate("/maintenance") });

  const handleSave = () => {
    if (!form?.assetNumber?.trim() || !form?.name?.trim()) return;
    updateMut.mutate({
      assetNumber: form.assetNumber.trim(),
      name: form.name.trim(),
      category: form.category || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      serialNumber: form.serialNumber || null,
      yearOfManufacture: form.yearOfManufacture || null,
      purchaseDate: form.purchaseDate || null,
      purchaseValue: form.purchaseValue || null,
      usefulLifeYears: form.usefulLifeYears || null,
      warrantyExpiry: form.warrantyExpiry || null,
      location: form.location || null,
      department: form.department || null,
      branch: form.branch || null,
      responsibleUserId: form.responsibleUserId || null,
      status: form.status,
      photoUrl: form.photoUrl || null,
      notes: form.notes || null,
    });
  };

  if (!equipment || !form) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>;

  const st = EQUIPMENT_STATUS[form.status] ?? EQUIPMENT_STATUS.operational;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <button onClick={() => navigate("/maintenance")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 8 }}>
            <ArrowRight size={13} /> إدارة الصيانة
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: GR, margin: 0 }}>{equipment.name}</h1>
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0", fontFamily: "monospace" }}>{equipment.assetNumber}</p>
        </div>
        {canEdit && (
          <button onClick={() => { if (confirm(`حذف المعدة ${equipment.name}؟`)) deleteMut.mutate(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#fff1f2", border: "1.5px solid #fecaca", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
            <Trash2 size={13} /> حذف المعدة
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={cardStyle}>
            <div style={sectionTitle}>بيانات المعدة</div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>الصورة</label><FileUpload objectPath={form.photoUrl} onChange={(p) => set("photoUrl", p)} accept="image/*" label="رفع صورة" disabled={!canEdit} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>رقم الأصل *</label><input value={form.assetNumber ?? ""} onChange={(e) => set("assetNumber", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>اسم المعدة *</label><input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الفئة</label><input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الحالة</label><select value={form.status ?? "operational"} onChange={(e) => set("status", e.target.value)} style={inp} disabled={!canEdit}>{Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label style={lbl}>الشركة المصنّعة</label><input value={form.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الموديل</label><input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الرقم التسلسلي</label><input value={form.serialNumber ?? ""} onChange={(e) => set("serialNumber", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>سنة الصنع</label><input type="number" value={form.yearOfManufacture ?? ""} onChange={(e) => set("yearOfManufacture", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>تاريخ الشراء</label><input type="date" value={form.purchaseDate ?? ""} onChange={(e) => set("purchaseDate", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>قيمة الشراء (د.ك)</label><input type="number" value={form.purchaseValue ?? ""} onChange={(e) => set("purchaseValue", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>العمر الافتراضي (سنوات)</label><input type="number" value={form.usefulLifeYears ?? ""} onChange={(e) => set("usefulLifeYears", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>انتهاء الضمان</label><input type="date" value={form.warrantyExpiry ?? ""} onChange={(e) => set("warrantyExpiry", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الموقع</label><input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>القسم</label><input value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الفرع</label><input value={form.branch ?? ""} onChange={(e) => set("branch", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>المسؤول</label><select value={form.responsibleUserId ?? ""} onChange={(e) => set("responsibleUserId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— غير محدد —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>ملاحظات</label><textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} disabled={!canEdit} /></div>
            {canEdit && (
              <button onClick={handleSave} disabled={updateMut.isPending} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", width: "100%", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <Save size={14} /> {updateMut.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <ClipboardList size={13} color={GD} />
              <span style={sectionTitle}>سجل الصيانة ({history.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.map((h: any) => {
                const pr = PRIORITY_MAP[h.priority] ?? PRIORITY_MAP.medium;
                return (
                  <div key={h.id} onClick={() => navigate(`/maintenance/work-orders/${h.id}`)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8", fontSize: 11.5, cursor: "pointer" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: GR, fontFamily: "monospace" }}>{h.orderNumber}</div>
                      <div style={{ color: "#6b7280", marginTop: 2 }}>{MAINTENANCE_TYPE_LABELS[h.maintenanceType] ?? h.maintenanceType} · {STAGE_LABELS[h.stage] ?? h.stage} · {h.technicianName ?? "بدون فني"}</div>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${pr.color}15`, color: pr.color }}>{pr.label}</span>
                  </div>
                );
              })}
              {history.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "8px 0" }}>لا يوجد سجل صيانة بعد</p>}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <CalendarClock size={13} color={GD} />
              <span style={sectionTitle}>خطط الصيانة الوقائية ({plans.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {plans.map((p: any) => (
                <div key={p.id} style={{ padding: "8px 10px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8", fontSize: 11.5 }}>
                  <div style={{ fontWeight: 700, color: GR }}>{p.planName}</div>
                  <div style={{ color: "#6b7280", marginTop: 2 }}>الاستحقاق القادم: {p.nextDueDate ?? "غير محدد"}</div>
                </div>
              ))}
              {plans.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "8px 0" }}>لا توجد خطط صيانة وقائية لهذه المعدة</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
