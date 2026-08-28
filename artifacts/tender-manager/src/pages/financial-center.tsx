import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { financialCenterApi, caseFilesApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Gauge, BookOpen, PieChart, Wallet, Scale as ScaleIcon, CheckCircle2, XCircle, AlertTriangle, ShieldAlert, Plus, Trash2 } from "lucide-react";

/* ═══ المركز المالي — الأبواب الخمسة (الخارطة الموحّدة، المرحلة ٧ الأخيرة) ═══
   ① كيف حالنا؟ ② ما الذي يتحرك؟ ③ أين تذهب وماذا تربح؟ ④ ماذا خطّطنا؟ ⑤ ماذا ننتظر؟ */

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const card: CSSProperties = { background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginBottom: 14 };
const inp: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const th: CSSProperties = { padding: "9px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", textAlign: "right", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f5f0e6" };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const lbl: CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 };
const fmt = (n: any) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 }));

/* ── ① لوحة القيادة: الإنذارات + تقويم السيولة ── */
function DashboardDoor() {
  const { data: alerts } = useQuery({ queryKey: ["fc-alerts"], queryFn: () => financialCenterApi.alerts() });
  const { data: summary } = useQuery({ queryKey: ["fc-summary"], queryFn: () => apiFetch<any>("/api/finance/summary").catch(() => null) });
  const [safety, setSafety] = useState("");
  const { data: liq } = useQuery({
    queryKey: ["fc-liquidity", safety],
    queryFn: () => financialCenterApi.liquidity(6, safety ? Number(safety) : undefined),
  });
  const alertChip = (label: string, count: any, color: string, href?: string) => {
    const inner = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 800, background: `${color}12`, color, border: `1px solid ${color}30`, cursor: href ? "pointer" : "default" }}>
        {label}: {count}
      </span>
    );
    return href ? <Link key={label} href={href}>{inner}</Link> : <span key={label}>{inner}</span>;
  };
  const maxAbs = Math.max(1, ...(liq?.calendar ?? []).map((m: any) => Math.abs(m.projectedBalance)));
  return (
    <>
      {alerts && (
        <div style={{ ...card, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {alertChip("ملفات موقوفة ماليًا", alerts.heldFiles, alerts.heldFiles > 0 ? "#dc2626" : "#16a34a", "/case-files")}
          {alertChip("بانتظار الاعتماد", alerts.pendingFiles, alerts.pendingFiles > 0 ? "#b45309" : "#16a34a", "/case-files")}
          {alertChip("طلبات تجاوز معلقة", alerts.pendingOverruns, alerts.pendingOverruns > 0 ? "#b45309" : "#16a34a")}
          {alertChip("عقود تنزف", alerts.bleedingContracts, alerts.bleedingContracts > 0 ? "#dc2626" : "#16a34a")}
          {alertChip("التزامات ≤30 يومًا", alerts.obligationsSoon, alerts.obligationsSoon > 0 ? "#d97706" : "#16a34a", "/obligations")}
          {alertChip("فحص الدفتر", alerts.ledgerInSync ? "متزن ✓" : "غير متزن!", alerts.ledgerInSync ? "#16a34a" : "#dc2626")}
        </div>
      )}
      {summary && (
        <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[["الرصيد النقدي", summary.balance, "#16a34a"], ["الرصيد الاستحقاقي", summary.accrualBalance, Number(summary.accrualBalance) < 0 ? "#dc2626" : "#2563eb"], ["إجمالي الدخل", summary.totalIncome, GR]].map(([l, v, c]: any) => (
            <div key={l} style={{ background: "#faf8f2", borderRadius: 10, padding: "10px 16px", minWidth: 140 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af" }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
      )}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: GR }}>تقويم السيولة — تنبؤ ستة أشهر (الداخل من العقود النشطة، والخارج من المستحقات)</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "#6b7280", fontWeight: 700 }}>حد الأمان:</span>
            <input style={{ ...inp, width: 110, padding: "5px 8px" }} type="number" placeholder="0" value={safety} onChange={(e) => setSafety(e.target.value)} />
          </div>
        </div>
        {liq?.firstBreach != null && (
          <div style={{ padding: "9px 14px", borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", fontSize: 12.5, color: "#991b1b", fontWeight: 700, marginBottom: 10 }}>
            ⚠ الرصيد المتوقع يهبط تحت حد الأمان في {liq.calendar[liq.firstBreach].month} — استعجل التحصيل أو أجّل الصرف (القوائم أدناه)
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead style={{ background: "#faf8f2" }}><tr>{["الشهر", "الداخل المتوقع", "الخارج المتوقع", "الرصيد المتوقع", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(liq?.calendar ?? []).map((m: any) => (
                <tr key={m.month} style={{ background: m.belowSafety ? "#fff1f2" : undefined }}>
                  <td style={{ ...td, fontWeight: 700 }}>{m.month}</td>
                  <td style={{ ...td, color: "#16a34a" }}>+{fmt(m.inflow)}</td>
                  <td style={{ ...td, color: "#dc2626" }}>−{fmt(m.outflow)}</td>
                  <td style={{ ...td, fontWeight: 800, color: m.projectedBalance < 0 ? "#dc2626" : GR }}>{fmt(m.projectedBalance)}</td>
                  <td style={{ ...td, width: 180 }}>
                    <div style={{ height: 7, borderRadius: 5, background: "#f0ead8", overflow: "hidden", direction: "ltr" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (Math.abs(m.projectedBalance) / maxAbs) * 100)}%`, background: m.belowSafety || m.projectedBalance < 0 ? "#dc2626" : "#16a34a" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>استعجال التحصيل — أكبر الذمم على العقود</div>
          {(liq?.collectNow ?? []).length === 0 ? <div style={{ color: "#9ca3af", fontSize: 12.5 }}>لا ذمم قائمة</div> :
            (liq?.collectNow ?? []).map((r: any) => (
              <div key={r.contractId} style={{ fontSize: 12.5, color: "#4b5563", padding: "4px 0", borderBottom: "1px dashed #f0ead8" }}>
                <b>{r.contractNumber}</b>{r.entityName && <> — {r.entityName}</>}: متبقٍ <b style={{ color: "#16a34a" }}>{fmt(r.remaining)}</b> د.ك على {r.monthsLeft} شهرًا
              </div>
            ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#d97706", marginBottom: 6 }}>تأخير الصرف — أكبر المستحقات القابلة للتأجيل</div>
          {(liq?.deferCandidates ?? []).length === 0 ? <div style={{ color: "#9ca3af", fontSize: 12.5 }}>لا مستحقات معلقة</div> :
            (liq?.deferCandidates ?? []).map((r: any) => (
              <div key={r.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "4px 0", borderBottom: "1px dashed #f0ead8" }}>
                <b>{r.description}</b>{r.vendor && <> — {r.vendor}</>}: <b style={{ color: "#dc2626" }}>{fmt(r.amount)}</b> د.ك{r.dueDate && <> · يستحق {String(r.dueDate).slice(0, 10)}</>}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

import FinancesList, { BudgetsTab as MonthlyBudgetsTab } from "@/pages/finances-list";
import AdminCostCenters from "@/pages/admin-cost-centers";

/* ── نافذة أوامر الشراء المحلية: الإيراد − (جدول التكلفة والنقل + الصرف) = صافي الربح ── */
function PoLedgerWindow() {
  const { data: ledger } = useQuery<any>({ queryKey: ["fc-po-ledger"], queryFn: () => financialCenterApi.poLedger().catch(() => null) });
  if (!ledger || !(ledger.orders ?? []).length) return null;
  const t = ledger.totals ?? {};
  return (
    <div style={{ ...card, borderRightWidth: 4, borderRightColor: "#0891b2" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: GR, marginBottom: 4 }}>أوامر الشراء المحلية — ربح القناة وصرفها (نفس أرقام الغرفة، بعين المدير المالي)</div>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>
        الإيراد <b style={{ color: "#16a34a" }}>{fmt(t.revenue)}</b> − جدول التكلفة والنقل <b style={{ color: GD }}>{fmt(t.pricingCost)}</b> − الصرف المقيد <b style={{ color: "#d97706" }}>{fmt(t.expenses)}</b>
        = صافي <b style={{ color: (t.profit ?? 0) >= 0 ? "#16a34a" : "#dc2626", fontSize: 14 }}>{fmt(t.profit)}</b> د.ك
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["الأمر", "الجهة", "العطاء", "الإيراد", "تكلفة + نقل", "الصرف", "صافي الربح"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(ledger.orders ?? []).slice(0, 12).map((o: any) => (
              <tr key={o.id}>
                <td style={{ ...td, fontWeight: 700 }}>{o.orderNumber}</td>
                <td style={td}>{o.entityName ?? "—"}</td>
                <td style={{ ...td, fontWeight: 700, color: o.awardResult === "فزنا" ? "#16a34a" : o.awardResult === "خسرنا" ? "#dc2626" : "#d97706" }}>{o.awardResult}</td>
                <td style={td}>{fmt(o.revenue)}</td>
                <td style={td}>{fmt(o.pricingCost)}</td>
                <td style={td}>{fmt(o.expenses)}</td>
                <td style={{ ...td, fontWeight: 800, color: o.profit >= 0 ? "#16a34a" : "#dc2626" }}>{fmt(o.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── ② دفتر العمليات: الشؤون المالية نفسها تسكن هنا (لا روابط قافزة) + نافذة أوامر الشراء ── */
function LedgerDoor() {
  return (
    <>
      <PoLedgerWindow />
      {/* الإدارة المالية كاملة (الرصيد/الإيرادات/المصروفات/المبيعات) — الميزانيات في الباب ④ ودفتر الأحداث في الباب ③ */}
      <div style={{ ...card }}>
        <FinancesList embedded />
      </div>
      <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/pricing?tab=book"><button style={{ ...btn, background: "white", color: GD, border: `1.5px solid ${G}55` }}>الدفتر المرجعي (في غرفة التسعير) ←</button></Link>
      </div>
    </>
  );
}

/* ── ③ مراكز التكلفة والربح: الامتصاص وتكلفة الجاهزية ── */
function CentersDoor() {
  const { data: r } = useQuery({ queryKey: ["fc-readiness"], queryFn: () => financialCenterApi.readiness() });
  return (
    <>
      <div style={{ ...card, borderRightWidth: 4, borderRightColor: "#7c3aed" }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: GR, marginBottom: 4 }}>تكلفة الجاهزية {r?.year} — القسم بلا عقود تغطيه لا يختبئ، يظهر باسمه</div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>إجمالي ما تتحمله الشركة جاهزيةً: <b style={{ color: "#7c3aed", fontSize: 15 }}>{fmt(r?.totalReadiness)}</b> د.ك — الخيارات: عقود تمتصه، أو تقليص، أو قبول واعٍ.</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead style={{ background: "#faf8f2" }}><tr>{["المركز", "تكاليفه الكلية", "المغطى بالعقود", "تكلفة الجاهزية", "نسبة الامتصاص"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(r?.centers ?? []).map((c: any) => (
                <tr key={c.id}>
                  <td style={{ ...td, fontWeight: 700 }}>{c.name}</td>
                  <td style={td}>{fmt(c.totalCosts)}</td>
                  <td style={{ ...td, color: "#16a34a" }}>{fmt(c.coveredByContracts)}</td>
                  <td style={{ ...td, fontWeight: 800, color: c.readinessCost > 0 ? "#7c3aed" : "#16a34a" }}>{fmt(c.readinessCost)}</td>
                  <td style={td}>{c.absorptionPct == null ? "—" : (
                    <span style={{ fontWeight: 800, color: c.absorptionPct >= 70 ? "#16a34a" : c.absorptionPct >= 30 ? "#d97706" : "#dc2626" }}>{c.absorptionPct}%</span>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* غرفة الهيكل والتدقيق كاملة: المراكز + قواعد التوزيع + الربحية الثلاثية + الأحداث والعكوس والتطابق */}
      <div style={card}>
        <AdminCostCenters embedded />
      </div>
    </>
  );
}

/* ── ④ الميزانيات ذات الأسنان ── */
function BudgetsDoor({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: budgets = [] } = useQuery<any[]>({ queryKey: ["fc-budgets"], queryFn: () => financialCenterApi.categoryBudgets() });
  const { data: centers = [] } = useQuery<any[]>({ queryKey: ["fc-centers"], queryFn: () => apiFetch<any[]>("/api/cost-centers").catch(() => []) });
  const [f, setF] = useState({ costCenterId: "", category: "general", amount: "" });
  const saveM = useMutation({
    mutationFn: () => financialCenterApi.saveCategoryBudget({ costCenterId: Number(f.costCenterId), category: f.category, amount: Number(f.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fc-budgets"] }); setF({ costCenterId: "", category: "general", amount: "" }); toast({ title: "✅ حُفظ بند الميزانية" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delM = useMutation({ mutationFn: (id: number) => financialCenterApi.deleteCategoryBudget(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["fc-budgets"] }) });
  const CATS = ["general", "operational", "salary", "rent", "office_rent", "warehouse_rent", "fridge_rent", "utilities", "maintenance", "fuel", "vehicle_service", "residency", "customs", "installation", "labor", "other"];
  const CAT_AR: Record<string, string> = { general: "عام", operational: "مصاريف تشغيلية", office_rent: "إيجار المكتب", warehouse_rent: "إيجار المخزن", fridge_rent: "إيجار الثلاجة", salary: "رواتب", rent: "إيجار", utilities: "مرافق", maintenance: "صيانة", fuel: "بنزين", vehicle_service: "سيرفس مركبة", residency: "إقامة", customs: "جمارك", installation: "تركيب", labor: "عمالة", other: "أخرى" };
  return (
    <>
      {/* الطبقة ١: السقف الشهري لكل مركز (انتقلت من الشؤون المالية — النظامان صارا شاشة واحدة) */}
      <div style={{ ...card, borderRightWidth: 4, borderRightColor: "#6366f1" }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: GR, marginBottom: 8 }}>الطبقة ١ — الميزانية الشهرية المستهدفة لكل مركز</div>
        <MonthlyBudgetsTab />
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 800, color: GR, margin: "4px 0 8px" }}>الطبقة ٢ — سقوف الفئات ذات الأسنان (تجاوزها يوقف الصرف حتى موافقة المالي)</div>
      {canEdit && (
        <div style={{ ...card, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 170 }}><label style={lbl}>المركز</label>
            <select style={inp} value={f.costCenterId} onChange={(e) => setF({ ...f, costCenterId: e.target.value })}>
              <option value="">— اختر —</option>{centers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label style={lbl}>الفئة</label>
            <select style={{ ...inp, width: 160 }} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{CAT_AR[c] ?? c}</option>)}</select></div>
          <div><label style={lbl}>المخصص السنوي (د.ك)</label><input style={{ ...inp, width: 130 }} type="number" step="0.001" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <button style={btn} disabled={saveM.isPending || !f.costCenterId || !f.amount} onClick={() => saveM.mutate()}><Plus size={13} /> حفظ</button>
        </div>
      )}
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead style={{ background: "#faf8f2" }}><tr>{["المركز", "الفئة", "المخصص", "المصروف", "المتبقي", "الاستهلاك", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {budgets.length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={7}>لا ميزانيات فئات بعد — أضف أول بند أعلاه</td></tr> :
              budgets.map((b) => (
                <tr key={b.id} style={{ background: b.alert === "تجاوز" ? "#fff1f2" : b.alert === "إنذار" ? "#fffbeb" : undefined }}>
                  <td style={{ ...td, fontWeight: 700 }}>{b.centerName}</td>
                  <td style={td}>{CAT_AR[b.category] ?? b.category}</td>
                  <td style={td}>{fmt(b.allocated)}</td>
                  <td style={td}>{fmt(b.spent)}</td>
                  <td style={{ ...td, fontWeight: 800, color: b.remaining < 0 ? "#dc2626" : "#16a34a" }}>{fmt(b.remaining)}</td>
                  <td style={td}>{b.pct == null ? "—" : (
                    <span style={{ fontWeight: 800, color: b.pct >= 100 ? "#dc2626" : b.pct >= 80 ? "#d97706" : "#16a34a" }}>
                      {b.pct}% {b.alert && `(${b.alert})`}</span>
                  )}</td>
                  <td style={td}>{canEdit && <button style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, padding: 4, cursor: "pointer", display: "inline-flex" }} onClick={() => delM.mutate(b.id)}><Trash2 size={12} color="#dc2626" /></button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/obligations"><button style={{ ...btn, background: "white", color: GD, border: `1.5px solid ${G}55` }}>التجديدات والمسيّر ←</button></Link>
        <Link href="/bank-guarantees"><button style={{ ...btn, background: "white", color: GD, border: `1.5px solid ${G}55` }}>الضمانات البنكية ←</button></Link>
      </div>
    </>
  );
}

/* ── ⑤ طاولة المدير المالي ── */
function CfoDeskDoor({ canDecideHere }: { canDecideHere: boolean }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: desk } = useQuery({ queryKey: ["fc-desk"], queryFn: () => financialCenterApi.cfoDesk() });
  const inv = () => { qc.invalidateQueries({ queryKey: ["fc-desk"] }); qc.invalidateQueries({ queryKey: ["fc-alerts"] }); };
  const overrunM = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      approve ? financialCenterApi.approveOverrun(id) : financialCenterApi.rejectOverrun(id),
    onSuccess: () => { inv(); toast({ title: "حُسم الطلب" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const sec = (title: string, color: string, rows: any[], render: (r: any) => React.ReactNode, empty: string) => (
    <div style={card}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color, marginBottom: 6 }}>{title} ({rows.length})</div>
      {rows.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 12.5 }}>{empty}</div> : rows.map(render)}
    </div>
  );
  return (
    <>
      {sec("ملفات بانتظار الاعتماد", "#b45309", desk?.pendingFiles ?? [], (r: any) => (
        <div key={r.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "4px 0", borderBottom: "1px dashed #f0ead8" }}>
          <Link href={r.entityType === "tender" ? `/tenders/${r.entityId}` : `/practices/${r.entityId}`}>
            <b style={{ color: GD, cursor: "pointer" }}>{r.entityType === "tender" ? "مناقصة" : "ممارسة"} #{r.entityId}</b>
          </Link> — رفعه {r.raisedByName}
        </div>
      ), "لا شيء بانتظار الاعتماد")}
      {sec("ملفات موقوفة ماليًا", "#dc2626", desk?.heldFiles ?? [], (r: any) => (
        <div key={r.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "4px 0", borderBottom: "1px dashed #f0ead8" }}>
          <b>{r.entityType === "tender" ? "مناقصة" : "ممارسة"} #{r.entityId}</b> — أوقفها {r.heldByName}: {r.holdReason}
        </div>
      ), "لا وقفات قائمة")}
      {sec("طلبات تجاوز الميزانية", "#b45309", desk?.overruns ?? [], (r: any) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "#4b5563", padding: "5px 0", borderBottom: "1px dashed #f0ead8" }}>
          <span><b>{r.centerName}</b> / {r.category}: <b style={{ color: "#dc2626" }}>{fmt(r.amount)}</b> د.ك — {r.reason} <span style={{ color: "#9ca3af" }}>({r.requestedByName})</span></span>
          {canDecideHere && (
            <span style={{ display: "flex", gap: 5 }}>
              <button style={{ ...btn, padding: "4px 10px", fontSize: 11.5, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }} onClick={() => overrunM.mutate({ id: r.id, approve: true })}><CheckCircle2 size={12} /> موافقة</button>
              <button style={{ ...btn, padding: "4px 10px", fontSize: 11.5, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca" }} onClick={() => overrunM.mutate({ id: r.id, approve: false })}><XCircle size={12} /> رفض</button>
            </span>
          )}
        </div>
      ), "لا طلبات معلقة")}
      {sec("انحرافات تستدعي النظر (ارتفاع ≥5%)", "#dc2626", desk?.attentionVariances ?? [], (r: any) => (
        <div key={r.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "4px 0", borderBottom: "1px dashed #f0ead8" }}>
          <AlertTriangle size={12} style={{ display: "inline", color: "#dc2626" }} /> <b>{r.itemName}</b> (عقد {r.contractNumber}{r.supplierName ? ` — ${r.supplierName}` : ""}): {fmt(r.estimatedCost)} ← {fmt(r.actualCost)} <b style={{ color: "#dc2626" }}>+{r.risePct}%</b> · {r.reason}
        </div>
      ), "لا انحرافات حرجة")}
      {sec("سجل تجاوزات المدير العام", "#7c3aed", desk?.overrideLog ?? [], (r: any) => (
        <div key={r.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "4px 0", borderBottom: "1px dashed #f0ead8" }}>
          <ShieldAlert size={12} style={{ display: "inline", color: "#7c3aed" }} /> <b>{r.event}</b> — {r.entityType === "tender" ? "مناقصة" : "ممارسة"} #{r.entityId} · {r.actorName}
        </div>
      ), "لا تجاوزات مسجلة")}
    </>
  );
}

export default function FinancialCenterPage() {
  const { user } = useAuth();
  const positions = user?.positions ?? [];
  const isAdmin = user?.role === "admin";
  const canSee = isAdmin || ["financial_manager", "general_manager", "executive_manager"].some((k) => positions.includes(k));
  const canDecideHere = isAdmin || ["financial_manager", "general_manager"].some((k) => positions.includes(k));
  const [door, setDoor] = useState<"dash" | "ledger" | "centers" | "budgets" | "desk">(() => {
    const d = new URLSearchParams(window.location.search).get("door");
    return (["dash", "ledger", "centers", "budgets", "desk"].includes(d ?? "") ? d : "dash") as any;
  });
  if (!canSee) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>المركز المالي للمديرين.</div>;
  const DOORS = [
    { key: "dash", label: "① لوحة القيادة", icon: Gauge },
    { key: "ledger", label: "② دفتر العمليات", icon: BookOpen },
    { key: "centers", label: "③ المراكز والربح", icon: PieChart },
    { key: "budgets", label: "④ الميزانيات", icon: Wallet },
    { key: "desk", label: "⑤ طاولة المالي", icon: ScaleIcon },
  ] as const;
  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Segoe UI',Tahoma,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
        <Landmark size={22} color={GD} />
        <h1 style={{ fontSize: 21, fontWeight: 800, color: GR, margin: 0 }}>المركز المالي</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px 14px" }}>بيت واحد بخمسة أبواب: كيف حالنا؟ · ما الذي يتحرك؟ · أين تذهب وماذا تربح؟ · ماذا خطّطنا؟ · ماذا ننتظر؟</p>
      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 12, border: "1.5px solid #f0ead8", padding: 5, marginBottom: 14, flexWrap: "wrap", width: "fit-content" }}>
        {DOORS.map((d) => (
          <button key={d.key} onClick={() => setDoor(d.key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: door === d.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: door === d.key ? "white" : "#374151" }}>
            <d.icon size={14} /> {d.label}
          </button>
        ))}
      </div>
      {door === "dash" && <DashboardDoor />}
      {door === "ledger" && <LedgerDoor />}
      {door === "centers" && <CentersDoor />}
      {door === "budgets" && <BudgetsDoor canEdit={canDecideHere} />}
      {door === "desk" && <CfoDeskDoor canDecideHere={canDecideHere} />}
    </div>
  );
}
