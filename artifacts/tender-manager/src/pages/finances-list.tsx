import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import * as XLSX from "xlsx";
import {
  Wallet, TrendingUp, TrendingDown, Scale, Clock, Plus, Pencil, Trash2,
  Save, X, Download, Upload, CheckCircle2, AlertCircle, DollarSign,
  Users, FileText, Loader2, ChevronDown, ChevronUp, Eye, EyeOff,
  BarChart3, Receipt, UserCheck,
} from "lucide-react";

/* ── Brand ─────────────────────────────────────── */
const G   = "#D4A534";
const GD  = "#A87C20";
const GR  = "#0b1a10";

/* ── Shared style helpers ───────────────────────── */
const card  = (extra?: any): any => ({ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", ...extra });
const inp   = { width: "100%", boxSizing: "border-box" as const, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.15s", direction: "rtl" as const };
const lbl   = { display: "block" as const, marginBottom: 5, fontSize: 12, fontWeight: 700 as const, color: "#374151" };
const focus = (e: any) => (e.target.style.borderColor = G);
const blur  = (e: any) => (e.target.style.borderColor = "#e5e7eb");

/* ── KWD formatter ──────────────────────────────── */
const kwd = (v: string | number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("en-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`;

/* ── Date helper ─────────────────────────────────── */
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("ar-KW", { year: "numeric", month: "short", day: "numeric" }) : "—";

/* ── Status config ───────────────────────────────── */
const EXPENSE_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "قيد الانتظار", color: "#d97706", bg: "#fef3c7", icon: Clock         },
  paid:    { label: "مدفوعة",       color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2  },
  overdue: { label: "متأخرة",       color: "#dc2626", bg: "#fff1f2", icon: AlertCircle   },
};

const INCOME_CATS = ["contract", "other", "bonus", "penalty"];
const INCOME_CAT_AR: Record<string, string> = { contract: "عقد", other: "أخرى", bonus: "مكافأة", penalty: "غرامة" };
const EXPENSE_CATS = ["general", "salary", "rent", "utilities", "maintenance", "tax", "other"];
const EXPENSE_CAT_AR: Record<string, string> = { general: "عام", salary: "رواتب", rent: "إيجار", utilities: "مرافق", maintenance: "صيانة", tax: "ضرائب", other: "أخرى" };

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
interface IncomeRow {
  id: number; contractId: number | null; employeeId: number | null;
  description: string; amount: string; date: string; category: string; notes: string | null;
  createdAt: string; employeeName: string | null; contractNumber: string | null;
}
interface ExpenseRow {
  id: number; description: string; amount: string; dueDate: string | null;
  paidDate: string | null; status: string; category: string; vendor: string | null;
  notes: string | null; createdAt: string;
}
interface SaleRow {
  id: number; employeeId: number; contractId: number | null;
  description: string; profitPercentage: string | null;
  totalContractAmount?: string | null; profitAmount?: string | null;
  saleDate: string; notes: string | null; createdAt: string;
  employeeName: string | null; contractNumber: string | null;
}
interface Summary {
  totalIncome: string; totalPaid: string; totalPending: string; totalOverdue: string; balance: string;
}
interface UserDir { id: number; fullName: string; username: string; }
interface ContractDir { id: number; contractNumber: string; }

/* ═══════════════════════════════════════════════════
   TAB 1 — SUMMARY (الرصيد)
═══════════════════════════════════════════════════ */
function SummaryTab() {
  const { data: summary, isLoading } = useQuery<Summary>({
    queryKey: ["finance-summary"],
    queryFn: () => apiFetch("/api/finance/summary"),
  });

  const metrics = summary ? [
    { label: "إجمالي الإيرادات",     value: summary.totalIncome,  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: TrendingUp    },
    { label: "إجمالي المدفوع",       value: summary.totalPaid,    color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: CheckCircle2  },
    { label: "المستحق للدفع",        value: summary.totalPending, color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: Clock         },
    { label: "الفواتير المتأخرة",    value: summary.totalOverdue, color: "#dc2626", bg: "#fff1f2", border: "#fecaca", icon: AlertCircle   },
    { label: "الرصيد الحالي",        value: summary.balance,      color: G,         bg: "#fdf8ec", border: "#f0ead8", icon: Scale         },
  ] : [];

  if (isLoading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60, color: "#94a3b8" }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {metrics.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} style={{ ...card(), padding: "20px 22px", border: `1.5px solid ${m.border}`, background: m.bg }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{m.label}</span>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={m.color} />
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: m.color, direction: "ltr", textAlign: "right" }}>{kwd(m.value)}</div>
            </div>
          );
        })}
      </div>

      {/* Balance indicator */}
      {summary && (
        <div style={{ ...card(), padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <BarChart3 size={18} color={G} />
            <span style={{ fontSize: 15, fontWeight: 800, color: GR }}>نسبة الاستخدام</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "المدفوع من الإيرادات", val: Number(summary.totalPaid), color: "#2563eb" },
              { label: "الانتظار من الإيرادات", val: Number(summary.totalPending), color: "#d97706" },
              { label: "المتأخر",               val: Number(summary.totalOverdue), color: "#dc2626" },
            ].map(b => {
              const pct = Number(summary.totalIncome) > 0
                ? Math.min(100, (b.val / Number(summary.totalIncome)) * 100)
                : 0;
              return (
                <div key={b.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{b.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "#f3f4f6", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: b.color, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 2 — INCOME (الإيرادات)
═══════════════════════════════════════════════════ */
const incomeEmpty = { contractId: "", employeeId: "", description: "", amount: "", date: "", category: "contract", notes: "" };

function IncomeTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ ...incomeEmpty });
  const fileRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const { data: income = [], isLoading } = useQuery<IncomeRow[]>({
    queryKey: ["finance-income"],
    queryFn: () => apiFetch("/api/finance/income"),
    enabled: isAdmin,
  });
  const { data: users = [] } = useQuery<UserDir[]>({
    queryKey: ["users-directory"],
    queryFn: () => apiFetch("/api/users/directory"),
    enabled: isAdmin,
  });

  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/finance/income", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-income"] }); qc.invalidateQueries({ queryKey: ["finance-summary"] }); closeForm(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/finance/income/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-income"] }); qc.invalidateQueries({ queryKey: ["finance-summary"] }); closeForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/finance/income/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-income"] }); qc.invalidateQueries({ queryKey: ["finance-summary"] }); },
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm({ ...incomeEmpty }); };

  const handleSave = () => {
    const payload = { ...form, amount: Number(form.amount), contractId: form.contractId || null, employeeId: form.employeeId || null };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportResult(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await apiFetch<any>("/api/finance/import/income", { method: "POST", body: fd });
      setImportResult(`✅ تم استيراد ${r.inserted} سجل بنجاح`);
      qc.invalidateQueries({ queryKey: ["finance-income"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
    } catch { setImportResult("❌ فشل في استيراد الملف"); }
    setImportLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["الوصف","المبلغ","التاريخ","الفئة","الملاحظات"],["دفعة عقد 2025","5000","2025-01-15","contract",""]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "نموذج");
    XLSX.writeFile(wb, "نموذج_الإيرادات.xlsx");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, ...card(), padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <TrendingUp size={18} color="#16a34a" />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>إجمالي الإيرادات</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#16a34a", direction: "ltr" }}>{kwd(totalIncome)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
            <Download size={13} />نموذج Excel
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", cursor: "pointer", fontFamily: "inherit" }}>
            {importLoading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
            استيراد Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          </label>
          <a href="/api/finance/export/income" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>
            <Download size={13} />تصدير
          </a>
          <button onClick={() => { setShowForm(true); setEditing(null); setForm({ ...incomeEmpty }); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={14} />إضافة إيراد
          </button>
        </div>
      </div>
      {importResult && <div style={{ padding: "10px 14px", borderRadius: 10, background: importResult.startsWith("✅") ? "#f0fdf4" : "#fff1f2", border: `1px solid ${importResult.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`, fontSize: 13, fontWeight: 600, color: importResult.startsWith("✅") ? "#16a34a" : "#dc2626" }}>{importResult}</div>}

      {/* Form */}
      {(showForm || editing) && (
        <div style={{ ...card(), padding: "20px 22px", border: `1.5px solid ${G}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>{editing ? "تعديل الإيراد" : "إضافة إيراد جديد"}</span>
            <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>الوصف *</label>
              <input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="وصف الإيراد" style={inp} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>المبلغ (د.ك) *</label>
              <input type="number" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} placeholder="0.000" style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>التاريخ *</label>
              <input type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>الفئة</label>
              <select value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))} style={inp}>
                {INCOME_CATS.map(c => <option key={c} value={c}>{INCOME_CAT_AR[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>الموظف المسؤول</label>
              <select value={form.employeeId} onChange={e => setForm((f: any) => ({ ...f, employeeId: e.target.value }))} style={inp}>
                <option value="">— لا يوجد —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>الملاحظات</label>
              <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية..." style={{ ...inp, height: 60, resize: "vertical" } as any} onFocus={focus} onBlur={blur} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={closeForm} style={{ padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
            <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
              <Save size={14} />حفظ
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={card()}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : income.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 50, gap: 10 }}>
            <TrendingUp size={36} color="#e2d5b0" />
            <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد إيرادات مسجلة</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0ead8", background: "#fdf8ec" }}>
                  {["التاريخ","الوصف","المبلغ","الفئة","الموظف","الملاحظات",""].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#374151", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {income.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f5f0e6", background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#374151" }}>{fmtDate(row.date)}</td>
                    <td style={{ padding: "11px 14px", color: GR, fontWeight: 700 }}>{row.description}</td>
                    <td style={{ padding: "11px 14px", color: "#16a34a", fontWeight: 800, direction: "ltr", textAlign: "right", whiteSpace: "nowrap" }}>{kwd(row.amount)}</td>
                    <td style={{ padding: "11px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 10, background: "#f0fdf4", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>{INCOME_CAT_AR[row.category] ?? row.category}</span></td>
                    <td style={{ padding: "11px 14px", color: "#6b7280" }}>{row.employeeName ?? "—"}</td>
                    <td style={{ padding: "11px 14px", color: "#9ca3af", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.notes ?? "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setEditing(row); setShowForm(false); setForm({ description: row.description, amount: row.amount, date: row.date, category: row.category, notes: row.notes ?? "", employeeId: row.employeeId ?? "", contractId: row.contractId ?? "" }); }} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", cursor: "pointer", fontFamily: "inherit" }}><Pencil size={12} /></button>
                        <button onClick={() => { if (confirm("حذف هذا الإيراد؟")) deleteMut.mutate(row.id); }} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 3 — EXPENSES (المصروفات)
═══════════════════════════════════════════════════ */
const expenseEmpty = { description: "", amount: "", dueDate: "", paidDate: "", status: "pending", category: "general", vendor: "", notes: "" };

function ExpensesTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ ...expenseEmpty });
  const fileRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const { data: expenses = [], isLoading } = useQuery<ExpenseRow[]>({
    queryKey: ["finance-expenses"],
    queryFn: () => apiFetch("/api/finance/expenses"),
    enabled: isAdmin,
  });

  const pending = expenses.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
  const paid    = expenses.filter(e => e.status === "paid").reduce((s, e) => s + Number(e.amount), 0);
  const overdue = expenses.filter(e => e.status === "overdue").reduce((s, e) => s + Number(e.amount), 0);

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/finance/expenses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); qc.invalidateQueries({ queryKey: ["finance-summary"] }); closeForm(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/finance/expenses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); qc.invalidateQueries({ queryKey: ["finance-summary"] }); closeForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/finance/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); qc.invalidateQueries({ queryKey: ["finance-summary"] }); },
  });

  const markPaid = (row: ExpenseRow) => {
    const today = new Date().toISOString().split("T")[0];
    updateMut.mutate({ id: row.id, data: { status: "paid", paidDate: today } });
  };

  const closeForm = () => { setShowForm(false); setEditing(null); setForm({ ...expenseEmpty }); };

  const handleSave = () => {
    const payload = { ...form, amount: Number(form.amount), dueDate: form.dueDate || null, paidDate: form.paidDate || null };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["الوصف","المبلغ","تاريخ الاستحقاق","الحالة","الفئة","المورد","الملاحظات"],["فاتورة كهرباء","250","2025-01-31","pending","utilities","الكهرباء والماء",""]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "نموذج");
    XLSX.writeFile(wb, "نموذج_المصروفات.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportResult(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await apiFetch<any>("/api/finance/import/expenses", { method: "POST", body: fd });
      setImportResult(`✅ تم استيراد ${r.inserted} سجل بنجاح`);
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
    } catch { setImportResult("❌ فشل في استيراد الملف"); }
    setImportLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "قيد الانتظار", value: pending, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
          { label: "مدفوعة",       value: paid,    color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
          { label: "متأخرة",       value: overdue, color: "#dc2626", bg: "#fff1f2", border: "#fecaca" },
        ].map(s => (
          <div key={s.label} style={{ ...card(), padding: "14px 18px", background: s.bg, border: `1.5px solid ${s.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: s.color, direction: "ltr" }}>{kwd(s.value)}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
          <Download size={13} />نموذج Excel
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", cursor: "pointer", fontFamily: "inherit" }}>
          {importLoading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
          استيراد Excel
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
        </label>
        <a href="/api/finance/export/expenses" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>
          <Download size={13} />تصدير
        </a>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ ...expenseEmpty }); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={14} />إضافة فاتورة
        </button>
      </div>
      {importResult && <div style={{ padding: "10px 14px", borderRadius: 10, background: importResult.startsWith("✅") ? "#f0fdf4" : "#fff1f2", border: `1px solid ${importResult.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`, fontSize: 13, fontWeight: 600, color: importResult.startsWith("✅") ? "#16a34a" : "#dc2626" }}>{importResult}</div>}

      {/* Form */}
      {(showForm || editing) && (
        <div style={{ ...card(), padding: "20px 22px", border: `1.5px solid ${G}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>{editing ? "تعديل الفاتورة" : "إضافة فاتورة جديدة"}</span>
            <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>الوصف *</label>
              <input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="وصف الفاتورة" style={inp} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>المبلغ (د.ك) *</label>
              <input type="number" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} placeholder="0.000" style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>الحالة</label>
              <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))} style={inp}>
                {Object.entries(EXPENSE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>تاريخ الاستحقاق</label>
              <input type="date" value={form.dueDate} onChange={e => setForm((f: any) => ({ ...f, dueDate: e.target.value }))} style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>تاريخ الدفع</label>
              <input type="date" value={form.paidDate} onChange={e => setForm((f: any) => ({ ...f, paidDate: e.target.value }))} style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={lbl}>الفئة</label>
              <select value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))} style={inp}>
                {EXPENSE_CATS.map(c => <option key={c} value={c}>{EXPENSE_CAT_AR[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>المورد / الجهة</label>
              <input value={form.vendor} onChange={e => setForm((f: any) => ({ ...f, vendor: e.target.value }))} placeholder="اسم المورد أو الجهة" style={inp} onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>الملاحظات</label>
              <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات..." style={{ ...inp, height: 60, resize: "vertical" } as any} onFocus={focus} onBlur={blur} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={closeForm} style={{ padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
            <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
              <Save size={14} />حفظ
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={card()}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : expenses.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 50, gap: 10 }}>
            <Receipt size={36} color="#e2d5b0" />
            <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد فواتير مسجلة</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0ead8", background: "#fdf8ec" }}>
                  {["الوصف","المبلغ","الحالة","الاستحقاق","الدفع","الجهة","الفئة",""].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#374151", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((row, i) => {
                  const st = EXPENSE_STATUS[row.status] ?? EXPENSE_STATUS.pending;
                  const StIcon = st.icon;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f5f0e6", background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                      <td style={{ padding: "11px 14px", color: GR, fontWeight: 700 }}>{row.description}</td>
                      <td style={{ padding: "11px 14px", color: "#dc2626", fontWeight: 800, direction: "ltr", textAlign: "right", whiteSpace: "nowrap" }}>{kwd(row.amount)}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 10, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700 }}>
                          <StIcon size={11} />{st.label}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: row.status === "overdue" ? "#dc2626" : "#374151", fontWeight: row.status === "overdue" ? 700 : 400 }}>{fmtDate(row.dueDate)}</td>
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#6b7280" }}>{fmtDate(row.paidDate)}</td>
                      <td style={{ padding: "11px 14px", color: "#6b7280" }}>{row.vendor ?? "—"}</td>
                      <td style={{ padding: "11px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 10, background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 700 }}>{EXPENSE_CAT_AR[row.category] ?? row.category}</span></td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          {row.status !== "paid" && (
                            <button onClick={() => markPaid(row)} style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>✓ دفع</button>
                          )}
                          <button onClick={() => { setEditing(row); setShowForm(false); setForm({ description: row.description, amount: row.amount, dueDate: row.dueDate ?? "", paidDate: row.paidDate ?? "", status: row.status, category: row.category, vendor: row.vendor ?? "", notes: row.notes ?? "" }); }} style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", cursor: "pointer", fontFamily: "inherit" }}><Pencil size={12} /></button>
                          <button onClick={() => { if (confirm("حذف هذه الفاتورة؟")) deleteMut.mutate(row.id); }} style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 4 — EMPLOYEE SALES (مبيعات الموظفين)
═══════════════════════════════════════════════════ */
const saleEmpty = { employeeId: "", contractId: "", description: "", totalContractAmount: "", profitPercentage: "", saleDate: "", notes: "" };

function SalesTab({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ ...saleEmpty });

  const { data: sales = [], isLoading } = useQuery<SaleRow[]>({
    queryKey: ["finance-sales"],
    queryFn: () => apiFetch("/api/finance/sales"),
  });
  const { data: users = [] } = useQuery<UserDir[]>({
    queryKey: ["users-directory"],
    queryFn: () => apiFetch("/api/users/directory"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/api/finance/sales", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-sales"] }); closeForm(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/api/finance/sales/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-sales"] }); closeForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/finance/sales/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-sales"] }); },
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm({ ...saleEmpty }); };

  const handleSave = () => {
    const payload: any = {
      description: form.description,
      profitPercentage: form.profitPercentage ? Number(form.profitPercentage) : null,
      saleDate: form.saleDate,
      notes: form.notes || null,
      contractId: form.contractId ? Number(form.contractId) : null,
    };
    if (isAdmin) {
      payload.employeeId = form.employeeId ? Number(form.employeeId) : null;
      payload.totalContractAmount = form.totalContractAmount ? Number(form.totalContractAmount) : null;
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  // Per-employee aggregates (admin only)
  const employeeTotals: Record<number, { name: string; contractTotal: number; profitTotal: number; count: number }> = {};
  if (isAdmin) {
    for (const s of sales) {
      if (!employeeTotals[s.employeeId]) {
        employeeTotals[s.employeeId] = { name: s.employeeName ?? `موظف #${s.employeeId}`, contractTotal: 0, profitTotal: 0, count: 0 };
      }
      employeeTotals[s.employeeId].contractTotal += Number(s.totalContractAmount ?? 0);
      employeeTotals[s.employeeId].profitTotal   += Number(s.profitAmount ?? 0);
      employeeTotals[s.employeeId].count++;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Admin employee summary cards */}
      {isAdmin && Object.keys(employeeTotals).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserCheck size={15} color={G} />
            <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>ملخص مبيعات الموظفين</span>
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>(مرئي للمدير فقط)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
            {Object.values(employeeTotals).map(e => (
              <div key={e.name} style={{ ...card(), padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Users size={14} color={G} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginRight: "auto" }}>{e.count} عقد</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>إجمالي العقود</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", direction: "ltr" }}>{kwd(e.contractTotal)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>إجمالي الربح</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#16a34a", direction: "ltr" }}>{kwd(e.profitTotal)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {isAdmin && (
          <a href="/api/finance/export/sales" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>
            <Download size={13} />تصدير Excel
          </a>
        )}
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ ...saleEmpty }); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={14} />إضافة مبيعة
        </button>
      </div>

      {/* Non-admin info banner */}
      {!isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a" }}>
          <EyeOff size={15} color="#d97706" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>يمكنك إدخال نسبة الربح فقط — إجمالي العقد ومبلغ الربح مرئي للمدير فقط</span>
        </div>
      )}

      {/* Form */}
      {(showForm || editing) && (
        <div style={{ ...card(), padding: "20px 22px", border: `1.5px solid ${G}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>{editing ? "تعديل المبيعة" : "إضافة مبيعة"}</span>
            <button onClick={closeForm} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {isAdmin && (
              <div>
                <label style={lbl}>الموظف</label>
                <select value={form.employeeId} onChange={e => setForm((f: any) => ({ ...f, employeeId: e.target.value }))} style={inp}>
                  <option value="">— اختر الموظف —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>التاريخ *</label>
              <input type="date" value={form.saleDate} onChange={e => setForm((f: any) => ({ ...f, saleDate: e.target.value }))} style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>الوصف *</label>
              <input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="وصف المبيعة / العقد" style={inp} onFocus={focus} onBlur={blur} />
            </div>
            {isAdmin && (
              <div>
                <label style={lbl}>إجمالي العقد (د.ك)</label>
                <input type="number" value={form.totalContractAmount} onChange={e => setForm((f: any) => ({ ...f, totalContractAmount: e.target.value }))} placeholder="0.000" style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
              </div>
            )}
            <div>
              <label style={lbl}>نسبة الربح %</label>
              <input type="number" value={form.profitPercentage} onChange={e => setForm((f: any) => ({ ...f, profitPercentage: e.target.value }))} placeholder="0.00" min="0" max="100" style={{ ...inp, direction: "ltr" }} onFocus={focus} onBlur={blur} />
            </div>
            {isAdmin && form.totalContractAmount && form.profitPercentage && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>مبلغ الربح المحسوب:</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#16a34a", direction: "ltr" }}>
                  {kwd(Number(form.totalContractAmount) * Number(form.profitPercentage) / 100)}
                </span>
              </div>
            )}
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>الملاحظات</label>
              <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات..." style={{ ...inp, height: 60, resize: "vertical" } as any} onFocus={focus} onBlur={blur} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={closeForm} style={{ padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
            <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${G},${GD})`, border: "none", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
              <Save size={14} />حفظ
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={card()}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : sales.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 50, gap: 10 }}>
            <UserCheck size={36} color="#e2d5b0" />
            <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>لا توجد مبيعات مسجلة</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0ead8", background: "#fdf8ec" }}>
                  {[
                    "التاريخ", "الوصف",
                    ...(isAdmin ? ["الموظف", "إجمالي العقد", "الربح"] : ["نسبة الربح %"]),
                    "الملاحظات", ""
                  ].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#374151", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f5f0e6", background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#374151" }}>{fmtDate(row.saleDate)}</td>
                    <td style={{ padding: "11px 14px", color: GR, fontWeight: 700 }}>{row.description}</td>
                    {isAdmin && <td style={{ padding: "11px 14px", color: "#374151" }}>{row.employeeName ?? "—"}</td>}
                    {isAdmin && (
                      <td style={{ padding: "11px 14px", color: "#374151", fontWeight: 700, direction: "ltr", textAlign: "right", whiteSpace: "nowrap" }}>{kwd(row.totalContractAmount)}</td>
                    )}
                    {isAdmin && (
                      <td style={{ padding: "11px 14px", color: "#16a34a", fontWeight: 800, direction: "ltr", textAlign: "right", whiteSpace: "nowrap" }}>{kwd(row.profitAmount)}</td>
                    )}
                    {!isAdmin && (
                      <td style={{ padding: "11px 14px", color: "#d97706", fontWeight: 700, direction: "ltr", textAlign: "right" }}>{row.profitPercentage ? `${Number(row.profitPercentage).toFixed(2)}%` : "—"}</td>
                    )}
                    <td style={{ padding: "11px 14px", color: "#9ca3af", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.notes ?? "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => { setEditing(row); setShowForm(false); setForm({ description: row.description, profitPercentage: row.profitPercentage ?? "", saleDate: row.saleDate, notes: row.notes ?? "", contractId: row.contractId ?? "", employeeId: row.employeeId, totalContractAmount: row.totalContractAmount ?? "" }); }} style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", cursor: "pointer", fontFamily: "inherit" }}><Pencil size={12} /></button>
                        {isAdmin && <button onClick={() => { if (confirm("حذف هذه المبيعة؟")) deleteMut.mutate(row.id); }} style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}><Trash2 size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════ */
export default function FinancesList() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"summary"|"income"|"expenses"|"sales">("summary");

  type TabDef = { key: string; label: string; icon: React.ElementType; show: boolean };
  const TABS: TabDef[] = [
    { key: "summary",  label: "الرصيد",      icon: Scale,        show: isAdmin },
    { key: "income",   label: "الإيرادات",   icon: TrendingUp,   show: isAdmin },
    { key: "expenses", label: "المصروفات",   icon: TrendingDown, show: isAdmin },
    { key: "sales",    label: "المبيعات",    icon: UserCheck,    show: true },
  ].filter(t => t.show);

  // If employee lands on a tab not available (summary, income, expenses), redirect to sales
  const availableKeys = TABS.map((t: TabDef) => t.key);
  const currentTab = availableKeys.includes(activeTab) ? activeTab : "sales";

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 26, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: GR, margin: 0 }}>الإدارة المالية</h1>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0, paddingRight: 14 }}>
          {isAdmin ? "إيرادات الشركة · المصروفات والفواتير · مبيعات الموظفين" : "متابعة مبيعاتك الشخصية"}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 6, alignSelf: "flex-start" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: "none", background: currentTab === t.key ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: currentTab === t.key ? "white" : "#374151", boxShadow: currentTab === t.key ? `0 3px 12px rgba(212,165,52,0.4)` : undefined }}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {currentTab === "summary"  && isAdmin && <SummaryTab />}
      {currentTab === "income"   && isAdmin && <IncomeTab isAdmin={isAdmin} />}
      {currentTab === "expenses" && isAdmin && <ExpensesTab isAdmin={isAdmin} />}
      {currentTab === "sales"    && <SalesTab isAdmin={isAdmin} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
