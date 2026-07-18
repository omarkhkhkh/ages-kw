import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { purchaseOrdersApi, suppliersApi, contractsApi, projectsApi, companiesApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import FileUpload, { objectPathToUrl } from "@/components/file-upload";
import {
  ArrowRight, Save, Trash2, Plus, X, Check, ChevronLeft as StageArrow,
  TrendingUp, TrendingDown, ShoppingCart, Banknote,
} from "lucide-react";
import EntityDirectoryPicker from "@/components/entity-directory-picker";
import LinkedPricingSheets from "@/components/linked-pricing-sheets";
import LinkedTasks from "@/components/linked-tasks";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontSize: 12.5, color: "#1e2a1e", background: "#fafaf8", outline: "none", fontFamily: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: GR, marginBottom: 5 };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: "18px 20px" };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };

const STATUS_LABELS: Record<string, string> = { new: "جديد", in_progress: "جاري التنفيذ", delivered: "تم التسليم", completed: "مكتمل" };
const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "#6b7280" },
  medium: { label: "متوسطة", color: "#d97706" },
  high: { label: "عالية", color: "#dc2626" },
  urgent: { label: "عاجلة", color: "#7c3aed" },
};
const STAGES = [
  { key: "supplier_approval", label: "اعتماد المورد" },
  { key: "po_issued", label: "إصدار أمر الشراء" },
  { key: "materials_received", label: "استلام المواد" },
  { key: "materials_inspected", label: "فحص المواد" },
  { key: "delivered_to_entity", label: "التسليم للجهة" },
  { key: "closed", label: "إغلاق الطلب" },
];
const EXPENSE_CATS = ["general", "salary", "rent", "utilities", "maintenance", "tax", "customs", "customs_clearance", "installation", "labor", "other"];
const EXPENSE_CAT_AR: Record<string, string> = { general: "عام", salary: "رواتب", rent: "إيجار", utilities: "مرافق", maintenance: "صيانة", tax: "ضرائب", customs: "جمارك", customs_clearance: "تخليص جمركي", installation: "تركيب", labor: "عمالة", other: "أخرى" };

function fmt(v: number) { return `${Number(v || 0).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`; }

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", padding: "12px 14px" }}>
      <div style={{ fontSize: 15, fontWeight: 900, color, direction: "ltr" as const, textAlign: "right" as const }}>{fmt(value)}</div>
      <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 5 }}>{label}</div>
    </div>
  );
}

const emptyItem = { itemName: "", description: "", quantity: "", unit: "", unitPrice: "", executionStatus: "pending", notes: "" };
const emptyCost = { category: "general", description: "", amount: "", dueDate: "" };

export default function PurchaseOrderDetail() {
  const params = useParams();
  const poId = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || !!user?.canEdit;
  const qc = useQueryClient();

  const [form, setForm] = useState<any>(null);
  const [newItem, setNewItem] = useState({ ...emptyItem });
  const [newCost, setNewCost] = useState({ ...emptyCost });
  const [addingMember, setAddingMember] = useState(false);

  const { data: po } = useQuery<any>({ queryKey: ["po", poId], queryFn: () => purchaseOrdersApi.get(poId), enabled: !!poId });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["suppliers"], queryFn: () => suppliersApi.list() });
  const { data: contracts = [] } = useQuery<any[]>({ queryKey: ["contracts", "all"], queryFn: () => contractsApi.list() });
  const { data: companies = [] } = useQuery<any[]>({ queryKey: ["companies-list"], queryFn: () => companiesApi.list() });
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["projects"], queryFn: () => projectsApi.list() });
  const { data: tenders = [] } = useQuery<any[]>({ queryKey: ["tenders"], queryFn: () => apiFetch("/api/tenders") });
  const { data: practices = [] } = useQuery<any[]>({ queryKey: ["practices"], queryFn: () => apiFetch("/api/practices") });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch("/api/users/directory") });

  const { data: items = [] } = useQuery<any[]>({ queryKey: ["po-items", poId], queryFn: () => purchaseOrdersApi.items.list(poId), enabled: !!poId });
  const { data: team = [] } = useQuery<any[]>({ queryKey: ["po-team", poId], queryFn: () => purchaseOrdersApi.team.list(poId), enabled: !!poId });
  const { data: stageHistory = [] } = useQuery<any[]>({ queryKey: ["po-stage-history", poId], queryFn: () => purchaseOrdersApi.stageHistory.list(poId), enabled: !!poId });
  const { data: costs = [] } = useQuery<any[]>({ queryKey: ["po-costs", poId], queryFn: () => apiFetch(`/api/finance/expenses?purchaseOrderId=${poId}`), enabled: !!poId && canEdit });
  const { data: profitability } = useQuery<any>({ queryKey: ["po-profitability", poId], queryFn: () => purchaseOrdersApi.getProfitability(poId), enabled: !!poId });

  useEffect(() => { if (po) setForm({ ...po }); }, [po]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["po", poId] });
    qc.invalidateQueries({ queryKey: ["po-items", poId] });
    qc.invalidateQueries({ queryKey: ["po-team", poId] });
    qc.invalidateQueries({ queryKey: ["po-stage-history", poId] });
    qc.invalidateQueries({ queryKey: ["po-costs", poId] });
    qc.invalidateQueries({ queryKey: ["po-profitability", poId] });
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });
  };

  const updateMut = useMutation({ mutationFn: (d: any) => purchaseOrdersApi.update(poId, d), onSuccess: invalidateAll });
  const deleteMut = useMutation({ mutationFn: () => purchaseOrdersApi.delete(poId), onSuccess: () => navigate("/purchase-orders") });

  const addItemMut = useMutation({
    mutationFn: (d: any) => purchaseOrdersApi.items.create(poId, d),
    onSuccess: () => { setNewItem({ ...emptyItem }); invalidateAll(); },
  });
  const updateItemMut = useMutation({ mutationFn: ({ id, d }: any) => purchaseOrdersApi.items.update(poId, id, d), onSuccess: invalidateAll });
  const deleteItemMut = useMutation({ mutationFn: (id: number) => purchaseOrdersApi.items.delete(poId, id), onSuccess: invalidateAll });

  const addMemberMut = useMutation({ mutationFn: (userId: number) => purchaseOrdersApi.team.add(poId, userId), onSuccess: () => { setAddingMember(false); invalidateAll(); } });
  const removeMemberMut = useMutation({ mutationFn: (userId: number) => purchaseOrdersApi.team.remove(poId, userId), onSuccess: invalidateAll });

  const addCostMut = useMutation({
    mutationFn: (d: any) => apiFetch("/api/finance/expenses", { method: "POST", body: JSON.stringify({ ...d, purchaseOrderId: poId }) }),
    onSuccess: () => { setNewCost({ ...emptyCost }); invalidateAll(); },
  });

  const handleSaveInfo = () => {
    if (!form?.orderNumber?.trim() || !form?.description?.trim()) return;
    updateMut.mutate({
      orderNumber: form.orderNumber.trim(),
      description: form.description.trim(),
      supplierId: form.supplierId || null,
      governmentEntityId: form.governmentEntityId || null,
      departmentId: form.departmentId || null,
      contactId: form.contactId || null,
      companyId: form.companyId || null,
      contractId: form.contractId || null,
      projectId: form.projectId || null,
      tenderId: form.tenderId || null,
      practiceId: form.practiceId || null,
      orderDate: form.orderDate || null,
      deliveryDate: form.deliveryDate || null,
      amount: form.amount || null,
      status: form.status || "new",
      priority: form.priority || "medium",
      assignedToUserId: form.assignedToUserId || null,
      followUpManagerId: form.followUpManagerId || null,
      poFileUrl: form.poFileUrl || null,
      notes: form.notes || null,
    });
  };

  const handleAdvanceStage = () => {
    const idx = STAGES.findIndex((s) => s.key === form.executionStage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const nextStage = STAGES[idx + 1].key;
    set("executionStage", nextStage);
    updateMut.mutate({ executionStage: nextStage });
  };

  // الرجوع خطوة واحدة للمرحلة السابقة — متاح للمدير والموظف (بنفس صلاحية التقدم)
  const handleRevertStage = () => {
    const idx = STAGES.findIndex((s) => s.key === form.executionStage);
    if (idx <= 0) return;
    const prevStage = STAGES[idx - 1].key;
    if (!confirm(`الرجوع إلى مرحلة "${STAGES[idx - 1].label}"؟`)) return;
    set("executionStage", prevStage);
    updateMut.mutate({ executionStage: prevStage });
  };

  if (!po || !form) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>جارِ التحميل...</div>;

  const stageIdx = Math.max(0, STAGES.findIndex((s) => s.key === form.executionStage));
  const completionPct = Math.round(((stageIdx + 1) / STAGES.length) * 100);
  const itemsTotal = items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const priority = PRIORITY_MAP[form.priority] ?? PRIORITY_MAP.medium;
  const p = profitability;
  const isProfit = p ? p.profit >= 0 : true;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <button onClick={() => navigate("/purchase-orders")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0, marginBottom: 8 }}>
            <ArrowRight size={13} /> أوامر الشراء
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: GR, margin: 0, fontFamily: "monospace" }}>{po.orderNumber}</h1>
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${priority.color}15`, color: priority.color }}>{priority.label}</span>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{po.description}</p>
        </div>
        {canEdit && (
          <button onClick={() => { if (confirm(`حذف أمر الشراء ${po.orderNumber}؟`)) deleteMut.mutate(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#fff1f2", border: "1.5px solid #fecaca", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
            <Trash2 size={13} /> حذف الطلب
          </button>
        )}
      </div>

      {/* Execution stage tracker */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={sectionTitle}>مراحل التنفيذ — {completionPct}% مكتمل</span>
          <div style={{ display: "flex", gap: 6 }}>
            {canEdit && stageIdx > 0 && (
              <button onClick={handleRevertStage} disabled={updateMut.isPending} title="التراجع خطوة واحدة للمرحلة السابقة" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: "white", border: "1.5px solid #e5e7eb", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>
                ↩ رجوع للمرحلة السابقة
              </button>
            )}
            {canEdit && stageIdx < STAGES.length - 1 && (
              <button onClick={handleAdvanceStage} disabled={updateMut.isPending} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
                المرحلة التالية <StageArrow size={12} />
              </button>
            )}
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "#f3f4f6", overflow: "hidden", marginBottom: 14 }}>
          <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${G},${GD})`, width: `${completionPct}%`, transition: "width 0.3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          {STAGES.map((s, i) => (
            <div key={s.key} style={{ flex: 1, minWidth: 90, textAlign: "center" }}>
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
                <span>{STAGES.find((s) => s.key === h.stage)?.label ?? h.stage} {h.changedByName ? `— ${h.changedByName}` : ""}</span>
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
            <div style={sectionTitle}>بيانات أمر الشراء</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>رقم أمر الشراء *</label><input value={form.orderNumber ?? ""} onChange={(e) => set("orderNumber", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الحالة</label><select value={form.status ?? "new"} onChange={(e) => set("status", e.target.value)} style={inp} disabled={!canEdit}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={lbl}>المورد</label><select value={form.supplierId ?? ""} onChange={(e) => set("supplierId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— اختر —</option>{suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label style={lbl}>الشركة المشاركة</label><select value={form.companyId ?? ""} onChange={(e) => set("companyId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— اختر —</option>{companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label style={lbl}>المشروع</label><select value={form.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— بدون —</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label style={lbl}>العقد المرتبط</label><select value={form.contractId ?? ""} onChange={(e) => set("contractId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— بدون —</option>{contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNumber}</option>)}</select></div>
              <div><label style={lbl}>المناقصة المرتبطة</label><select value={form.tenderId ?? ""} onChange={(e) => set("tenderId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— بدون —</option>{tenders.map((t: any) => <option key={t.id} value={t.id}>{t.tenderNumber}</option>)}</select></div>
              <div><label style={lbl}>الممارسة المرتبطة</label><select value={form.practiceId ?? ""} onChange={(e) => set("practiceId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— بدون —</option>{practices.map((p: any) => <option key={p.id} value={p.id}>{p.practiceNumber}</option>)}</select></div>
              <div><label style={lbl}>تاريخ الإصدار</label><input type="date" value={form.orderDate ?? ""} onChange={(e) => set("orderDate", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>تاريخ التسليم</label><input type="date" value={form.deliveryDate ?? ""} onChange={(e) => set("deliveryDate", e.target.value)} style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>القيمة التقديرية (د.ك)</label><input type="number" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} dir="ltr" style={inp} disabled={!canEdit} /></div>
              <div><label style={lbl}>الأولوية</label><select value={form.priority ?? "medium"} onChange={(e) => set("priority", e.target.value)} style={inp} disabled={!canEdit}>{Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>الجهة الحكومية ← الاختصاص ← المسؤول</label>
                <EntityDirectoryPicker
                  value={{ governmentEntityId: form.governmentEntityId, departmentId: form.departmentId, contactId: form.contactId }}
                  onChange={next => setForm((f: any) => ({ ...f, ...next }))}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>وصف الشراء *</label><textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} disabled={!canEdit} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>نسخة أمر الشراء</label><FileUpload objectPath={form.poFileUrl} onChange={(p) => set("poFileUrl", p)} label="رفع أمر الشراء" disabled={!canEdit} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>ملاحظات</label><textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" } as any} disabled={!canEdit} /></div>
            {canEdit && (
              <button onClick={handleSaveInfo} disabled={updateMut.isPending} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", width: "100%", borderRadius: 10, background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <Save size={14} /> {updateMut.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            )}
          </div>

          {/* Team */}
          <div style={cardStyle}>
            <div style={sectionTitle}>فريق التنفيذ</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>مسؤول التنفيذ</label><select value={form.assignedToUserId ?? ""} onChange={(e) => set("assignedToUserId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— غير محدد —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
              <div><label style={lbl}>مدير المتابعة</label><select value={form.followUpManagerId ?? ""} onChange={(e) => set("followUpManagerId", e.target.value)} style={inp} disabled={!canEdit}><option value="">— غير محدد —</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
            </div>
            {canEdit && (
              <button onClick={handleSaveInfo} disabled={updateMut.isPending} style={{ marginBottom: 12, padding: "7px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: "white", border: `1px solid ${G}88`, color: GD, cursor: "pointer", fontFamily: "inherit" }}>حفظ التعيين</button>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7280" }}>أعضاء الفريق ({team.length})</span>
              {canEdit && <button onClick={() => setAddingMember((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "white", border: `1px solid ${G}88`, color: GD, cursor: "pointer", fontFamily: "inherit" }}><Plus size={11} /> إضافة</button>}
            </div>
            {addingMember && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, maxHeight: 160, overflowY: "auto" }}>
                {users.filter((u: any) => !team.some((t: any) => t.userId === u.id)).map((u: any) => (
                  <button key={u.id} onClick={() => addMemberMut.mutate(u.id)} style={{ textAlign: "right", padding: "6px 10px", borderRadius: 7, background: "#fafaf8", border: "1px solid #e5e7eb", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>{u.fullName}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {team.map((m: any) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8", fontSize: 12 }}>
                  <span>{m.fullName}</span>
                  {canEdit && <button onClick={() => removeMemberMut.mutate(m.userId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><X size={12} /></button>}
                </div>
              ))}
              {team.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "8px 0 0" }}>لا يوجد أعضاء فريق</p>}
            </div>
          </div>
        </div>

        {/* Right: items + costs + profitability */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Items */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <ShoppingCart size={13} color={GD} />
              <span style={sectionTitle}>الأصناف المطلوبة ({items.length}) — الإجمالي: {fmt(itemsTotal)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {items.map((it: any) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 8, background: "#fafaf8", border: "1px solid #f0ead8", fontSize: 11.5 }}>
                  <span style={{ flex: 2, fontWeight: 700, color: GR }}>{it.itemName}</span>
                  <span style={{ flex: 1, color: "#6b7280" }}>{it.quantity} {it.unit}</span>
                  <span style={{ flex: 1, color: "#6b7280", direction: "ltr" as const }}>{fmt(it.unitPrice)}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: GD, direction: "ltr" as const }}>{fmt((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))}</span>
                  {canEdit && <button onClick={() => deleteItemMut.mutate(it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><X size={12} /></button>}
                </div>
              ))}
              {items.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, margin: "8px 0" }}>لا توجد أصناف بعد</p>}
            </div>
            {canEdit && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6 }}>
                <input value={newItem.itemName} onChange={(e) => setNewItem((f) => ({ ...f, itemName: e.target.value }))} placeholder="اسم الصنف" style={inp} />
                <input value={newItem.quantity} onChange={(e) => setNewItem((f) => ({ ...f, quantity: e.target.value }))} placeholder="الكمية" type="number" style={inp} />
                <input value={newItem.unitPrice} onChange={(e) => setNewItem((f) => ({ ...f, unitPrice: e.target.value }))} placeholder="السعر" type="number" style={inp} />
                <button onClick={() => newItem.itemName.trim() && addItemMut.mutate({ ...newItem, quantity: newItem.quantity || null, unitPrice: newItem.unitPrice || null })} style={{ padding: "0 12px", borderRadius: 9, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer" }}><Plus size={14} /></button>
              </div>
            )}
          </div>

          {/* Actual costs */}
          {canEdit && (
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Banknote size={13} color={GD} />
                <span style={sectionTitle}>التكاليف الفعلية ({costs.length})</span>
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

          {/* Profitability */}
          {p && (
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <TrendingUp size={13} color={GD} />
                <span style={sectionTitle}>تحليل الربحية</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <StatCard label="قيمة أمر الشراء" value={p.revenue} color={GR} />
                <StatCard label="إجمالي التكاليف الفعلية" value={p.totalCost} color="#dc2626" />
              </div>
              <div style={{ marginTop: 10, background: isProfit ? "#f0fdf4" : "#fff1f2", border: `1.5px solid ${isProfit ? "#bbf7d0" : "#fecaca"}`, borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {isProfit ? <TrendingUp size={13} color="#16a34a" /> : <TrendingDown size={13} color="#dc2626" />}
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>الربح ({p.profitPct.toFixed(1)}%)</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: isProfit ? "#16a34a" : "#dc2626", direction: "ltr" as const, textAlign: "right" as const }}>{fmt(p.profit)}</div>
              </div>
              {p.expenses.byCategory.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {p.expenses.byCategory.map((c: any) => (
                    <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f9fafb", fontSize: 11.5 }}>
                      <span style={{ color: "#374151" }}>{EXPENSE_CAT_AR[c.category] ?? c.category}</span>
                      <span style={{ fontWeight: 700, color: "#d97706", direction: "ltr" as const }}>{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Linked pricing sheets */}
          <div style={cardStyle}>
            <LinkedPricingSheets entityType="purchaseOrder" entityId={poId} />
          </div>

          {/* Linked tasks */}
          <div style={cardStyle}>
            <LinkedTasks entityType="purchaseOrder" entityId={poId} />
          </div>
        </div>
      </div>
    </div>
  );
}
