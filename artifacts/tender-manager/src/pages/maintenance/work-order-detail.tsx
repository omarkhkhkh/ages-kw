import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { maintenanceApi, apiFetch, projectsApi, contractsApi, suppliersApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import FileUpload from "@/components/file-upload";
import {
  ArrowRight, Save, Trash2, Plus, X, Check, ChevronLeft as StageArrow,
  Package, Banknote, FileDown, TrendingUp,
} from "lucide-react";
import { STAGES, STAGE_LABELS, MAINTENANCE_TYPE_LABELS, PRIORITY_MAP, fmt, StatCard } from "./index";
import EntityDirectoryPicker from "@/components/entity-directory-picker";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };

const EXPENSE_CATS = ["general", "labor", "spare_parts", "transport", "consultant", "contractor", "equipment_rental", "fuel", "other"];
const EXPENSE_CAT_AR: Record<string, string> = { general: "عام", labor: "عمالة", spare_parts: "قطع غيار", transport: "نقل", consultant: "استشاري", contractor: "مقاول", equipment_rental: "إيجار معدات", fuel: "وقود", other: "أخرى" };
const PART_STATUS_AR: Record<string, string> = { requested: "مطلوبة", ordered: "تم الطلب", received: "مستلمة", issued: "مصروفة" };

const emptyPart = { partName: "", quantity: "", unitPrice: "", supplierId: "" };
const emptyCost = { category: "general", description: "", amount: "", dueDate: "" };

export default function WorkOrderDetail() {
  const params = useParams();
  const woId = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const qc = useQueryClient();

  const [form, setForm] = useState<any>(null);
  const [newPart, setNewPart] = useState({ ...emptyPart });
  const [newCost, setNewCost] = useState({ ...emptyCost });

  const { data: wo } = useQuery<any>({ queryKey: ["maintenance-wo", woId], queryFn: () => maintenanceApi.workOrders.get(woId), enabled: !!woId });
  const { data: equipment = [] } = useQuery<any[]>({ queryKey: ["maintenance-equipment"], queryFn: () => maintenanceApi.equipment.list() });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch("/api/users/directory") });
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["projects"], queryFn: () => projectsApi.list() });
  const { data: contracts = [] } = useQuery<any[]>({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list() });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });

  const { data: stageHistory = [] } = useQuery<any[]>({ queryKey: ["maintenance-wo-stage-history", woId], queryFn: () => maintenanceApi.workOrders.stageHistory(woId), enabled: !!woId });
  const { data: parts = [] } = useQuery<any[]>({ queryKey: ["maintenance-wo-parts", woId], queryFn: () => maintenanceApi.parts.list(woId), enabled: !!woId });
  const { data: costs = [] } = useQuery<any[]>({ queryKey: ["maintenance-wo-costs", woId], queryFn: () => apiFetch(`/api/finance/expenses?maintenanceWorkOrderId=${woId}`), enabled: !!woId && canEdit });
  const { data: incomeRows = [] } = useQuery<any[]>({ queryKey: ["maintenance-wo-income", woId], queryFn: () => apiFetch(`/api/finance/income?maintenanceWorkOrderId=${woId}`), enabled: !!woId && canEdit });

  useEffect(() => { if (wo) setForm({ ...wo }); }, [wo]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-wo", woId] });
    qc.invalidateQueries({ queryKey: ["maintenance-wo-stage-history", woId] });
    qc.invalidateQueries({ queryKey: ["maintenance-wo-parts", woId] });
    qc.invalidateQueries({ queryKey: ["maintenance-wo-costs", woId] });
    qc.invalidateQueries({ queryKey: ["maintenance-wo-income", woId] });
    qc.invalidateQueries({ queryKey: ["maintenance-budget-summary"] });
    qc.invalidateQueries({ queryKey: ["maintenance-work-orders"] });
    qc.invalidateQueries({ queryKey: ["maintenance-inventory"] });
    qc.invalidateQueries({ queryKey: ["maintenance-alerts"] });
    qc.invalidateQueries({ queryKey: ["maintenance-stats"] });
  };

  const updateMut = useMutation({ mutationFn: (d: any) => maintenanceApi.workOrders.update(woId, d), onSuccess: invalidateAll });
  const deleteMut = useMutation({ mutationFn: () => maintenanceApi.workOrders.delete(woId), onSuccess: () => navigate("/maintenance") });

  const addPartMut = useMutation({ mutationFn: (d: any) => maintenanceApi.parts.create(woId, d), onSuccess: () => { setNewPart({ ...emptyPart }); invalidateAll(); } });
  const updatePartMut = useMutation({ mutationFn: ({ id, d }: any) => maintenanceApi.parts.update(woId, id, d), onSuccess: invalidateAll });
  const deletePartMut = useMutation({ mutationFn: (id: number) => maintenanceApi.parts.delete(woId, id), onSuccess: invalidateAll });

  const addCostMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/finance/expenses", { method: "POST", body: JSON.stringify({ ...d, maintenanceWorkOrderId: woId }) }),
    onSuccess: () => { setNewCost({ ...emptyCost }); invalidateAll(); },
  });

  const logIncomeMut = useMutation({
    mutationFn: () => maintenanceApi.workOrders.logIncome(woId),
    onSuccess: invalidateAll,
  });

  const handleSaveInfo = () => {
    if (!form?.equipmentId || !form?.reportReason?.trim()) return;
    updateMut.mutate({
      equipmentId: Number(form.equipmentId),
      maintenanceType: form.maintenanceType,
      reportReason: form.reportReason.trim(),
      priority: form.priority || "medium",
      location: form.location || null,
      assignedTechnicianId: form.assignedTechnicianId ? Number(form.assignedTechnicianId) : null,
      approvedByUserId: form.approvedByUserId ? Number(form.approvedByUserId) : null,
      projectId: form.projectId ? Number(form.projectId) : null,
      contractId: form.contractId ? Number(form.contractId) : null,
      billedAmount: form.billedAmount || null,
      governmentEntityId: form.governmentEntityId ? Number(form.governmentEntityId) : null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      contactId: form.contactId ? Number(form.contactId) : null,
      cause: form.cause || null,
      downtimeMinutes: form.downtimeMinutes || null,
      beforePhotoUrl: form.beforePhotoUrl || null,
      afterPhotoUrl: form.afterPhotoUrl || null,
      attachmentUrl: form.attachmentUrl || null,
      notes: form.notes || null,
    });
  };

  const handleAdvanceStage = () => {
    const idx = STAGES.findIndex((s) => s.key === form.stage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const nextStage = STAGES[idx + 1].key;
    set("stage", nextStage);
    updateMut.mutate({ stage: nextStage });
  };

  const [generating, setGenerating] = useState(false);
  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      await maintenanceApi.generateVisitReport(woId, undefined, wo.orderNumber);
    } catch (e: any) {
      alert(e.message ?? "فشل في توليد التقرير");
    } finally {
      setGenerating(false);
    }
  };

  if (!wo || !form) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>;

  const stageIdx = Math.max(0, STAGES.findIndex((s) => s.key === form.stage));
  const completionPct = Math.round(((stageIdx + 1) / STAGES.length) * 100);
  const priority = PRIORITY_MAP[form.priority] ?? PRIORITY_MAP.medium;
  const completedIdx = STAGES.findIndex((s) => s.key === "completed");
  const costsTotal = costs.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <button onClick={() => navigate("/maintenance")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 8 }}>
            <ArrowRight size={13} /> إدارة الصيانة
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: GR, margin: 0, fontFamily: "monospace" }}>{wo.orderNumber}</h1>
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${priority.color}15`, color: priority.color }}>{priority.label}</span>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{wo.equipmentName} ({wo.assetNumber}) — {wo.reportReason}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {stageIdx >= completedIdx && (
            <button onClick={handleGenerateReport} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "white", border: `1.5px solid ${G}88`, color: GD, cursor: "pointer", fontFamily: "inherit" }}>
              <FileDown size={13} /> {generating ? "جارٍ التوليد..." : "📄 إصدار تقرير الزيارة"}
            </button>
          )}
          {canEdit && (
            <button onClick={() => { if (confirm(`حذف أمر الصيانة ${wo.orderNumber}؟`)) deleteMut.mutate(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#fff1f2", border: "1.5px solid #fecaca", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
              <Trash2 size={13} /> حذف الأمر
            </button>
          )}
        </div>
      </div>

      {/* Stage tracker */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={sectionTitle}>مراحل التنفيذ — {completionPct}% مكتمل</span>
          {canEdit && stageIdx < STAGES.length - 1 && (
            <button onClick={handleAdvanceStage} disabled={updateMut.isPending} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
              المرحلة التالية <StageArrow size={12} />
            </button>
          )}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "#f3f4f6", overflow: "hidden", marginBottom: 14 }}>
          <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${G},${GD})`, width: `${completionPct}%`, transition: "width 0.3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          {STAGES.map((s, i) => (
            <div key={s.key} style={{ flex: 1, minWidth: 80, textAlign: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, background: i <= stageIdx ? G : "#f3f4f6", color: i <= stageIdx ? "white" : "#9ca3af" }}>
                {i <= stageIdx ? <Check size={11} /> : i + 1}
              </div>
              <div style={{ fontSize: 10, color: i === stageIdx ? GD : "#9ca3af", fontWeight: i === stageIdx ? 800 : 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {stageHistory.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f5f0e6", display: "flex", flexDirection: "column", gap: 5 }}>
            {stageHistory.map((h: any) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280" }}>
                <span>{STAGE_LABELS[h.stage] ?? h.stage} {h.changedByName ? `— ${h.changedByName}` : ""}</span>
                <span>{new Date(h.changedAt).toLocaleString("ar-KW")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        {/* Left: basic info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={cardStyle}>
            <div style={sectionTitle}>بيانات أمر الصيانة</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>المعدة *</label><select value={form.equipmentId ?? ""} onChange={(e) => set("equipmentId", e.target.value)} style={inp} disabled={!canEdit}>{equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.assetNumber})</option>)}</select></div>
              <div><label style={lbl}>نوع الصيانة</label><select value={form.maintenanceType ?? "corrective"} onChange={(e) => set("maintenanceType", e.target.value)} style={inp} disabled={!canEdit}>{Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={lbl}>الأولوية</label><select value={form.priority ?? "medium"} onChange={(e) => set("priority", e.target.value)} style={inp} disabled={!canEdit}>{Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label style={lbl}>الموقع</label><input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الفني المعيّن</label><select value={form.assignedTechnicianId ?? ""} onChange={(e) => set("assignedTechnicianId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— غير محدد —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
              <div><label style={lbl}>اعتماد المسؤول</label><select value={form.approvedByUserId ?? ""} onChange={(e) => set("approvedByUserId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— غير محدد —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
              <div><label style={lbl}>المشروع</label><select value={form.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— بدون —</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label style={lbl}>العقد</label><select value={form.contractId ?? ""} onChange={(e) => set("contractId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— بدون —</option>{contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNumber}</option>)}</select></div>
              <div><label style={lbl}>قيمة الفاتورة (اختياري — للصيانة المدفوعة فقط)</label><input type="number" step="0.001" value={form.billedAmount ?? ""} onChange={(e) => set("billedAmount", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} placeholder="0.000" /></div>
              <div><label style={lbl}>مدة التوقف (دقيقة)</label><input type="number" value={form.downtimeMinutes ?? ""} onChange={(e) => set("downtimeMinutes", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>الجهة الحكومية ← الاختصاص ← المسؤول (للزيارة)</label>
                <EntityDirectoryPicker
                  value={{ governmentEntityId: form.governmentEntityId, departmentId: form.departmentId, contactId: form.contactId }}
                  onChange={next => setForm((f: any) => ({ ...f, ...next }))}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>سبب البلاغ *</label><textarea value={form.reportReason ?? ""} onChange={(e) => set("reportReason", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} disabled={!canEdit} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>سبب العطل (عند الإنهاء)</label><textarea value={form.cause ?? ""} onChange={(e) => set("cause", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} disabled={!canEdit} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>صورة قبل الصيانة</label><FileUpload objectPath={form.beforePhotoUrl} onChange={(p) => set("beforePhotoUrl", p)} accept="image/*" label="رفع صورة" disabled={!canEdit} /></div>
              <div><label style={lbl}>صورة بعد الصيانة</label><FileUpload objectPath={form.afterPhotoUrl} onChange={(p) => set("afterPhotoUrl", p)} accept="image/*" label="رفع صورة" disabled={!canEdit} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>مرفق (فيديو/PDF)</label><FileUpload objectPath={form.attachmentUrl} onChange={(p) => set("attachmentUrl", p)} label="رفع مرفق" disabled={!canEdit} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>ملاحظات</label><textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} disabled={!canEdit} /></div>
            {canEdit && (
              <button onClick={handleSaveInfo} disabled={updateMut.isPending} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", width: "100%", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <Save size={14} /> {updateMut.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            )}
          </div>
        </div>

        {/* Right: parts + costs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Package size={13} color={GD} />
              <span style={sectionTitle}>طلبات قطع الغيار ({parts.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {parts.map((pt: any) => (
                <div key={pt.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8", fontSize: 11.5 }}>
                  <span style={{ flex: 2, fontWeight: 700, color: GR }}>{pt.partName}</span>
                  <span style={{ flex: 1, color: "#6b7280" }}>× {pt.quantity}</span>
                  {canEdit ? (
                    <select value={pt.status} onChange={(e) => updatePartMut.mutate({ id: pt.id, d: { status: e.target.value } })} style={{ ...inp, flex: 1, padding: "4px 8px", fontSize: 11 }}>
                      {Object.entries(PART_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : <span style={{ flex: 1, color: "#6b7280" }}>{PART_STATUS_AR[pt.status] ?? pt.status}</span>}
                  {canEdit && <button onClick={() => deletePartMut.mutate(pt.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><X size={12} /></button>}
                </div>
              ))}
              {parts.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "8px 0" }}>لا توجد طلبات قطع غيار</p>}
            </div>
            {canEdit && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6 }}>
                <input value={newPart.partName} onChange={(e) => setNewPart((f) => ({ ...f, partName: e.target.value }))} placeholder="اسم القطعة" style={inp} />
                <input value={newPart.quantity} onChange={(e) => setNewPart((f) => ({ ...f, quantity: e.target.value }))} placeholder="الكمية" type="number" style={inp} />
                <input value={newPart.unitPrice} onChange={(e) => setNewPart((f) => ({ ...f, unitPrice: e.target.value }))} placeholder="السعر" type="number" style={inp} />
                <button onClick={() => newPart.partName.trim() && newPart.quantity && addPartMut.mutate({ ...newPart, unitPrice: newPart.unitPrice || null, supplierId: newPart.supplierId || null })} style={{ padding: "0 12px", borderRadius: 9, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer" }}><Plus size={14} /></button>
              </div>
            )}
          </div>

          {canEdit && (
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Banknote size={13} color={GD} />
                <span style={sectionTitle}>التكاليف الفعلية ({costs.length}) — الإجمالي: {fmt(costsTotal)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {costs.map((c: any) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8", fontSize: 11.5 }}>
                    <span>{c.description} <span style={{ color: "#9ca3af" }}>({EXPENSE_CAT_AR[c.category] ?? c.category})</span></span>
                    <span style={{ fontWeight: 700, color: "#d97706", direction: "ltr" as const }}>{fmt(c.amount)}</span>
                  </div>
                ))}
                {costs.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "8px 0" }}>لا توجد تكاليف مسجّلة</p>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6 }}>
                <select value={newCost.category} onChange={(e) => setNewCost((f) => ({ ...f, category: e.target.value }))} style={inp}>{EXPENSE_CATS.map((c) => <option key={c} value={c}>{EXPENSE_CAT_AR[c]}</option>)}</select>
                <input value={newCost.description} onChange={(e) => setNewCost((f) => ({ ...f, description: e.target.value }))} placeholder="الوصف" style={inp} />
                <input value={newCost.amount} onChange={(e) => setNewCost((f) => ({ ...f, amount: e.target.value }))} placeholder="المبلغ" type="number" style={inp} />
                <button onClick={() => newCost.description.trim() && newCost.amount && addCostMut.mutate(newCost)} style={{ padding: "0 12px", borderRadius: 9, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer" }}><Plus size={14} /></button>
              </div>
            </div>
          )}

          {canEdit && (
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={13} color="#16a34a" />
                  <span style={sectionTitle}>الإيراد المسجّل ({incomeRows.length}) — الإجمالي: {fmt(incomeRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0))}</span>
                </div>
                {form.billedAmount && (
                  <button onClick={() => logIncomeMut.mutate()} disabled={logIncomeMut.isPending} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", border: "1.5px solid #bbf7d0", color: "#16a34a", cursor: "pointer", fontFamily: "inherit" }}>
                    <Plus size={12} /> {logIncomeMut.isPending ? "جارٍ التسجيل..." : "تسجيل كإيراد"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {incomeRows.map((r: any) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 11.5 }}>
                    <span>{r.description} <span style={{ color: "#9ca3af" }}>({new Date(r.date).toLocaleDateString("ar-KW")})</span></span>
                    <span style={{ fontWeight: 700, color: "#16a34a", direction: "ltr" as const }}>{fmt(r.amount)}</span>
                  </div>
                ))}
                {incomeRows.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "4px 0" }}>لا يوجد إيراد مسجّل بعد لهذا الأمر</p>}
              </div>
            </div>
          )}

          {canEdit && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatCard label="إجمالي تكاليف أمر الصيانة" value={costsTotal} isMoney color="#dc2626" />
              <StatCard label="عدد قطع الغيار" value={parts.length} color={GD} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
