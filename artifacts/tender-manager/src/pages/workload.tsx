import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workTransfersApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Scale, ArrowLeftRight, Inbox, History, X, CheckCircle2, XCircle } from "lucide-react";
import { PerformanceTab } from "@/pages/research";

/* ═══ لوحة الأحمال والنقل الموحّد — الخارطة الموحّدة، المرحلة ٢ ═══
   للمدير العام وحامل قبعة التنفيذي: كم عملًا مفتوحًا عند كل موظف، نقلٌ بزر واحد
   بسبب إلزامي، وصندوق طلبات النقل الواردة من الموظفين، وشريط آخر التحركات. */

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const card: CSSProperties = { background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginBottom: 16 };
const inp: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const th: CSSProperties = { padding: "9px 12px", fontWeight: 800, fontSize: 11, color: "#6b7280", borderBottom: "1.5px solid #f0ead8", textAlign: "right", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f5f0e6" };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const lbl: CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 };
const fmtDT = (d: any) => (d ? new Date(d).toLocaleString("ar-KW", { dateStyle: "short", timeStyle: "short" }) : "—");

const TYPE_COLS: [string, string][] = [
  ["task", "مهام"], ["research_assignment", "تكليفات بحث"], ["maintenance_work_order", "أوامر صيانة"],
  ["transport_task", "مهام نقل"], ["opportunity", "فرص"], ["government_registration", "تسجيلات"], ["company_document", "مستندات"],
];

/** نافذة النقل: اختيار عمل من أعمال الموظف المفتوحة ← مستلم ← سبب إلزامي */
function TransferModal({ fromUser, onClose }: { fromUser: { id: number; fullName: string }; onClose: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: items = [] } = useQuery<any[]>({ queryKey: ["wt-items", fromUser.id], queryFn: () => workTransfersApi.userItems(fromUser.id) });
  const { data: directory = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch<any[]>("/api/users/directory") });
  const [sel, setSel] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState("");
  const doM = useMutation({
    mutationFn: () => {
      const [entityType, entityId] = sel.split(":");
      return workTransfersApi.transfer({ entityType, entityId: Number(entityId), toUserId: Number(toUserId), reason });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wt-workload"] });
      qc.invalidateQueries({ queryKey: ["wt-recent"] });
      qc.invalidateQueries({ queryKey: ["wt-items", fromUser.id] });
      toast({ title: "✅ نُقل العمل وسُجّل في سيرته" });
      onClose();
    },
    onError: (e: any) => toast({ title: "تعذّر النقل", description: e.message, variant: "destructive" }),
  });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,26,16,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, border: `1.5px solid ${G}33`, width: "min(520px,100%)", maxHeight: "85vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}><ArrowLeftRight size={16} color={GD} /> نقل عمل من {fromUser.fullName}</div>
          <button onClick={onClose} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6, cursor: "pointer", display: "inline-flex" }}><X size={14} color="#64748b" /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={lbl}>العمل المراد نقله *</label>
            <select style={inp} value={sel} onChange={(e) => setSel(e.target.value)}>
              <option value="">— اختر من أعماله المفتوحة ({items.length}) —</option>
              {items.map((i) => <option key={`${i.entityType}:${i.entityId}`} value={`${i.entityType}:${i.entityId}`}>[{i.typeLabel}] {i.title}</option>)}
            </select></div>
          <div><label style={lbl}>إلى الموظف *</label>
            <select style={inp} value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
              <option value="">— اختر —</option>
              {directory.filter((u) => u.id !== fromUser.id).map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select></div>
          <div><label style={lbl}>سبب النقل * (يبقى في سيرة العمل)</label>
            <input style={inp} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: إجازة طارئة / إعادة توزيع أحمال" /></div>
          <button style={{ ...btn, justifyContent: "center" }} disabled={!sel || !toUserId || !reason.trim() || doM.isPending}
            onClick={() => doM.mutate()}><ArrowLeftRight size={14} /> {doM.isPending ? "جارٍ النقل…" : "تنفيذ النقل"}</button>
          <p style={{ fontSize: 11.5, color: "#9ca3af", margin: 0, lineHeight: 1.8 }}>العمل ينتقل بكامل تاريخه — المستلم يكمل من حيث توقف السابق، والسيرة تسجّل: من، إلى، بواسطة، السبب.</p>
        </div>
      </div>
    </div>
  );
}

export default function WorkloadPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient(); const { toast } = useToast();
  const canSee = user?.role === "admin" || (user?.positions ?? []).includes("executive_manager");
  const [transferFrom, setTransferFrom] = useState<{ id: number; fullName: string } | null>(null);

  const { data: workload = [] } = useQuery<any[]>({ queryKey: ["wt-workload"], queryFn: () => workTransfersApi.workload(), enabled: canSee });
  const { data: requests = [] } = useQuery<any[]>({ queryKey: ["wt-requests"], queryFn: () => workTransfersApi.requests("معلق"), enabled: canSee });
  const { data: recent = [] } = useQuery<any[]>({ queryKey: ["wt-recent"], queryFn: () => workTransfersApi.recent(), enabled: canSee });
  const { data: directory = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch<any[]>("/api/users/directory"), enabled: canSee });

  const inv = () => { qc.invalidateQueries({ queryKey: ["wt-requests"] }); qc.invalidateQueries({ queryKey: ["wt-workload"] }); qc.invalidateQueries({ queryKey: ["wt-recent"] }); };
  const approveM = useMutation({
    mutationFn: ({ id, toUserId }: { id: number; toUserId?: number }) => workTransfersApi.approveRequest(id, toUserId),
    onSuccess: () => { inv(); toast({ title: "✅ نُفّذ الطلب" }); },
    onError: (e: any) => toast({ title: "تعذّر التنفيذ", description: e.message, variant: "destructive" }),
  });
  const rejectM = useMutation({
    mutationFn: (id: number) => workTransfersApi.rejectRequest(id),
    onSuccess: () => { inv(); toast({ title: "رُفض الطلب" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // قاعدة الإخفاء الكامل: الصفحة لا تعرض شيئًا لغير المخوّلين
  if (!canSee) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>هذه الصفحة للمدير العام والمدير التنفيذي.</div>;

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Segoe UI',Tahoma,sans-serif" }}>
      {transferFrom && <TransferModal fromUser={transferFrom} onClose={() => setTransferFrom(null)} />}

      {!embedded && (
      <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg,${G},${GD})` }} />
        <Scale size={22} color={GD} />
        <h1 style={{ fontSize: 21, fontWeight: 800, color: GR, margin: 0 }}>لوحة الأحمال والنقل</h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 18px 14px" }}>الأعمال المفتوحة عند كل موظف · النقل الموحّد بسبب مسجَّل · طلبات النقل الواردة · آخر التحركات.</p>
      </>
      )}

      {/* طلبات النقل المعلقة */}
      {requests.length > 0 && (
        <div style={{ ...card, borderRightWidth: 4, borderRightColor: G }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <Inbox size={16} color={GD} /> طلبات نقل بانتظار قرارك ({requests.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {requests.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", border: "1px solid #f0ead8", borderRadius: 10, padding: "9px 12px" }}>
                <div style={{ fontSize: 12.5, minWidth: 0 }}>
                  <b style={{ color: GR }}>{r.requestedByName}</b> يطلب نقل <span style={{ color: GD, fontWeight: 700 }}>[{r.typeLabel}] #{r.entityId}</span>
                  {r.suggestedToName && <> إلى <b>{r.suggestedToName}</b></>}
                  <div style={{ color: "#6b7280", fontSize: 12 }}>السبب: {r.reason} · {fmtDT(r.createdAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  {!r.suggestedToUserId && (
                    <select id={`req-to-${r.id}`} style={{ ...inp, width: 160, padding: "6px 8px", fontSize: 12 }} defaultValue="">
                      <option value="">— المستلم —</option>
                      {directory.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                  )}
                  <button style={{ ...btn, padding: "6px 12px", fontSize: 12, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
                    disabled={approveM.isPending}
                    onClick={() => {
                      const selEl = document.getElementById(`req-to-${r.id}`) as HTMLSelectElement | null;
                      const chosen = selEl?.value ? Number(selEl.value) : undefined;
                      approveM.mutate({ id: r.id, toUserId: chosen });
                    }}><CheckCircle2 size={13} /> تنفيذ</button>
                  <button style={{ ...btn, padding: "6px 12px", fontSize: 12, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca" }}
                    disabled={rejectM.isPending} onClick={() => rejectM.mutate(r.id)}><XCircle size={13} /> رفض</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* جدول الأحمال */}
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead style={{ background: "#faf8f2" }}>
            <tr>
              <th style={th}>الموظف</th><th style={th}>القبعات</th>
              {TYPE_COLS.map(([k, l]) => <th key={k} style={th}>{l}</th>)}
              <th style={th}>الإجمالي</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {workload.map((w) => (
              <tr key={w.id}>
                <td style={{ ...td, fontWeight: 700 }}>{w.fullName}</td>
                <td style={td}>{(w.positions ?? []).length ? (w.positions ?? []).map((p: string) => (
                  <span key={p} style={{ display: "inline-block", padding: "1px 8px", margin: "1px 0 1px 4px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: "#fdf8ec", color: GD, border: `1px solid ${G}30`, whiteSpace: "nowrap" }}>{p}</span>
                )) : <span style={{ color: "#cbd5e1", fontSize: 11 }}>بلا قبعة</span>}</td>
                {TYPE_COLS.map(([k]) => <td key={k} style={{ ...td, color: Number(w[k]) > 0 ? "#374151" : "#d1d5db" }}>{w[k]}</td>)}
                <td style={{ ...td, fontWeight: 800, color: w.total > 7 ? "#dc2626" : w.total > 0 ? "#16a34a" : "#d1d5db" }}>{w.total}</td>
                <td style={td}>
                  <button style={{ ...btn, padding: "5px 11px", fontSize: 12 }} disabled={w.total === 0} onClick={() => setTransferFrom({ id: w.id, fullName: w.fullName })}>
                    <ArrowLeftRight size={12} /> نقل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* تحليل الإنجاز — انتقل من البحث والتطوير: نفس الأحمال بعين الأداء */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          <History size={16} color={GD} /> تحليل الإنجاز
        </div>
        <PerformanceTab />
      </div>

      {/* آخر التحركات */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          <History size={16} color={GD} /> آخر التحركات
        </div>
        {recent.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 13 }}>لا تحركات بعد</div> :
          recent.map((t) => (
            <div key={t.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "6px 0", borderBottom: "1px dashed #f0ead8" }}>
              <span style={{ color: GD, fontWeight: 700 }}>[{t.typeLabel}]</span> نُقل من <b>{t.fromName ?? "غير مسنَد"}</b> إلى <b>{t.toName}</b> بواسطة {t.byName ?? "؟"} — {t.reason}
              <span style={{ color: "#9ca3af" }}> · {fmtDT(t.createdAt)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
