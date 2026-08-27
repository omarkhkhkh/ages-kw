import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseFilesApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Send, PauseCircle, PlayCircle, CheckCircle2, XCircle, History, ShieldAlert, Brain, Trophy, X } from "lucide-react";

/* ═══ لوحة ملف الحالة — تُركَّب داخل صفحة المناقصة/الممارسة ═══
   بوابة إعلان مسار التوريد ← الحالة وشريط الإيقاف ← أزرار حسب القبعة ← السيرة.
   قاعدة الإخفاء: كل زر لا يملكه المستخدم غير موجود أصلًا. */

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const card: CSSProperties = { background: "white", border: "1.5px solid #f0ead8", borderRadius: 14, padding: 16, marginBottom: 14 };
const inp: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const lbl: CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 };
const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };
const fmtDT = (d: any) => (d ? new Date(d).toLocaleString("ar-KW", { dateStyle: "short", timeStyle: "short" }) : "—");

export const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "مفتوح": { bg: "#f8fafc", color: "#64748b" },
  "قيد العمل": { bg: "#eff6ff", color: "#2563eb" },
  "موقوف ماليًا": { bg: "#fff1f2", color: "#dc2626" },
  "بانتظار الاعتماد": { bg: "#fffbeb", color: "#b45309" },
  "معتمد": { bg: "#f0fdf4", color: "#16a34a" },
  "مرفوض": { bg: "#fff1f2", color: "#dc2626" },
  "مغلق": { bg: "#f3f4f6", color: "#6b7280" },
};
export function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE["مفتوح"];
  return <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 800, background: s.bg, color: s.color }}>{status}</span>;
}

/* ── بطاقة «من ذاكرة الشركة» — تُدفع لحظة فتح الملف، لا تُسأل ── */
function MemoryCard({ entityType, entityId }: { entityType: string; entityId: number }) {
  const { data: mc } = useQuery({
    queryKey: ["memory-card", entityType, entityId],
    queryFn: () => caseFilesApi.memoryCard(entityType, entityId).catch(() => null),
  });
  if (!mc || !mc.hasHistory) return null;
  return (
    <div style={{ ...card, background: "#fdfaf2", borderColor: "#e8dcc0", borderRightWidth: 4, borderRightColor: "#7c3aed" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Brain size={16} color="#7c3aed" /> من ذاكرة الشركة</div>
      <div style={{ fontSize: 12.5, color: "#4b5563", lineHeight: 2 }}>
        نافسنا عند هذه الجهة <b>{mc.sessions}</b> {mc.sessions === 1 ? "مرة" : "مرات"}: <b style={{ color: "#16a34a" }}>فزنا {mc.wins}</b> · <b style={{ color: "#dc2626" }}>خسرنا {mc.losses}</b>
        {mc.avgGapPct != null && <> — حين خسرنا كان الفائز أقل منا وسطيًا <b>{mc.avgGapPct}%</b></>}
      </div>
      {(mc.competitors ?? []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", marginBottom: 4 }}>المنافسون المتوقعون (من جلسات الفض السابقة)</div>
          {(mc.competitors ?? []).map((c: any) => (
            <div key={c.name} style={{ fontSize: 12.5, color: "#374151", padding: "3px 0", borderBottom: "1px dashed #eee3c8" }}>
              <b>{c.name}</b> — دخل {c.appearances} · فاز {c.wins}{c.avgPrice != null && <> · متوسط سعره <b>{Number(c.avgPrice).toLocaleString()}</b> د.ك</>}
            </div>
          ))}
        </div>
      )}
      {(mc.lessons ?? []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", marginBottom: 4 }}>دروس سابقة مع الجهة</div>
          {(mc.lessons ?? []).map((l: any, i: number) => (
            <div key={i} style={{ fontSize: 12, color: "#6b7280", padding: "2px 0" }}>• {l.title}{l.reasons ? ` — ${String(l.reasons).slice(0, 80)}` : ""}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── نافذة الإغلاق ببوابتيه: جلسة الفض + الدرس المستفاد ── */
function CloseModal({ cf, onClose }: { cf: any; onClose: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast();
  const { data: ready } = useQuery({ queryKey: ["closure-ready", cf.id], queryFn: () => caseFilesApi.closureReadiness(cf.id) });
  const [outcome, setOutcome] = useState<"فوز" | "خسارة" | "انسحاب">("فوز");
  const [reasons, setReasons] = useState("");
  const [lessons, setLessons] = useState("");
  const needsSession = outcome !== "انسحاب";
  const sessionMissing = needsSession && ready && (!ready.hasBidSession || ready.bidEntries === 0);
  const closeM = useMutation({
    mutationFn: () => caseFilesApi.close(cf.id, { outcome, reasons, lessons: lessons || undefined }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["case-file", cf.entityType, cf.entityId] });
      toast({ title: `✅ أُغلق الملف — ${r.outcome}`, description: r.nextStep ?? (r.evaluateSupplierId ? "لا تنسَ تقييم مورد المصدر الخاص" : undefined) });
      onClose();
    },
    onError: (e: any) => toast({ title: "بوابة الإغلاق", description: e.message, variant: "destructive" }),
  });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,26,16,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, border: `1.5px solid ${G}33`, width: "min(560px,100%)", maxHeight: "88vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}><Trophy size={16} color={GD} /> إغلاق الملف</div>
          <button onClick={onClose} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6, cursor: "pointer", display: "inline-flex" }}><X size={14} color="#64748b" /></button>
        </div>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 12px" }}>بوابتان إلزاميتان: جلسة فض العطاء (تغذّي ذكاء المنافسين) والدرس المستفاد (يغذّي مركز المعرفة). الانسحاب قبل التقديم يُعفى من الجلسة.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={lbl}>النتيجة *</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["فوز", "خسارة", "انسحاب"] as const).map((o) => (
                <button key={o} onClick={() => setOutcome(o)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${outcome === o ? G : "#e5dfc8"}`, background: outcome === o ? "#fdf8ec" : "white", color: outcome === o ? GD : "#6b7280" }}>{o}</button>
              ))}
            </div></div>
          {sessionMissing && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12.5, color: "#92400e" }}>
              <b>بوابة الإغلاق:</b> {ready?.hasBidSession ? "جلسة الفض بلا شركات — أدخل المتنافسين وأسعارهم" : "لا جلسة فض مسجّلة"} — افتح تبويب <b>فض العطاء</b> وسجّلها أولًا (من نافسنا، بكم، من فاز)، ثم عد للإغلاق.
            </div>
          )}
          <div><label style={lbl}>أسباب النتيجة * (لماذا {outcome === "فوز" ? "فزنا" : outcome === "خسارة" ? "خسرنا" : "انسحبنا"}؟)</label>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" } as any} value={reasons} onChange={(e) => setReasons(e.target.value)} /></div>
          <div><label style={lbl}>الدروس المستفادة {outcome === "خسارة" ? "* (الخسارة بلا درس خسارتان)" : "(اختياري)"}</label>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" } as any} value={lessons} onChange={(e) => setLessons(e.target.value)} /></div>
          <button style={{ ...btn, justifyContent: "center" }} disabled={closeM.isPending || !reasons.trim() || (outcome === "خسارة" && !lessons.trim()) || !!sessionMissing}
            onClick={() => closeM.mutate()}><Trophy size={14} /> {closeM.isPending ? "جارٍ الإغلاق…" : "إغلاق الملف"}</button>
          <p style={{ fontSize: 11.5, color: "#9ca3af", margin: 0, lineHeight: 1.8 }}>أسماء المنافسين تُسحب تلقائيًا من جلسة الفض وتُحفظ مع الدرس. {outcome === "فوز" && "التحويل إلى عقد نشط يأتي في المرحلة الخامسة."}</p>
        </div>
      </div>
    </div>
  );
}

export default function CaseFilePanel({ entityType, entityId }: { entityType: "tender" | "practice"; entityId: number }) {
  const { user } = useAuth();
  const qc = useQueryClient(); const { toast } = useToast();
  const positions = user?.positions ?? [];
  const isGM = user?.role === "admin" || positions.includes("general_manager");
  const isCFO = positions.includes("financial_manager");

  const { data: cf, isLoading } = useQuery({
    queryKey: ["case-file", entityType, entityId],
    queryFn: () => caseFilesApi.byEntity(entityType, entityId),
  });
  const { data: directory = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch<any[]>("/api/users/directory") });
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["suppliers-brief"],
    queryFn: () => apiFetch<any[]>("/api/suppliers").catch(() => []),
  });

  const [path, setPath] = useState<"فريق البحث" | "مصدر خاص">("فريق البحث");
  const [closing, setClosing] = useState(false);
  const [researcher, setResearcher] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const inv = () => qc.invalidateQueries({ queryKey: ["case-file", entityType, entityId] });
  const err = (e: any) => toast({ title: "تعذّر الإجراء", description: e.message, variant: "destructive" });

  const declareM = useMutation({
    mutationFn: () => caseFilesApi.declareSourcing({
      entityType, entityId, sourcingPath: path,
      researcherUserId: path === "فريق البحث" ? Number(researcher) : undefined,
      supplierId: path === "مصدر خاص" ? Number(supplierId) : undefined,
    }),
    onSuccess: () => { inv(); toast({ title: "✅ فُتح الملف وأُعلن مسار التوريد" }); },
    onError: err,
  });
  const submitM = useMutation({ mutationFn: () => caseFilesApi.submit(cf.id), onSuccess: () => { inv(); toast({ title: "قُدّم الملف للاعتماد" }); }, onError: err });
  const holdM = useMutation({
    mutationFn: (reason: string) => caseFilesApi.hold(cf.id, reason),
    onSuccess: () => { inv(); toast({ title: "⏸ أُوقف الملف ماليًا" }); }, onError: err,
  });
  const releaseM = useMutation({ mutationFn: () => caseFilesApi.releaseHold(cf.id), onSuccess: (r: any) => { inv(); toast({ title: r.override ? "رُفع الإيقاف بتجاوز المدير العام — مسجَّل" : "رُفع الإيقاف" }); }, onError: err });
  const approveM = useMutation({ mutationFn: () => caseFilesApi.approve(cf.id), onSuccess: (r: any) => { inv(); toast({ title: r.override ? "✅ اعتُمد بتجاوز إيقاف قائم — مسجَّل" : "✅ اعتُمد الملف" }); }, onError: err });
  const rejectM = useMutation({ mutationFn: (note: string) => caseFilesApi.reject(cf.id, note), onSuccess: () => { inv(); toast({ title: "رُفض الملف" }); }, onError: err });

  if (isLoading) return <div style={{ ...card, color: "#9ca3af", fontSize: 13 }}>جارٍ تحميل الملف…</div>;

  /* لا ملف بعد: بوابة إعلان مسار التوريد — وبطاقة الذاكرة تسبقها */
  if (!cf) {
    return (
      <div>
      <MemoryCard entityType={entityType} entityId={entityId} />
      <div style={{ ...card, borderRightWidth: 4, borderRightColor: G }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <FolderOpen size={16} color={GD} /> فتح ملف الحالة — إعلان مسار التوريد
        </div>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>بوابة إلزامية: من أين تأتي الأسعار والمواصفات؟ لا ملف بمصدر مجهول.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>المسار *</label>
            <select style={inp} value={path} onChange={(e) => setPath(e.target.value as any)}>
              <option value="فريق البحث">فريق البحث — أختار الباحث</option>
              <option value="مصدر خاص">مصدري الخاص — مورد مسجَّل</option>
            </select></div>
          {path === "فريق البحث" ? (
            <div><label style={lbl}>الباحث * (يتولد له تكليف مربوط بالملف)</label>
              <select style={inp} value={researcher} onChange={(e) => setResearcher(e.target.value)}>
                <option value="">— اختر —</option>
                {directory.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select></div>
          ) : (
            <div><label style={lbl}>المورد * (يظهر للمديرَين — شفافية)</label>
              <select style={inp} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— اختر من الموردين المسجلين —</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.status === "draft" ? " (مسودة)" : ""}</option>)}
              </select></div>
          )}
          <button style={{ ...btn, height: 38 }} disabled={declareM.isPending || (path === "فريق البحث" ? !researcher : !supplierId)}
            onClick={() => declareM.mutate()}><FolderOpen size={14} /> فتح الملف</button>
        </div>
      </div>
      </div>
    );
  }

  const active = ["مفتوح", "قيد العمل"].includes(cf.status);
  const held = cf.status === "موقوف ماليًا";
  const decided = ["معتمد", "مرفوض", "مغلق"].includes(cf.status);
  const isRaiser = cf.raisedBy === user?.id;

  return (
    <div>
      {closing && <CloseModal cf={cf} onClose={() => setClosing(false)} />}
      <MemoryCard entityType={entityType} entityId={entityId} />
      {/* رأس الملف */}
      <div style={{ ...card, borderRightWidth: 4, borderRightColor: held ? "#dc2626" : cf.status === "معتمد" ? "#16a34a" : G }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7 }}>
            <FolderOpen size={16} color={GD} /> ملف الحالة
            {cf.gmOverride && <span title="مرّ بتجاوز مسجَّل للمدير العام" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", borderRadius: 20, padding: "1px 9px" }}><ShieldAlert size={11} /> تجاوز مسجَّل</span>}
          </div>
          <StatusChip status={cf.status} />
        </div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 8, lineHeight: 2 }}>
          رفعه: <b style={{ color: GR }}>{cf.raisedByName ?? "—"}</b>
          {" · "}مسار التوريد: <b style={{ color: GD }}>{cf.sourcingPath ?? "غير مُعلَن"}</b>
          {cf.sourcingPath === "فريق البحث" && cf.researcherName && <> — الباحث: <b>{cf.researcherName}</b></>}
          {cf.sourcingPath === "مصدر خاص" && cf.ownSourceSupplierName && (
            <> — المورد: <b>{cf.ownSourceSupplierName}</b>{cf.ownSourceSupplierStatus === "draft" && <span style={{ color: "#b45309" }}> (ملفه غير مكتمل)</span>}</>
          )}
          {cf.decisionNote && <> · ملاحظة القرار: <b>{cf.decisionNote}</b></>}
          {cf.outcome && <> · النتيجة: <b style={{ color: cf.outcome === "فوز" ? "#16a34a" : cf.outcome === "خسارة" ? "#dc2626" : "#6b7280" }}>{cf.outcome}</b></>}
        </div>

        {held && (
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", fontSize: 12.5, color: "#991b1b" }}>
            <b>⏸ موقوف ماليًا</b> بواسطة {cf.heldByName} · {fmtDT(cf.heldAt)}<br />
            <b>السبب:</b> {cf.holdReason} — <span style={{ color: "#6b7280" }}>المطلوب: عالج السبب ثم اطلب رفع الإيقاف من المدير المالي.</span>
          </div>
        )}

        {/* الأزرار — كل زر لا يملكه المستخدم غير موجود (قاعدة الإخفاء) */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {active && (isRaiser || isGM) && (
            <button style={btn} disabled={submitM.isPending} onClick={() => submitM.mutate()}><Send size={13} /> تقديم للاعتماد</button>
          )}
          {!decided && !held && isCFO && !isRaiser && (
            <button style={{ ...btn, background: "#fff1f2", color: "#dc2626", border: "1px solid #fecaca" }}
              onClick={() => { const r = prompt("سبب الإيقاف المالي؟ (إلزامي — يظهر لمالك الملف)"); if (r?.trim()) holdM.mutate(r.trim()); }}>
              <PauseCircle size={13} /> إيقاف مالي</button>
          )}
          {held && (isCFO || isGM) && (
            <button style={{ ...btn, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }} disabled={releaseM.isPending}
              onClick={() => releaseM.mutate()}><PlayCircle size={13} /> رفع الإيقاف</button>
          )}
          {cf.status !== "مغلق" && !held && (isRaiser || isGM) && (
            <button style={{ ...btn, background: "white", color: GD, border: `1.5px solid ${G}66` }} onClick={() => setClosing(true)}>
              <Trophy size={13} /> إغلاق الملف (فوز/خسارة/انسحاب)</button>
          )}
          {!decided && isGM && (
            <>
              <button style={{ ...btn, background: "#16a34a" }} disabled={approveM.isPending}
                onClick={() => { if (!held || confirm("الملف موقوف ماليًا — الاعتماد الآن تجاوزٌ يُسجَّل باسمك. متابعة؟")) approveM.mutate(); }}>
                <CheckCircle2 size={13} /> اعتماد نهائي</button>
              <button style={{ ...btn, background: "white", color: "#dc2626", border: "1.5px solid #fecaca" }}
                onClick={() => { const n = prompt("سبب الرفض؟ (إلزامي — يعود به الملف لرافعه)"); if (n?.trim()) rejectM.mutate(n.trim()); }}>
                <XCircle size={13} /> رفض</button>
            </>
          )}
        </div>
      </div>

      {/* السيرة */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: GR, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <History size={15} color={GD} /> سيرة الملف
        </div>
        {(cf.events ?? []).length === 0 ? <div style={{ color: "#9ca3af", fontSize: 12.5 }}>لا أحداث بعد</div> :
          (cf.events ?? []).map((e: any) => (
            <div key={e.id} style={{ fontSize: 12.5, color: "#4b5563", padding: "5px 0", borderBottom: "1px dashed #f0ead8" }}>
              <b style={{ color: e.event.includes("إيقاف مالي") && !e.event.includes("رفع") ? "#dc2626" : e.event.includes("تجاوز") ? "#7c3aed" : e.event.includes("اعتماد") ? "#16a34a" : GR }}>{e.event}</b>
              {e.details && <span> — {e.details}</span>}
              <span style={{ color: "#9ca3af" }}> · {e.actorName ?? "؟"} · {fmtDT(e.createdAt)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
