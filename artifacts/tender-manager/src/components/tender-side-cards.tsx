import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tendersExtraApi, practicesExtraApi, apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Users, ShieldCheck, AlertTriangle } from "lucide-react";

/* ═══ بطاقتا المناقصة: الإسنادات الحقيقية + الكفالة الأولية — حزمة المناقصات ═══ */

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const inp: CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1.5px solid #e5dfc8", fontSize: 12.5, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const lbl: CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 };
const panel: CSSProperties = { background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", overflow: "hidden" };
const head: CSSProperties = { padding: "12px 18px", background: "#fdf8ec", borderBottom: "1.5px solid #f0ead8", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: GR };

const ROLES = ["المستشار المسؤول", "منسق مشتريات", "منسق مالي", "منسق نقل"] as const;

/** المسؤوليات الحقيقية: أدوار لأشخاص — تقود الرؤية («كل مسؤول يرى مالته») والإشعار والأحمال */
export function AssignmentsCard({ tenderId, entityType = "tender" }: { tenderId: number; entityType?: "tender" | "practice" }) {
  const xApi = entityType === "practice" ? practicesExtraApi : tendersExtraApi;
  const { user } = useAuth();
  const qc = useQueryClient(); const { toast } = useToast();
  const positions = user?.positions ?? [];
  const canManage = user?.role === "admin" || ["general_manager", "executive_manager", "financial_manager"].some((k) => positions.includes(k));
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["entity-assignments", entityType, tenderId], queryFn: () => xApi.assignments(tenderId) });
  const { data: directory = [] } = useQuery<any[]>({ queryKey: ["users-directory"], queryFn: () => apiFetch<any[]>("/api/users/directory") });
  const setM = useMutation({
    mutationFn: ({ role, userId }: { role: string; userId: number }) => xApi.assign(tenderId, role, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["entity-assignments", entityType, tenderId] }); toast({ title: "✅ أُسند الدور — وصل الإشعار لصاحبه" }); },
    onError: (e: any) => toast({ title: "تعذّر الإسناد", description: e.message, variant: "destructive" }),
  });
  const byRole = (r: string) => assignments.find((a) => a.role === r);
  return (
    <div style={panel}>
      <div style={head}><Users size={15} color={GD} /> المسؤوليات — كل مسؤول يرى مالته</div>
      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {ROLES.map((role) => {
          const cur = byRole(role);
          return (
            <div key={role}>
              <label style={lbl}>{role}</label>
              {canManage ? (
                <select style={inp} value={cur?.userId ?? ""} onChange={(e) => e.target.value && setM.mutate({ role, userId: Number(e.target.value) })}>
                  <option value="">— غير مسنَد —</option>
                  {directory.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              ) : (
                <div style={{ ...inp, background: "#faf8f2", border: "1px solid #f0ead8", color: cur ? GR : "#9ca3af", fontWeight: cur ? 700 : 400 }}>{cur?.userName ?? "غير مسنَد"}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "0 18px 12px", fontSize: 11, color: "#9ca3af", lineHeight: 1.7 }}>
        المسنَد يصله إشعار، ويظهر عمله في لوحة الأحمال، وقابل للنقل الموحّد. المستشار المسؤول يُسند تلقائيًا عند فتح الملف.
      </div>
    </div>
  );
}

/** الكفالة الأولية: التتبع + التسجيل في الضمانات البنكية + إنذار ≤٣ أيام */
export function BondCard({ tender, onChanged, entityType = "tender" }: { tender: any; onChanged: () => void; entityType?: "tender" | "practice" }) {
  const xApi = entityType === "practice" ? practicesExtraApi : tendersExtraApi;
  const { user } = useAuth();
  const { toast } = useToast();
  const [f, setF] = useState({ guaranteeNumber: "", bankName: "", issueDate: "", expiryDate: "" });
  const positions = user?.positions ?? [];
  const canIssue = user?.role === "admin" || ["general_manager", "executive_manager", "financial_manager"].some((k) => positions.includes(k)) || true; // الخادم يحسم (مدير أو مستشار مسؤول)
  const issued = !!tender.initialBondIssued;
  const daysLeft = tender.deadline ? Math.ceil((new Date(tender.deadline).getTime() - Date.now()) / 86400000) : null;
  const alert = !issued && tender.bondValue && daysLeft != null && daysLeft <= 3 && daysLeft >= -30;
  const issueM = useMutation({
    mutationFn: () => xApi.issueBond(tender.id, { guaranteeNumber: f.guaranteeNumber, bankName: f.bankName, issueDate: f.issueDate || undefined, expiryDate: f.expiryDate || undefined }),
    onSuccess: () => { onChanged(); toast({ title: "✅ سُجّلت الكفالة في الضمانات البنكية" }); },
    onError: (e: any) => toast({ title: "تعذّر التسجيل", description: e.message, variant: "destructive" }),
  });
  return (
    <div style={{ ...panel, borderColor: alert ? "#fecaca" : "#f0ead8" }}>
      <div style={{ ...head, background: alert ? "#fff1f2" : issued ? "#f0fdf4" : "#fdf8ec" }}>
        {alert ? <AlertTriangle size={15} color="#dc2626" /> : <ShieldCheck size={15} color={issued ? "#16a34a" : GD} />}
        الكفالة الأولية
        {issued && <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", borderRadius: 20, padding: "1px 10px" }}>صادرة ✓</span>}
        {alert && <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626" }}>⚠ لم تصدر والإغلاق بعد {daysLeft} يوم</span>}
      </div>
      <div style={{ padding: "14px 18px" }}>
        {issued ? (
          <div style={{ fontSize: 12.5, color: "#4b5563", lineHeight: 2 }}>
            رقمها: <b>{tender.initialBondNumber ?? "—"}</b> · البنك: <b>{tender.initialBondBank ?? "—"}</b> · أُصدرت: <b>{tender.initialBondIssueDate ?? "—"}</b>
            {tender.bondValue != null && <> · قيمتها: <b>{Number(tender.bondValue).toLocaleString()}</b> د.ك</>}
          </div>
        ) : canIssue ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={lbl}>رقم الكفالة *</label><input style={inp} value={f.guaranteeNumber} onChange={(e) => setF({ ...f, guaranteeNumber: e.target.value })} /></div>
            <div><label style={lbl}>البنك *</label><input style={inp} value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></div>
            <div><label style={lbl}>تاريخ الإصدار</label><input style={inp} type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} /></div>
            <div><label style={lbl}>انتهاؤها</label><input style={inp} type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} /></div>
            <button
              style={{ gridColumn: "1 / -1", padding: "9px 0", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}
              disabled={issueM.isPending || !f.guaranteeNumber.trim() || !f.bankName.trim()}
              onClick={() => issueM.mutate()}>
              {issueM.isPending ? "جارٍ التسجيل…" : "تسجيل الكفالة (تدخل الضمانات البنكية)"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "#9ca3af" }}>لم تصدر بعد</div>
        )}
      </div>
    </div>
  );
}
