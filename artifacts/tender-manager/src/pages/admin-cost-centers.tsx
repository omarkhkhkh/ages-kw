import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { costCentersApi, type CostCenter, type AllocationRule } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Trash2, Check, X, Pencil, TrendingUp, TrendingDown, Wallet, Layers, ShieldCheck, ShieldAlert, Undo2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const MONTHS_AR = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

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
const cardS: React.CSSProperties = { background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16 };

export default function AdminCostCenters({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  // باب «المراكز والربح» في البيت المالي — للقبعات الثلاث والأدمن
  const canSee = user?.role === "admin" || ["general_manager", "executive_manager", "financial_manager"].some((k) => (((user as any)?.positions) ?? []).includes(k));

  const [form, setForm] = useState({ name: "", type: "profit", evaluationMetric: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "profit", evaluationMetric: "" });

  const { data: centers = [], isLoading } = useQuery({ queryKey: ["cost-centers"], queryFn: () => costCentersApi.list(), enabled: canSee });

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

  // ── المرحلة ٤: قواعد التوزيع + الربحية بثلاث طبقات ──
  const year = new Date().getFullYear();
  const { data: rules = [] } = useQuery<AllocationRule[]>({ queryKey: ["allocation-rules"], queryFn: () => costCentersApi.allocationRules.list(), enabled: canSee });
  const { data: prof } = useQuery({ queryKey: ["profitability", year], queryFn: () => costCentersApi.profitability(year), enabled: canSee });
  const { data: dash } = useQuery({ queryKey: ["cc-dashboard", year], queryFn: () => costCentersApi.companyDashboard(year), enabled: canSee });
  // ── المرحلة ٦/٩/١٠: دفتر الأحداث المالية + التصحيح بالعكس + فحص التطابق ──
  const { data: events = [] } = useQuery({ queryKey: ["financial-events", year], queryFn: () => costCentersApi.financialEvents(year), enabled: canSee });
  const { data: integrity } = useQuery({ queryKey: ["ledger-integrity"], queryFn: () => costCentersApi.ledgerIntegrity(), enabled: canSee });
  const reverseM = useMutation({
    mutationFn: (id: number) => costCentersApi.reverseEvent(id),
    onSuccess: () => { ["financial-events", "ledger-integrity", "cc-dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast({ title: "↩︎ تم إنشاء حدث عكسي للتصحيح" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const [ruleForm, setRuleForm] = useState({ costCenterId: "", costType: "", shareRatio: "" });
  const invProf = () => { qc.invalidateQueries({ queryKey: ["allocation-rules"] }); qc.invalidateQueries({ queryKey: ["profitability"] }); };
  const addRuleM = useMutation({
    mutationFn: () => costCentersApi.allocationRules.create({ costCenterId: Number(ruleForm.costCenterId), costType: ruleForm.costType.trim() || null, shareRatio: Number(ruleForm.shareRatio) || 0 }),
    onSuccess: () => { invProf(); setRuleForm({ costCenterId: "", costType: "", shareRatio: "" }); toast({ title: "✅ أُضيفت قاعدة التوزيع" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const delRuleM = useMutation({ mutationFn: (id: number) => costCentersApi.allocationRules.delete(id), onSuccess: invProf });
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  const profitCenters = centers.filter((c) => c.type === "profit");

  if (!canSee) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>هذه الصفحة للمدراء الثلاثة.</div>;

  const startEdit = (c: CostCenter) => { setEditId(c.id); setEditForm({ name: c.name, type: c.type, evaluationMetric: c.evaluationMetric ?? "" }); };

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl", maxWidth: 900, margin: "0 auto", padding: "8px 4px" }}>
      {!embedded && (
      <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
        <Building2 size={22} color={GD} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#132a18", margin: 0 }}>مراكز التكلفة والربح (أقسام الشركة)</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px 14px" }}>
        النواة الموحّدة للنظام المالي. كل حركة (دخل/مصروف) تُنسب لقسم، ويُقاس كل قسم بحسب نوعه.
      </p>
      </>
      )}

      {/* ── لوحة الشركة الموحّدة (المرحلة ٥) ── */}
      {dash && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Layers size={17} color={GD} />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#132a18", margin: 0 }}>لوحة الشركة المالية الموحّدة — {dash.year}</h2>
          </div>

          {/* بطاقات المؤشرات */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { label: "الدخل الكلي", value: dash.totals.income, color: "#16a34a", icon: <TrendingUp size={16} color="#16a34a" /> },
              { label: "المصروف الكلي", value: dash.totals.expense, color: "#dc2626", icon: <TrendingDown size={16} color="#dc2626" /> },
              { label: "صافي الربح", value: dash.totals.net, color: dash.totals.net < 0 ? "#dc2626" : "#0f766e", icon: <Wallet size={16} color={dash.totals.net < 0 ? "#dc2626" : "#0f766e"} /> },
              { label: "الاستثمار الرأسمالي", value: dash.totals.capex, color: "#d97706", icon: <Building2 size={16} color="#d97706" /> },
            ].map((k) => (
              <div key={k.label} style={{ ...cardS, padding: 14, borderTop: `3px solid ${k.color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>{k.icon}{k.label}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: k.color, fontFamily: "monospace", direction: "ltr", textAlign: "right" }}>{fmt(k.value)}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>د.ك</div>
              </div>
            ))}
          </div>

          {/* شلال الربح + التنبؤ */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 16, marginBottom: 16 }}>
            {/* شلال الربح */}
            <div style={cardS}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#132a18", marginBottom: 2 }}>شلال الربح</div>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 14px" }}>من الدخل الكلي، تُطرح مصروفات كل نوع قسم للوصول إلى صافي الربح.</p>
              {(() => {
                const H = 150;
                const maxV = Math.max(dash.totals.income, 1);
                let running = 0;
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: H + 44, direction: "ltr" }}>
                    {dash.waterfall.map((w, i) => {
                      let bottomVal: number, topVal: number, color: string;
                      if (w.kind === "start") { bottomVal = 0; topVal = w.value; running = w.value; color = "#16a34a"; }
                      else if (w.kind === "total") { bottomVal = 0; topVal = w.value; running = w.value; color = w.value < 0 ? "#dc2626" : "#0f766e"; }
                      else { const before = running; running += w.value; topVal = Math.max(before, running); bottomVal = Math.min(before, running); color = "#f59e0b"; }
                      const heightPx = Math.max((Math.abs(topVal - bottomVal) / maxV) * H, 2);
                      const bottomPx = (bottomVal / maxV) * H;
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: H + 44 }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color, fontFamily: "monospace", marginBottom: 2, whiteSpace: "nowrap" }}>{w.kind === "down" ? "−" : ""}{fmt(Math.abs(w.value))}</div>
                          <div style={{ position: "relative", width: "100%", height: H }}>
                            <div style={{ position: "absolute", bottom: bottomPx, left: "12%", right: "12%", height: heightPx, background: color, borderRadius: 4, opacity: w.kind === "down" ? 0.85 : 1 }} />
                          </div>
                          <div style={{ fontSize: 9.5, color: "#6b7280", fontWeight: 700, marginTop: 5, textAlign: "center", lineHeight: 1.2, height: 26, overflow: "hidden" }}>{w.label}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* التنبؤ بنهاية السنة */}
            <div style={cardS}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#132a18", marginBottom: 2 }}>تنبؤ نهاية السنة</div>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 12px" }}>
                {dash.forecast.isComplete
                  ? "السنة مكتملة — الأرقام فعلية لا متوقّعة."
                  : `بمعدّل الجريان: ما تحقق خلال ${dash.forecast.monthsElapsed} شهرًا ÷ عليها × 12.`}
              </p>
              {[
                { label: "الدخل المتوقّع", value: dash.forecast.projectedIncome, color: "#16a34a" },
                { label: "المصروف المتوقّع", value: dash.forecast.projectedExpense, color: "#dc2626" },
                { label: "صافي الربح المتوقّع", value: dash.forecast.projectedNet, color: dash.forecast.projectedNet < 0 ? "#dc2626" : "#0f766e" },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f5f0e6" }}>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{f.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: f.color, fontFamily: "monospace" }}>{fmt(f.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* الاتجاه الشهري */}
          <div style={cardS}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#132a18", marginBottom: 12 }}>الدخل مقابل المصروف شهريًا</div>
            <div style={{ width: "100%", height: 230, direction: "ltr" }}>
              <ResponsiveContainer>
                <BarChart data={dash.monthly.map((m) => ({ name: MONTHS_AR[m.month - 1], income: m.income, expense: m.expense }))} margin={{ top: 6, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ead8" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "inherit" }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "inherit" }} width={54} />
                  <Tooltip formatter={(v: any, n: any) => [fmt(Number(v)) + " د.ك", n === "income" ? "الدخل" : "المصروف"]} labelStyle={{ fontFamily: "inherit" }} contentStyle={{ fontFamily: "inherit", fontSize: 12, direction: "rtl" }} />
                  <Bar dataKey="income" name="income" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="expense" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

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

      {/* ── قواعد توزيع التكاليف المشتركة ── */}
      <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#132a18", marginBottom: 4 }}>قواعد توزيع التكاليف المشتركة</div>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
          كل قاعدة تُعطي مركز ربح نسبة من مجمّع تكاليف الأقسام «القابلة للتحميل» (إيجار/إدارة/كهرباء). يُفضّل أن يكون مجموع النِّسب = 1.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>مركز الربح</label>
            <select style={inp} value={ruleForm.costCenterId} onChange={e => setRuleForm(p => ({ ...p, costCenterId: e.target.value }))}>
              <option value="">— اختر —</option>
              {profitCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>نوع التكلفة (اختياري)</label>
            <input style={inp} value={ruleForm.costType} onChange={e => setRuleForm(p => ({ ...p, costType: e.target.value }))} placeholder="إيجار/إدارة…" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>النسبة (0–1)</label>
            <input style={inp} type="number" step="0.05" min="0" max="1" value={ruleForm.shareRatio} onChange={e => setRuleForm(p => ({ ...p, shareRatio: e.target.value }))} placeholder="0.5" />
          </div>
          <button type="button" disabled={!ruleForm.costCenterId || addRuleM.isPending} onClick={() => addRuleM.mutate()}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${G}, ${GD})`, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", height: 38 }}>
            <Plus size={14} /> إضافة
          </button>
        </div>
        {rules.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9ca3af" }}>لا توجد قواعد توزيع بعد.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {rules.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#faf8f2", border: "1px solid #f0ead8", borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>
                  <b>{r.costCenterName}</b> — {r.costType || "عام"} · نسبة <b>{Number(r.shareRatio)}</b>
                </span>
                <button onClick={() => delRuleM.mutate(r.id)} style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, padding: 4, cursor: "pointer", display: "flex" }}><Trash2 size={13} color="#dc2626" /></button>
              </div>
            ))}
          </div>
        )}
        {prof && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: Math.abs(prof.totalShareRatio - 1) > 0.001 && prof.totalShareRatio > 0 ? "#d97706" : "#6b7280" }}>
            مجموع النِّسب: {prof.totalShareRatio}{Math.abs(prof.totalShareRatio - 1) > 0.001 && prof.totalShareRatio > 0 ? " ⚠️ يُفضّل أن يساوي 1" : ""}
          </div>
        )}
      </div>

      {/* ── الربحية الحقيقية بثلاث طبقات ── */}
      {prof && (
        <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginTop: 24, overflowX: "auto" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#132a18", marginBottom: 4 }}>الربحية الحقيقية بثلاث طبقات — {year}</div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
            المجمّع المشترك القابل للتحميل: <b>{fmt(prof.allocatablePool)} د.ك</b> — يُوزَّع على مراكز الربح حسب النِّسب أعلاه.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right", minWidth: 640 }}>
            <thead style={{ background: "#faf8f2" }}>
              <tr>{["القسم", "الدخل المباشر", "المصروف المباشر", "① الهامش المباشر", "نصيبه من المشترك", "② بعد التحميل"].map(h => (
                <th key={h} style={{ padding: "9px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", whiteSpace: "nowrap" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {prof.centers.map(c => (
                <tr key={c.costCenterId} style={{ borderBottom: "1px solid #f5f0e6" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 700, color: "#132a18" }}>{c.name}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#16a34a" }}>{fmt(c.directIncome)}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#dc2626" }}>{fmt(c.directExpense)}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: c.directMargin < 0 ? "#dc2626" : "#0f766e" }}>{fmt(c.directMargin)}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#d97706" }}>{fmt(c.allocatedShare)}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 800, color: c.afterAllocation < 0 ? "#dc2626" : "#166534" }}>{fmt(c.afterAllocation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "10px 0 0" }}>
            ① الهامش المباشر = الدخل − المصروف المباشر · ② بعد التحميل = الهامش المباشر − نصيب القسم من التكاليف المشتركة. قسم رابح مباشرةً قد يصير خاسرًا بعد التحميل العادل.
          </p>
        </div>
      )}

      {/* ── دفتر الأحداث المالية (المرحلة ٦/٩/١٠) ── */}
      <div style={{ ...cardS, marginTop: 24, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#132a18" }}>دفتر الأحداث المالية — {year}</div>
          {integrity && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: integrity.inSync ? "#dcfce7" : "#fee2e2", color: integrity.inSync ? "#166534" : "#991b1b" }}>
              {integrity.inSync ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
              {integrity.inSync ? "الدفتر متطابق مع القيود" : "عدم تطابق — يلزم مراجعة"}
              {` · ${integrity.eventsCount} حدث${integrity.reversalsCount ? ` · ${integrity.reversalsCount} عكسي` : ""}`}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
          سجلّ ثابت (append-only) لكل حركة مالية كحدث. التصحيح يتم بحدث <b>عكسي</b> لا بالحذف — فيبقى الأثر كاملًا للتدقيق.
        </p>
        {events.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9ca3af", padding: "16px 0" }}>لا توجد أحداث لهذه السنة.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right", minWidth: 680 }}>
            <thead style={{ background: "#faf8f2" }}>
              <tr>{["النوع", "الوصف", "القسم", "المبلغ", "التاريخ", ""].map((h) => (
                <th key={h} style={{ padding: "9px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", whiteSpace: "nowrap" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const meta = e.eventType === "income" ? { label: "دخل", bg: "#dcfce7", text: "#166534" }
                  : e.eventType === "expense" ? { label: "مصروف", bg: "#fee2e2", text: "#991b1b" }
                  : { label: "عكس/تصحيح", bg: "#fef3c7", text: "#92400e" };
                const amt = Number(e.amount);
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid #f5f0e6", opacity: e.isReversed ? 0.55 : 1 }}>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.text, whiteSpace: "nowrap" }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#374151", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.description || "—"}{e.isReversed && <span style={{ color: "#9ca3af", fontSize: 11 }}> (مُصحَّح)</span>}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{e.costCenterName || "—"}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: amt < 0 ? "#d97706" : meta.text }}>{fmt(amt)}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280", fontFamily: "monospace", direction: "ltr", textAlign: "right", whiteSpace: "nowrap" }}>{e.transactionDate || "—"}</td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {e.eventType !== "reversal" && !e.isReversed && (
                        <button onClick={() => { if (confirm(`إنشاء حدث عكسي لتصحيح "${e.description || "هذا الحدث"}"؟\n(لن يُحذف الأصل — يُضاف قيد معاكس بقيمة ${fmt(-amt)}).`)) reverseM.mutate(e.id); }}
                          disabled={reverseM.isPending}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#92400e", fontFamily: "inherit" }}>
                          <Undo2 size={12} /> عكس
                        </button>
                      )}
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
