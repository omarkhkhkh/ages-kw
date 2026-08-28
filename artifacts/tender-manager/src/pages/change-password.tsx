import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

const G = "#D4A534", GD = "#A87C20", GR = "#0b1a10";
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, outline: "none", fontFamily: "inherit", direction: "ltr" };

export function generatePassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(letters.toUpperCase()) + pick(digits) + pick(symbols);
  for (let i = 0; i < 9; i++) pw += pick(letters + digits);
  return pw;
}

/** شاشة تغيير كلمة المرور الإجباري — تظهر بعد إنشاء الحساب أو إعادة التعيين من الأدمن */
export default function ChangePasswordGate() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (next !== confirm) { setErr("تأكيد الكلمة لا يطابقها"); return; }
    setBusy(true);
    try {
      await apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      window.location.href = "/";
    } catch (e: any) {
      setErr(e.message || "تعذّر التغيير");
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${GR},#1e4028)`, fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", padding: 16 }}>
      <div style={{ width: "min(440px,100%)", background: "white", borderRadius: 20, padding: 28, boxShadow: "0 32px 80px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><KeyRound size={20} color={GD} /></div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: GR, margin: 0 }}>غيّر كلمة مرورك أولًا</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>مرحبًا {user?.fullName} — لأمان حسابك، الكلمة المؤقتة تُستبدل بكلمتك الخاصة</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 }}>الكلمة الحالية (المؤقتة) *</label>
            <input type="password" style={inp} value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 }}>الكلمة الجديدة *</label>
            <input type="password" style={inp} value={next} onChange={(e) => setNext(e.target.value)} />
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>8 أحرف فأكثر، وفيها حرف ورقم على الأقل</p></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: GR, marginBottom: 5 }}>تأكيد الكلمة الجديدة *</label>
            <input type="password" style={inp} value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
          {err && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#dc2626", background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px" }}>{err}</div>}
          <button disabled={busy || !current || !next || !confirm} onClick={submit}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${G},${GD})`, color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <ShieldCheck size={16} />} حفظ والدخول
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
