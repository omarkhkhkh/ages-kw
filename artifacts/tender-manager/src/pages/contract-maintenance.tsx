import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { maintenanceServiceApi as ms, maintenanceApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Plus, Trash2, ClipboardList, FileText, MapPin, BarChart3, ChevronRight, ShieldCheck, AlertTriangle, ScrollText, Receipt, Undo2, X, Download, CalendarClock, Link2 } from "lucide-react";

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const card: CSSProperties = { background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginBottom: 16 };
const inp: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const th: CSSProperties = { padding: "9px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", textAlign: "right", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f5f0e6" };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const delBtn: CSSProperties = { background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, padding: 5, cursor: "pointer", display: "inline-flex" };
const fmt = (d: any) => (d ? String(d).slice(0, 10) : "—");
const COVERAGE_COLOR: Record<string, string> = { "ضمان": "#7c3aed", "ضمن العقد": "#16a34a", "خارج العقد": "#dc2626" };

const TABS = [
  { key: "visits", label: "الزيارات", icon: ClipboardList },
  { key: "contracts", label: "العقود", icon: FileText },
  { key: "hierarchy", label: "الهيكل والكتالوج", icon: MapPin },
  { key: "registers", label: "السجلات", icon: ScrollText },
  { key: "billing", label: "الفوترة", icon: Receipt },
  { key: "analytics", label: "التحليلات", icon: BarChart3 },
];

export default function ContractMaintenance() {
  const { user } = useAuth();
  const canView = user?.role === "admin" || !!(user as any)?.accessMaintenance;
  const [tab, setTab] = useState("visits");
  if (!canView) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>هذه الصفحة لمن لديه صلاحية الصيانة.</div>;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Segoe UI',Tahoma,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
        <Wrench size={22} color={GD} />
        <h1 style={{ fontSize: 21, fontWeight: 800, color: GR, margin: 0 }}>صيانة العقود — ورش الدراسات العملية</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 18px 14px" }}>الزيارات وبنودها · العقود ومصفوفة التغطية · الهيكل التعليمي · السجلات الرسمية · التحليلات.</p>

      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 14, border: "1.5px solid #f0ead8", padding: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: tab === t.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: tab === t.key ? "white" : "#374151" }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "visits" && <VisitsTab />}
      {tab === "contracts" && <ContractsTab />}
      {tab === "hierarchy" && <HierarchyTab />}
      {tab === "registers" && <RegistersTab />}
      {tab === "billing" && <BillingTab />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

/* ─────────── الزيارات ─────────── */
export function VisitsTab() {
  const qc = useQueryClient(); const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState({ schoolId: "", visitDate: "", maintenanceType: "دورية" });
  const { data: visits = [] } = useQuery({ queryKey: ["ms-visits"], queryFn: () => ms.visits.list() });
  const { data: schools = [] } = useQuery({ queryKey: ["ms-schools"], queryFn: () => ms.schools.list() });
  const createM = useMutation({
    mutationFn: () => ms.visits.create({ schoolId: Number(form.schoolId), visitDate: form.visitDate, maintenanceType: form.maintenanceType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ms-visits"] }); setForm({ schoolId: "", visitDate: "", maintenanceType: "دورية" }); toast({ title: "✅ أُنشئت الزيارة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (selected) return <VisitDetail visitId={selected} onBack={() => setSelected(null)} />;

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GD, marginBottom: 10 }}>زيارة جديدة</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1.2fr auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>المدرسة *</label>
            <select style={inp} value={form.schoolId} onChange={(e) => setForm((p) => ({ ...p, schoolId: e.target.value }))}>
              <option value="">— اختر —</option>{(schools as any[]).map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
            </select></div>
          <div><label style={lbl}>تاريخ الزيارة *</label><input type="date" style={inp} value={form.visitDate} onChange={(e) => setForm((p) => ({ ...p, visitDate: e.target.value }))} /></div>
          <div><label style={lbl}>النوع</label>
            <select style={inp} value={form.maintenanceType} onChange={(e) => setForm((p) => ({ ...p, maintenanceType: e.target.value }))}><option>دورية</option><option>طارئة</option></select></div>
          <button style={{ ...btn, height: 38 }} disabled={!form.schoolId || !form.visitDate || createM.isPending} onClick={() => createM.mutate()}><Plus size={15} /> إنشاء</button>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["رقم الزيارة", "المدرسة", "التاريخ", "النوع", "الحالة", "البنود", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(visits as any[]).length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={7}>لا توجد زيارات بعد</td></tr> :
              (visits as any[]).map((v) => (
                <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => setSelected(v.id)}>
                  <td style={{ ...td, fontWeight: 700, color: GR }}>{v.visitNumber}</td>
                  <td style={td}>{v.schoolName}</td><td style={td}>{fmt(v.visitDate)}</td><td style={td}>{v.maintenanceType}</td>
                  <td style={td}><span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#f0ead8", color: GD }}>{v.status}</span></td>
                  <td style={td}>{v.lineCount}</td>
                  <td style={td}><ChevronRight size={16} color="#9ca3af" /></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VisitDetail({ visitId, onBack }: { visitId: number; onBack: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: visit } = useQuery({ queryKey: ["ms-visit", visitId], queryFn: () => ms.visits.get(visitId) });
  const { data: equipment = [] } = useQuery({ queryKey: ["mnt-equipment"], queryFn: () => apiFetch<any[]>("/api/maintenance/equipment") });
  const [lf, setLf] = useState({ equipmentId: "", isIncluded: true, condition: "جيدة", exclusionReason: "تعذّر الوصول للورشة", worksDone: "" });
  const inv = () => qc.invalidateQueries({ queryKey: ["ms-visit", visitId] });
  const addM = useMutation({
    mutationFn: () => ms.visits.addLine(visitId, { equipmentId: Number(lf.equipmentId), isIncluded: lf.isIncluded, condition: lf.condition, exclusionReason: lf.exclusionReason, worksDone: lf.worksDone || undefined }),
    onSuccess: () => { inv(); setLf((p) => ({ ...p, equipmentId: "", worksDone: "" })); toast({ title: "✅ أُضيف البند" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const genM = useMutation({ mutationFn: (lineId: number) => ms.visits.generateWorkOrder(lineId), onSuccess: (r: any) => { inv(); toast({ title: `تم توليد أمر: ${r.orderNumber}` }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  // التقرير الرسمي يمرّ بمحرّك القوالب الموحّد: رقم رسمي + قيد تلقائي في سجل الصادر
  const reportM = useMutation({
    mutationFn: () => maintenanceApi.generateContractVisitReport(visitId, { visitNumber: visit?.visitNumber }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ms-outgoing"] }); toast({ title: "✅ صدر التقرير وقُيّد في سجل الصادر" }); },
    onError: (e: any) => toast({ title: "تعذّر إصدار التقرير", description: e.message, variant: "destructive" }),
  });
  const [billing, setBilling] = useState<number | null>(null);
  const delM = useMutation({ mutationFn: (lineId: number) => ms.visits.deleteLine(lineId), onSuccess: inv });

  const lines: any[] = visit?.lines ?? [];
  return (
    <>
      {billing != null && <BillModal lineId={billing} onClose={() => { setBilling(null); inv(); }} />}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ ...btn, background: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" }}>→ رجوع للزيارات</button>
        <button onClick={() => reportM.mutate()} disabled={reportM.isPending || !lines.length} style={{ ...btn, opacity: lines.length ? 1 : .5 }}>
          <Download size={14} /> {reportM.isPending ? "جارٍ الإصدار…" : "إصدار تقرير رسمي"}</button>
      </div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div><div style={{ fontSize: 17, fontWeight: 800, color: GR }}>{visit?.visitNumber}</div>
            <div style={{ fontSize: 12.5, color: "#6b7280" }}>{visit?.schoolName} · {fmt(visit?.visitDate)} · {visit?.maintenanceType}</div></div>
          <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#f0ead8", color: GD, height: "fit-content" }}>{visit?.status}</span>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GD, marginBottom: 10 }}>إضافة بند (مكينة) — تُحسب التغطية تلقائيًا حسب تاريخ الزيارة</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1.5fr auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>المكينة *</label>
            <select style={inp} value={lf.equipmentId} onChange={(e) => setLf((p) => ({ ...p, equipmentId: e.target.value }))}>
              <option value="">— اختر —</option>{(equipment as any[]).map((e) => <option key={e.id} value={e.id}>{e.assetNumber} — {e.name}</option>)}</select></div>
          <div><label style={lbl}>الحالة</label>
            <select style={inp} value={lf.isIncluded ? lf.condition : "استبعاد"} onChange={(e) => { const v = e.target.value; if (v === "استبعاد") setLf((p) => ({ ...p, isIncluded: false })); else setLf((p) => ({ ...p, isIncluded: true, condition: v })); }}>
              <option value="جيدة">جيدة</option><option value="تحتاج صيانة">تحتاج صيانة</option><option value="استبعاد">مستبعَد</option></select></div>
          {lf.isIncluded
            ? <div><label style={lbl}>الأعمال المنفّذة</label><input style={inp} value={lf.worksDone} onChange={(e) => setLf((p) => ({ ...p, worksDone: e.target.value }))} placeholder="اختياري" /></div>
            : <div><label style={lbl}>سبب الاستبعاد</label><select style={inp} value={lf.exclusionReason} onChange={(e) => setLf((p) => ({ ...p, exclusionReason: e.target.value }))}>{["تعذّر الوصول للورشة", "المكينة غير موجودة بالموقع", "المكينة خارج العقد", "خُدمت في زيارة سابقة", "بطلب من إدارة المدرسة"].map((r) => <option key={r}>{r}</option>)}</select></div>}
          <button style={{ ...btn, height: 38 }} disabled={!lf.equipmentId || addM.isPending} onClick={() => addM.mutate()}><Plus size={15} /> إضافة</button>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["#", "المكينة", "الحالة", "التغطية", "أمر الصيانة", "الفوترة", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {lines.length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={7}>لا بنود بعد</td></tr> :
              lines.map((l) => {
                const path = l.coverageDecision?.path;
                return (
                  <tr key={l.id}>
                    <td style={td}>{l.lineNo}</td>
                    <td style={td}><b>{l.assetNumber}</b> — {l.equipmentName}</td>
                    <td style={td}>{l.isIncluded ? l.condition : <span style={{ color: "#dc2626" }}>مستبعَد: {l.exclusionReason}</span>}</td>
                    <td style={td}>{path ? <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${COVERAGE_COLOR[path] || "#6b7280"}18`, color: COVERAGE_COLOR[path] || "#6b7280" }}>{path}</span> : "—"}</td>
                    <td style={td}>{l.workOrderId ? <span style={{ color: "#16a34a", fontWeight: 700 }}>#{l.workOrderId}</span> :
                      (l.condition === "تحتاج صيانة" ? <button style={{ ...btn, padding: "5px 10px", fontSize: 12 }} disabled={genM.isPending} onClick={() => genM.mutate(l.id)}><Wrench size={12} /> توليد أمر</button> : "—")}</td>
                    <td style={td}>{l.incomeId
                      ? <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 12 }}>{Number(l.billedAmount).toFixed(3)} د.ك</span>
                      : (path === "خارج العقد" || path === "ضمن العقد"
                          ? <button style={{ ...btn, padding: "5px 10px", fontSize: 12, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }} onClick={() => setBilling(l.id)}><Receipt size={12} /> فوترة</button>
                          : "—")}</td>
                    <td style={td}><button style={delBtn} onClick={() => delM.mutate(l.id)}><Trash2 size={13} color="#dc2626" /></button></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─────────── العقود ─────────── */
export function ContractsTab() {
  const qc = useQueryClient(); const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState({ contractNumber: "", districtId: "", contractType: "شامل", billingModel: "مختلط", startDate: "", endDate: "", pmVisitsPerYear: "" });
  const { data: contracts = [] } = useQuery({ queryKey: ["ms-contracts"], queryFn: () => ms.serviceContracts.list() });
  const { data: districts = [] } = useQuery({ queryKey: ["ms-districts"], queryFn: () => ms.districts.list() });
  const { data: coverage = [] } = useQuery({ queryKey: ["ms-coverage", selected], queryFn: () => ms.coverage.list({ contractId: selected! }), enabled: !!selected });
  const createM = useMutation({
    mutationFn: () => ms.serviceContracts.create({ ...form, districtId: Number(form.districtId), pmVisitsPerYear: form.pmVisitsPerYear ? Number(form.pmVisitsPerYear) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ms-contracts"] }); setForm({ contractNumber: "", districtId: "", contractType: "شامل", billingModel: "مختلط", startDate: "", endDate: "", pmVisitsPerYear: "" }); toast({ title: "✅ أُضيف العقد" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const dName = (id: number) => (districts as any[]).find((d) => d.id === id)?.nameAr ?? id;

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GD, marginBottom: 10 }}>عقد صيانة جديد</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr)) auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>رقم العقد *</label><input style={inp} value={form.contractNumber} onChange={(e) => setForm((p) => ({ ...p, contractNumber: e.target.value }))} /></div>
          <div><label style={lbl}>المنطقة *</label><select style={inp} value={form.districtId} onChange={(e) => setForm((p) => ({ ...p, districtId: e.target.value }))}><option value="">—</option>{(districts as any[]).map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}</select></div>
          <div><label style={lbl}>النوع</label><select style={inp} value={form.contractType} onChange={(e) => setForm((p) => ({ ...p, contractType: e.target.value }))}>{["شامل", "وقائي فقط", "تحت الطلب", "ضمان ممتد"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label style={lbl}>الفوترة</label><select style={inp} value={form.billingModel} onChange={(e) => setForm((p) => ({ ...p, billingModel: e.target.value }))}>{["مقطوع سنوي", "لكل زيارة", "قطع وأجرة", "مختلط"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label style={lbl}>من *</label><input type="date" style={inp} value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
          <div><label style={lbl}>إلى *</label><input type="date" style={inp} value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
          <div><label style={lbl}>زيارات وقائية/سنة</label><input type="number" style={inp} value={form.pmVisitsPerYear} onChange={(e) => setForm((p) => ({ ...p, pmVisitsPerYear: e.target.value }))} /></div>
          <button style={{ ...btn, height: 38 }} disabled={!form.contractNumber || !form.districtId || !form.startDate || !form.endDate || createM.isPending} onClick={() => createM.mutate()}><Plus size={15} /> إضافة</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1.3fr 1fr" : "1fr", gap: 16 }}>
        <div style={{ ...card, padding: 0, overflowX: "auto", marginBottom: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead style={{ background: "#faf8f2" }}><tr>{["العقد", "المنطقة", "النوع", "الفوترة", "زيارات", "الحالة"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(contracts as any[]).map((c) => (
                <tr key={c.id} style={{ cursor: "pointer", background: selected === c.id ? "#faf8f2" : undefined }} onClick={() => setSelected(c.id)}>
                  <td style={{ ...td, fontWeight: 700, color: GR }}>{c.contractNumber}</td><td style={td}>{dName(c.districtId)}</td>
                  <td style={td}>{c.contractType}</td><td style={td}>{c.billingModel}</td><td style={td}>{c.pmVisitsPerYear ?? "—"}</td>
                  <td style={td}><span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.status === "نشط" ? "#dcfce7" : "#f3f4f6", color: c.status === "نشط" ? "#166534" : "#6b7280" }}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: GR, marginBottom: 10 }}>مصفوفة التغطية</div>
            {(coverage as any[]).length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>لا بنود تغطية.</div> :
              (coverage as any[]).map((it) => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5f0e6" }}>
                  <span style={{ fontSize: 12.5, color: "#374151" }}>{it.itemLabelAr}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: it.coverage === "غير مشمول" ? "#dc2626" : it.coverage === "مشمول بسقف" ? "#d97706" : "#16a34a" }}>
                    {it.coverage}{it.coverage === "مشمول بسقف" ? ` (${Number(it.annualCap)})` : ""}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────── الهيكل والكتالوج ─────────── */
function MiniCrud({ title, api, cols, fields, extraOptions }: { title: string; api: any; cols: [string, string][]; fields: { key: string; label: string; type?: string; options?: any[]; optLabel?: (o: any) => string }[]; extraOptions?: any }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const key = ["ms-crud", title];
  const { data = [] } = useQuery({ queryKey: key, queryFn: () => api.list() });
  const [form, setForm] = useState<Record<string, string>>({});
  const createM = useMutation({
    mutationFn: () => api.create(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, fields.find((f) => f.key === k)?.type === "number" ? Number(v) : v]))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setForm({}); toast({ title: "✅ تمت الإضافة" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delM = useMutation({ mutationFn: (id: number) => api.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const required = fields.filter((f) => f.label.includes("*")).map((f) => f.key);
  const valid = required.every((k) => (form[k] ?? "").toString().trim());
  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 800, color: GD, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${fields.length}, 1fr) auto`, gap: 8, alignItems: "end", marginBottom: 12 }}>
        {fields.map((f) => (
          <div key={f.key}><label style={lbl}>{f.label}</label>
            {f.options ? <select style={inp} value={form[f.key] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}><option value="">—</option>{f.options.map((o) => <option key={o.id} value={o.id}>{f.optLabel ? f.optLabel(o) : o.nameAr}</option>)}</select>
              : <input style={inp} type={f.type || "text"} value={form[f.key] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />}
          </div>
        ))}
        <button style={{ ...btn, height: 38 }} disabled={!valid || createM.isPending} onClick={() => createM.mutate()}><Plus size={14} /></button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#faf8f2" }}><tr>{cols.map(([, h]) => <th key={h} style={th}>{h}</th>)}<th style={th}></th></tr></thead>
          <tbody>
            {(data as any[]).map((r) => (
              <tr key={r.id}>{cols.map(([k]) => <td key={k} style={td}>{extraOptions?.[k] ? extraOptions[k](r[k]) : (r[k] ?? "—")}</td>)}
                <td style={td}><button style={delBtn} onClick={() => delM.mutate(r.id)}><Trash2 size={13} color="#dc2626" /></button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HierarchyTab() {
  const { data: districts = [] } = useQuery({ queryKey: ["ms-districts"], queryFn: () => ms.districts.list() });
  return (
    <>
      <MiniCrud title="المناطق التعليمية" api={ms.districts} cols={[["nameAr", "المنطقة"], ["contactPhone", "هاتف"]]}
        fields={[{ key: "nameAr", label: "الاسم *" }, { key: "contactPhone", label: "هاتف" }]} />
      <MiniCrud title="المدارس" api={ms.schools} cols={[["nameAr", "المدرسة"], ["districtId", "المنطقة"]]}
        fields={[{ key: "nameAr", label: "الاسم *" }, { key: "districtId", label: "المنطقة *", options: districts as any[] }]}
        extraOptions={{ districtId: (id: number) => (districts as any[]).find((d) => d.id === id)?.nameAr ?? id }} />
      <MiniCrud title="أنواع المكائن (الكتالوج)" api={ms.equipmentTypes} cols={[["code", "الرمز"], ["nameAr", "الاسم"], ["nameEn", "EN"]]}
        fields={[{ key: "code", label: "الرمز *" }, { key: "nameAr", label: "الاسم *" }, { key: "nameEn", label: "الإنجليزي" }]} />
      <MiniCrud title="العبارات الجاهزة" api={ms.standardPhrases} cols={[["category", "التصنيف"], ["textAr", "العبارة"]]}
        fields={[{ key: "category", label: "التصنيف *", options: [{ id: "فحص" }, { id: "عطل" }, { id: "إجراء" }], optLabel: (o: any) => o.id }, { key: "textAr", label: "العبارة *" }]} />
    </>
  );
}

/* ─────────── السجلات ─────────── */
export function RegistersTab() {
  const qc = useQueryClient(); const { toast } = useToast();
  const [out, setOut] = useState({ docType: "تقرير زيارة", subject: "" });
  const { data: outgoing = [] } = useQuery({ queryKey: ["ms-outgoing"], queryFn: () => ms.outgoingRegister.list() });
  const addOut = useMutation({ mutationFn: () => ms.outgoingRegister.create(out), onSuccess: () => { qc.invalidateQueries({ queryKey: ["ms-outgoing"] }); setOut({ docType: "تقرير زيارة", subject: "" }); toast({ title: "✅ سُجّل الصادر" }); }, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GD, marginBottom: 10 }}>سجل الصادر — رقم رسمي تلقائي</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>نوع المستند</label><select style={inp} value={out.docType} onChange={(e) => setOut((p) => ({ ...p, docType: e.target.value }))}>{["تقرير زيارة", "مطالبة مالية", "عرض سعر", "محضر استلام", "كتاب رسمي"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label style={lbl}>الموضوع</label><input style={inp} value={out.subject} onChange={(e) => setOut((p) => ({ ...p, subject: e.target.value }))} /></div>
          <button style={{ ...btn, height: 38 }} disabled={addOut.isPending} onClick={() => addOut.mutate()}><Plus size={15} /> تسجيل</button>
        </div>
      </div>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["الرقم", "النوع", "الموضوع", "الحالة", "التاريخ"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(outgoing as any[]).length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={5}>لا سجلات</td></tr> :
              (outgoing as any[]).map((r) => (
                <tr key={r.id}><td style={{ ...td, fontWeight: 700, color: GR, fontFamily: "monospace" }}>{r.docNumber}</td><td style={td}>{r.docType}</td><td style={td}>{r.subject || "—"}</td><td style={td}>{r.status}</td><td style={td}>{fmt(r.issuedAt)}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─────────── التحليلات ─────────── */
export function AnalyticsTab() {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: balance = [] } = useQuery({ queryKey: ["ms-balance"], queryFn: () => ms.analytics.contractVisitBalance() });
  const { data: pending = [] } = useQuery({ queryKey: ["ms-pending"], queryFn: () => ms.analytics.pendingReschedule() });
  const { data: pmCoverage = [] } = useQuery({ queryKey: ["ms-pm-coverage"], queryFn: () => ms.analytics.contractPmCoverage() });
  const autoLinkM = useMutation({
    mutationFn: () => ms.preventivePlans.autoLink(),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["ms-pm-coverage"] }); qc.invalidateQueries({ queryKey: ["maintenance-preventive-plans"] }); toast({ title: `رُبطت ${r.linked} خطة بعقودها` }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  return (
    <>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "14px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}><CalendarClock size={16} color={GD} /> تغطية الصيانة الوقائية لكل عقد نشط</span>
          <button style={{ ...btn, padding: "6px 12px", fontSize: 12 }} disabled={autoLinkM.isPending} onClick={() => autoLinkM.mutate()}><Link2 size={13} /> ربط الخطط بعقودها تلقائيًا</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["العقد", "المنطقة", "مكائن العقد", "لها خطة", "بلا خطة", "مستحقة خلال ٣٠ يومًا", "متأخرة"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(pmCoverage as any[]).length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={7}>لا عقود نشطة</td></tr> :
              (pmCoverage as any[]).map((r) => (
                <tr key={r.contractId}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.contractNumber}</td><td style={td}>{r.district ?? "—"}</td>
                  <td style={td}>{r.equipmentCount}</td><td style={{ ...td, color: "#16a34a" }}>{r.equipmentWithPlan}</td>
                  <td style={{ ...td, fontWeight: 800, color: Number(r.uncovered) > 0 ? "#dc2626" : "#16a34a" }}>{r.uncovered}</td>
                  <td style={td}>{r.dueWithin30Days}</td>
                  <td style={{ ...td, fontWeight: 700, color: Number(r.overdue) > 0 ? "#dc2626" : "#6b7280" }}>{r.overdue}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "14px 16px 4px", fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}><ShieldCheck size={16} color={GD} /> رصيد الزيارات الوقائية لكل عقد نشط</div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["العقد", "المنطقة", "مستحق", "منفَّذ", "متبقٍّ"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(balance as any[]).length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={5}>لا عقود نشطة</td></tr> :
              (balance as any[]).map((r, i) => (
                <tr key={i}><td style={{ ...td, fontWeight: 700 }}>{r.contractNumber}</td><td style={td}>{r.district}</td><td style={td}>{r.due ?? "—"}</td><td style={td}>{r.executed}</td>
                  <td style={{ ...td, fontWeight: 800, color: Number(r.remaining) > 0 ? "#dc2626" : "#16a34a" }}>{r.remaining}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "14px 16px 4px", fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}><AlertTriangle size={16} color="#d97706" /> بنود بانتظار إعادة الجدولة (استُبعدت لتعذّر الوصول)</div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["المدرسة", "المكينة", "النوع", "تاريخ الزيارة", "السبب"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(pending as any[]).length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={5}>لا بنود معلّقة</td></tr> :
              (pending as any[]).map((r, i) => (
                <tr key={i}><td style={td}>{r.school}</td><td style={td}>{r.assetNumber}</td><td style={td}>{r.equipmentType ?? "—"}</td><td style={td}>{fmt(r.visitDate)}</td><td style={{ ...td, color: "#dc2626" }}>{r.exclusionReason}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─────────── الفوترة (تحويل العمل غير المشمول إلى إيراد) ─────────── */

/** نافذة عرض السعر: تشرح لماذا يُفوتَر البند ومن أين جاء كل رقم، والمبلغ يبقى قابلًا للتعديل. */
function BillModal({ lineId, onClose }: { lineId: number; onClose: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: q, isLoading } = useQuery({ queryKey: ["ms-quote", lineId], queryFn: () => ms.billing.quote(lineId) });
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const amountValue = amount !== "" ? amount : (q?.suggestedAmount ?? "");

  const billM = useMutation({
    mutationFn: () => ms.billing.bill(lineId, { amount: amountValue, date: date || undefined, description: description || undefined }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["ms-billing-pending"] });
      qc.invalidateQueries({ queryKey: ["ms-billing-billed"] });
      qc.invalidateQueries({ queryKey: ["ms-visit"] });
      toast({ title: `✅ سُجّل إيراد ${Number(r.amount).toFixed(3)} د.ك` });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,26,16,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, border: `1.5px solid ${G}33`, width: "min(680px,100%)", maxHeight: "88vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}><Receipt size={17} color={GD} /> فوترة بند زيارة</div>
          <button onClick={onClose} style={{ ...delBtn, background: "#f8fafc", border: "1px solid #e2e8f0" }}><X size={14} color="#64748b" /></button>
        </div>

        {isLoading || !q ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>جارٍ حساب عرض السعر…</div> : (
          <>
            <div style={{ background: "#faf8f2", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12.5, color: "#374151", lineHeight: 1.9 }}>
              <div><b>{q.visitNumber}</b> · {q.school} · {q.assetNumber} — {q.equipmentName}</div>
              <div>مسار التغطية: <span style={{ fontWeight: 700, color: COVERAGE_COLOR[q.coveragePath] ?? "#6b7280" }}>{q.coveragePath ?? "—"}</span> · {q.reason}</div>
              <div>أساس التسعير: {q.pricingBasis}{q.contractNumber ? ` · عقد ${q.contractNumber}` : ""}</div>
            </div>

            {q.items?.length > 0 && (
              <div style={{ border: "1px solid #f0ead8", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#faf8f2" }}><tr>{["البند", "الكمية", "سعر الوحدة", "هامش %", "الإجمالي", "المصدر"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {q.items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td style={td}>{it.label}{it.itemCode ? <span style={{ color: "#9ca3af" }}> ({it.itemCode})</span> : null}</td>
                        <td style={td}>{it.quantity}</td>
                        <td style={td}>{Number(it.unitPrice).toFixed(3)}</td>
                        <td style={td}>{it.markupPct || 0}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{Number(it.total).toFixed(3)}</td>
                        <td style={{ ...td, fontSize: 11, color: it.source === "قائمة الأسعار" ? "#16a34a" : "#d97706" }}>{it.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "#6b7280", marginBottom: 14 }}>
              <span>التكلفة الفعلية للمرجع: <b style={{ color: "#374151" }}>{Number(q.actualCost).toFixed(3)} د.ك</b></span>
              {q.capOverage != null && <span>مقدار تجاوز السقف: <b style={{ color: "#dc2626" }}>{Number(q.capOverage).toFixed(3)} د.ك</b></span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div><label style={lbl}>المبلغ (د.ك) *</label>
                <input style={inp} type="number" step="0.001" value={amountValue} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><label style={lbl}>تاريخ الإيراد</label>
                <input style={inp} type="date" value={date || q.visitDate || ""} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={lbl}>الوصف (يُترك فارغًا ليُولَّد تلقائيًا)</label>
              <input style={inp} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`${q.coveragePath === "خارج العقد" ? "عمل خارج العقد" : "تجاوز سقف التغطية"} — زيارة ${q.visitNumber} · ${q.school} · ${q.equipmentName}`} /></div>

            {!q.billable
              ? <div style={{ padding: 12, borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12.5, fontWeight: 700 }}>{q.reason}</div>
              : <button style={{ ...btn, width: "100%", justifyContent: "center" }} disabled={billM.isPending || !Number(amountValue)} onClick={() => billM.mutate()}>
                  <Receipt size={15} /> {billM.isPending ? "جارٍ التسجيل…" : "تسجيل الإيراد"}
                </button>}
            <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10, marginBottom: 0, lineHeight: 1.8 }}>
              يُدرَج الإيراد في دفتر الإيرادات ويُصنَّف تلقائيًا على قسم «الصيانة»، وينعكس في دفتر الأحداث المالية.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function BillingTab() {
  const qc = useQueryClient(); const { toast } = useToast();
  const [billing, setBilling] = useState<number | null>(null);
  const { data: pending = [] } = useQuery({ queryKey: ["ms-billing-pending"], queryFn: () => ms.billing.pending() });
  const { data: billed = [] } = useQuery({ queryKey: ["ms-billing-billed"], queryFn: () => ms.billing.billed() });
  const unbillM = useMutation({
    mutationFn: (lineId: number) => ms.billing.unbill(lineId), // يعكس بقيد سالب — لا يحذف شيئًا
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ms-billing-pending"] });
      qc.invalidateQueries({ queryKey: ["ms-billing-billed"] });
      toast({ title: "أُلغيت الفوترة بقيد إيراد سالب معاكس" });
    },
    onError: (e: any) => toast({ title: "تعذّر التراجع", description: e.message, variant: "destructive" }),
  });
  const totalBilled = (billed as any[]).reduce((s, r) => s + Number(r.billedAmount || 0), 0);

  return (
    <>
      {billing != null && <BillModal lineId={billing} onClose={() => setBilling(null)} />}

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "14px 16px 4px", fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}>
          <Receipt size={16} color={GD} /> بنود مستحقة الفوترة — عمل خارج العقد أو متجاوز لسقف التغطية
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["الزيارة", "المدرسة", "المكينة", "التغطية", "أمر الصيانة", "تكلفة القطع", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(pending as any[]).length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={7}>لا بنود مستحقة — كل العمل مشمول بالعقود أو مفوتَر</td></tr> :
              (pending as any[]).map((r) => (
                <tr key={r.lineId}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.visitNumber}<div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>{fmt(r.visitDate)}</div></td>
                  <td style={td}>{r.school}</td>
                  <td style={td}><b>{r.assetNumber}</b> — {r.equipmentName}</td>
                  <td style={td}><span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${COVERAGE_COLOR[r.coveragePath] || "#6b7280"}18`, color: COVERAGE_COLOR[r.coveragePath] || "#6b7280" }}>{r.coveragePath}</span></td>
                  <td style={td}>{r.workOrderNumber ?? "—"}</td>
                  <td style={td}>{Number(r.partsCost).toFixed(3)}</td>
                  <td style={td}><button style={{ ...btn, padding: "5px 12px", fontSize: 12 }} onClick={() => setBilling(r.lineId)}><Receipt size={12} /> فوترة</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "14px 16px 4px", fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}><ScrollText size={16} color={GD} /> بنود مفوترة</span>
          <span style={{ fontSize: 12.5, color: "#16a34a" }}>إجمالي الإيراد المُحقَّق: <b>{totalBilled.toFixed(3)} د.ك</b></span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["الزيارة", "المدرسة", "المكينة", "المبلغ", "السبب", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(billed as any[]).length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={6}>لا بنود مفوترة بعد</td></tr> :
              (billed as any[]).map((r) => (
                <tr key={r.lineId}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.visitNumber}</td>
                  <td style={td}>{r.school}</td>
                  <td style={td}><b>{r.assetNumber}</b> — {r.equipmentName}</td>
                  <td style={{ ...td, fontWeight: 800, color: "#16a34a" }}>{Number(r.billedAmount).toFixed(3)}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.billingNote ?? "—"}</td>
                  <td style={td}><button style={{ ...delBtn, background: "#fffbeb", border: "1px solid #fde68a" }} title="التراجع عن الفوترة وحذف قيد الإيراد" disabled={unbillM.isPending} onClick={() => unbillM.mutate(r.lineId)}><Undo2 size={13} color="#d97706" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const lbl: CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 };
