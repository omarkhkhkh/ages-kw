import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { obligationsApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Send, CheckCircle2, Banknote, Play, Trash2, X } from "lucide-react";

/* ═══ لوحة التجديدات + مسيّر الرواتب — الخارطة الموحّدة، المرحلة ٦ ═══ */

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const card: CSSProperties = { background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginBottom: 16 };
const inp: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const th: CSSProperties = { padding: "9px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", textAlign: "right", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f5f0e6" };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const lbl: CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 };
const KIND_AR: Record<string, string> = { government_registration: "تسجيل جهة", company_document: "مستند شركة", worker: "وثيقة عامل" };

function DaysChip({ d }: { d: number }) {
  const c = d < 0 ? { bg: "#fff1f2", color: "#dc2626", t: `متأخر ${Math.abs(d)} يوم` }
    : d <= 14 ? { bg: "#fff1f2", color: "#dc2626", t: `${d} يوم` }
    : d <= 30 ? { bg: "#fffbeb", color: "#d97706", t: `${d} يوم` }
    : { bg: "#f0fdf4", color: "#16a34a", t: `${d} يوم` };
  return <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, background: c.bg, color: c.color }}>{c.t}</span>;
}

/** نافذة إتمام التجديد — الإثباتان الإلزاميان */
function CompleteModal({ taskId, name, onClose }: { taskId: number; name: string; onClose: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const [f, setF] = useState({ newExpiryDate: "", amount: "", notes: "" });
  const doneM = useMutation({
    mutationFn: () => obligationsApi.complete({ taskId, newExpiryDate: f.newExpiryDate, amount: f.amount, notes: f.notes || undefined }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["obl-board"] });
      toast({ title: r.free ? "✅ جُدّد مجانًا — سُجّل الصفر صراحةً" : `✅ جُدّد — مصروف #${r.expenseId} على ${r.costCenter ?? "التصنيف التلقائي"}` });
      onClose();
    },
    onError: (e: any) => toast({ title: "تعذّر الإتمام", description: e.message, variant: "destructive" }),
  });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,26,16,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, border: `1.5px solid ${G}33`, width: "min(460px,100%)", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: GR }}>إتمام التجديد — {name}</div>
          <button onClick={onClose} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6, cursor: "pointer", display: "inline-flex" }}><X size={14} color="#64748b" /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><label style={lbl}>تاريخ الانتهاء الجديد *</label><input style={inp} type="date" value={f.newExpiryDate} onChange={(e) => setF({ ...f, newExpiryDate: e.target.value })} /></div>
          <div><label style={lbl}>المبلغ المدفوع (د.ك) * — المجاني يُسجَّل صفرًا</label><input style={inp} type="number" step="0.001" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><label style={lbl}>ملاحظات</label><input style={inp} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <button style={{ ...btn, justifyContent: "center" }} disabled={doneM.isPending || !f.newExpiryDate || f.amount === ""} onClick={() => doneM.mutate()}>
            <CheckCircle2 size={14} /> {doneM.isPending ? "جارٍ…" : "إتمام"}</button>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.7 }}>المبلغ &gt; صفر يتقيد مصروفًا تشغيليًا تلقائيًا — وإقامة عامل الصيانة على مركز الصيانة تحديدًا.</p>
        </div>
      </div>
    </div>
  );
}

function RenewalsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: board = [] } = useQuery<any[]>({ queryKey: ["obl-board"], queryFn: () => obligationsApi.board() });
  const { data: directory = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch<any[]>("/api/users/directory") });
  const [completing, setCompleting] = useState<{ taskId: number; name: string } | null>(null);
  const dispatchM = useMutation({
    mutationFn: (d: any) => obligationsApi.dispatch(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obl-board"] }); toast({ title: "أُرسلت مهمة التجديد للمندوب" }); },
    onError: (e: any) => toast({ title: "تعذّر الإرسال", description: e.message, variant: "destructive" }),
  });
  return (
    <>
      {completing && <CompleteModal taskId={completing.taskId} name={completing.name} onClose={() => setCompleting(null)} />}
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead style={{ background: "#faf8f2" }}>
            <tr>{["النوع", "الاسم", "الوثيقة", "الانتهاء", "المتبقي", "المهمة", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {board.length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={7}>لا التزامات تقارب الانتهاء خلال 60 يومًا 🎉</td></tr> :
              board.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{KIND_AR[r.kind]}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{r.name}</td>
                  <td style={td}>{r.docLabel}{r.module && <span style={{ color: "#9ca3af", fontSize: 11 }}> ({r.module === "maintenance" ? "صيانة" : "نقل"})</span>}</td>
                  <td style={{ ...td, fontSize: 12 }}>{String(r.expiry).slice(0, 10)}</td>
                  <td style={td}><DaysChip d={r.daysLeft} /></td>
                  <td style={td}>{r.openTaskId
                    ? <span style={{ color: "#2563eb", fontWeight: 700, fontSize: 12 }}>قائمة #{r.openTaskId}</span>
                    : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {canManage && !r.openTaskId && (
                      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                        <select id={`obl-a-${i}`} style={{ ...inp, width: 130, padding: "5px 8px", fontSize: 12 }} defaultValue="">
                          <option value="">— المندوب —</option>
                          {directory.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                        </select>
                        <button style={{ ...btn, padding: "5px 10px", fontSize: 11.5 }} disabled={dispatchM.isPending}
                          onClick={() => {
                            const sel = document.getElementById(`obl-a-${i}`) as HTMLSelectElement | null;
                            if (!sel?.value) { toast({ title: "اختر المندوب أولًا", variant: "destructive" }); return; }
                            dispatchM.mutate({ kind: r.kind, id: r.id, docType: r.docType ?? undefined, assigneeUserId: Number(sel.value) });
                          }}><Send size={12} /> إرسال</button>
                      </span>
                    )}
                    {canManage && r.openTaskId && (
                      <button style={{ ...btn, padding: "5px 10px", fontSize: 11.5, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
                        onClick={() => setCompleting({ taskId: r.openTaskId, name: `${r.docLabel} — ${r.name}` })}>
                        <CheckCircle2 size={12} /> إتمام</button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PayrollTab({ canPost }: { canPost: boolean }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const now = new Date();
  const [ym, setYm] = useState({ year: String(now.getFullYear()), month: String(now.getMonth() + 1) });
  const [runId, setRunId] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: ["payroll", runId], queryFn: () => obligationsApi.payroll(runId ?? undefined) });
  const inv = () => qc.invalidateQueries({ queryKey: ["payroll"] });
  const genM = useMutation({
    mutationFn: () => obligationsApi.payrollGenerate(Number(ym.year), Number(ym.month)),
    onSuccess: (r: any) => { inv(); setRunId(r.runId); toast({ title: `✅ وُلّد المسيّر — ${r.workers} عامل` }); },
    onError: (e: any) => toast({ title: "تعذّر التوليد", description: e.message, variant: "destructive" }),
  });
  const postM = useMutation({
    mutationFn: (id: number) => obligationsApi.payrollPost(id),
    onSuccess: (r: any) => { inv(); toast({ title: `✅ رُحّل — ${r.expenses} مصروف راتب على مراكز الأقسام` }); },
    onError: (e: any) => toast({ title: "تعذّر الترحيل", description: e.message, variant: "destructive" }),
  });
  const delM = useMutation({ mutationFn: (id: number) => obligationsApi.payrollDeleteItem(id), onSuccess: inv, onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }) });
  const runs: any[] = data?.runs ?? [];
  const items: any[] = data?.items ?? [];
  const currentRun = runs.find((r) => r.id === (runId ?? data?.itemsRunId));
  const total = items.reduce((s, i) => s + Number(i.salary), 0);
  return (
    <>
      {canPost && (
        <div style={{ ...card, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div><label style={lbl}>السنة</label><input style={{ ...inp, width: 90 }} type="number" value={ym.year} onChange={(e) => setYm({ ...ym, year: e.target.value })} /></div>
          <div><label style={lbl}>الشهر</label><input style={{ ...inp, width: 70 }} type="number" min={1} max={12} value={ym.month} onChange={(e) => setYm({ ...ym, month: e.target.value })} /></div>
          <button style={btn} disabled={genM.isPending} onClick={() => genM.mutate()}><Banknote size={13} /> توليد مسيّر الشهر</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ ...card, padding: 10 }}>
          {runs.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 12.5, padding: 8 }}>لا مسيّرات بعد</div> :
            runs.map((r) => (
              <button key={r.id} onClick={() => setRunId(r.id)}
                style={{ display: "block", width: "100%", textAlign: "right", padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: 4, background: (runId ?? data?.itemsRunId) === r.id ? "#fdf8ec" : "transparent" }}>
                <b style={{ color: GR, fontSize: 13 }}>{r.month}/{r.year}</b>
                <span style={{ marginRight: 8, fontSize: 11, fontWeight: 700, color: r.status === "مرحّل" ? "#16a34a" : "#d97706" }}>{r.status}</span>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.workers} عامل · {Number(r.total).toLocaleString()} د.ك</div>
              </button>
            ))}
        </div>
        <div style={{ ...card, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead style={{ background: "#faf8f2" }}>
              <tr>{["العامل", "مركز القسم", "الراتب", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.length === 0 ? <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={4}>اختر مسيّرًا</td></tr> :
                items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{i.workerName}</td>
                    <td style={td}>{i.costCenterName ?? <span style={{ color: "#9ca3af" }}>عام (تلقائي)</span>}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{Number(i.salary).toLocaleString()}</td>
                    <td style={td}>{canPost && currentRun?.status === "مسودة" && (
                      <button style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, padding: 4, cursor: "pointer", display: "inline-flex" }}
                        onClick={() => delM.mutate(i.id)}><Trash2 size={12} color="#dc2626" /></button>
                    )}{i.expenseId && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>مصروف #{i.expenseId}</span>}</td>
                  </tr>
                ))}
              {items.length > 0 && (
                <tr style={{ background: "#faf8f2" }}>
                  <td style={{ ...td, fontWeight: 800 }}>الإجمالي</td><td style={td}></td>
                  <td style={{ ...td, fontWeight: 900, color: GD }}>{total.toLocaleString()}</td>
                  <td style={td}>{canPost && currentRun?.status === "مسودة" && (
                    <button style={{ ...btn, padding: "6px 12px", fontSize: 12, background: "#16a34a" }} disabled={postM.isPending}
                      onClick={() => { if (confirm(`ترحيل ${items.length} راتبًا (${total.toLocaleString()} د.ك) إلى المصاريف على مراكز الأقسام؟`)) postM.mutate(currentRun.id); }}>
                      <Play size={12} /> ترحيل</button>
                  )}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function ObligationsPage() {
  const { user } = useAuth();
  const positions = user?.positions ?? [];
  const isAdmin = user?.role === "admin";
  const canManage = isAdmin || positions.includes("executive_manager") || positions.includes("general_manager");
  const canPost = isAdmin || positions.includes("financial_manager") || positions.includes("general_manager");
  const canSee = canManage || canPost;
  const [tab, setTab] = useState<"renewals" | "payroll">("renewals");
  if (!canSee) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>هذه الصفحة للمديرين.</div>;
  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Segoe UI',Tahoma,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
        <CalendarClock size={22} color={GD} />
        <h1 style={{ fontSize: 21, fontWeight: 800, color: GR, margin: 0 }}>التجديدات والمسيّر</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px 14px" }}>الالتزامات المتجددة الثلاثة (تسجيلات · مستندات · وثائق العمال) بحلقة المندوب — ومسيّر الرواتب على مراكز الأقسام.</p>
      <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 12, border: "1.5px solid #f0ead8", padding: 5, marginBottom: 14, width: "fit-content" }}>
        {([["renewals", "لوحة التجديدات"], ["payroll", "مسيّر الرواتب"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none", background: tab === k ? `linear-gradient(135deg,${G},${GD})` : "transparent", color: tab === k ? "white" : "#374151" }}>
            {l}
          </button>
        ))}
      </div>
      {tab === "renewals" && <RenewalsTab canManage={canManage} />}
      {tab === "payroll" && <PayrollTab canPost={canPost} />}
    </div>
  );
}
