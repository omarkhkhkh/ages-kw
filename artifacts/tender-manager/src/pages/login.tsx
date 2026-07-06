import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "حدث خطأ. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
    }}>
      {/* ══ LEFT — Brand Panel ══ */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #0a1628 0%, #0f2347 50%, #1a3a6b 100%)",
      }}>
        {/* Decorative rings */}
        {[
          { top: 60, left: 60, size: 320, color: "rgba(245,158,11,0.12)" },
          { top: 100, left: 100, size: 220, color: "rgba(245,158,11,0.07)" },
          { bottom: 60, right: 40, size: 380, color: "rgba(59,130,246,0.10)" },
          { bottom: 100, right: 100, size: 240, color: "rgba(59,130,246,0.06)" },
        ].map((ring, i) => (
          <div key={i} style={{
            position: "absolute",
            width: ring.size,
            height: ring.size,
            borderRadius: "50%",
            border: `1px solid ${ring.color}`,
            top: ring.top,
            left: ring.left,
            bottom: (ring as any).bottom,
            right: (ring as any).right,
          }} />
        ))}
        {/* Glow blobs */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.18), transparent)",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.15), transparent)",
          filter: "blur(60px)",
        }} />

        {/* Brand content */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 60px", direction: "rtl" }}>
          {/* Logo icon */}
          <div style={{
            margin: "0 auto 28px",
            width: 96, height: 96,
            borderRadius: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            boxShadow: "0 20px 60px rgba(245,158,11,0.45)",
          }}>
            <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="8" width="36" height="32" rx="3" stroke="white" strokeWidth="2.5" fill="none"/>
              <line x1="13" y1="17" x2="35" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="13" y1="24" x2="35" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="13" y1="31" x2="25" y2="31" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="38" cy="36" r="7" fill="#f59e0b" stroke="white" strokeWidth="2"/>
              <path d="M35 36l2 2 4-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 style={{ fontSize: 38, fontWeight: 900, color: "white", margin: 0, lineHeight: 1.2 }}>
            المجموعة العربية
          </h1>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: "#f59e0b", margin: "4px 0 28px" }}>
            للخدمات التعلمية
          </h2>

          <div style={{
            width: 80, height: 1, margin: "0 auto 28px",
            background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.7), transparent)",
          }} />

          <p style={{ color: "#bfdbfe", fontSize: 18, fontWeight: 600, margin: 0 }}>
            نظام إدارة المناقصات والعقود
          </p>
          <p style={{ color: "rgba(147,197,253,0.45)", fontSize: 13, marginTop: 8 }}>
            الكويت — توقيت (UTC+3)
          </p>
        </div>

        <p style={{
          position: "absolute", bottom: 24,
          color: "rgba(147,197,253,0.25)", fontSize: 11, direction: "rtl"
        }}>
          © {new Date().getFullYear()} المجموعة العربية للخدمات التعلمية
        </p>
      </div>

      {/* ══ RIGHT — Login Form ══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f8fafc", padding: "48px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 380, direction: "rtl" }}>

          {/* Form card */}
          <div style={{
            background: "white",
            borderRadius: 20,
            boxShadow: "0 4px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.06)",
            padding: 36,
          }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", margin: 0 }}>
                تسجيل الدخول
              </h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                أدخل بياناتك للوصول إلى النظام
              </p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="on" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Username */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  اسم المستخدم
                </label>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم" required autoComplete="username"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    border: "1.5px solid #e2e8f0", borderRadius: 12,
                    padding: "12px 16px", fontSize: 14, color: "#1e293b",
                    background: "#f8fafc", outline: "none",
                    fontFamily: "inherit", direction: "rtl",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#f59e0b"; e.target.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.15)"; }}
                  onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  كلمة المرور
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور" required autoComplete="current-password"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      border: "1.5px solid #e2e8f0", borderRadius: 12,
                      padding: "12px 16px", paddingLeft: 44, fontSize: 14, color: "#1e293b",
                      background: "#f8fafc", outline: "none",
                      fontFamily: "inherit", direction: "rtl",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => { e.target.style.borderColor = "#f59e0b"; e.target.style.boxShadow = "0 0 0 3px rgba(245,158,11,0.15)"; }}
                    onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                  />
                  <button
                    type="button" onClick={() => setShowPass(v => !v)}
                    style={{
                      position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#94a3b8", display: "flex", padding: 0,
                    }}>
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 10, padding: "12px 16px",
                  color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>⚠</span> {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", padding: "14px 0",
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "white", fontWeight: 800, fontSize: 16,
                  border: "none", borderRadius: 12, cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 8px 24px rgba(245,158,11,0.4)",
                  opacity: loading ? 0.7 : 1,
                  transition: "opacity 0.15s, transform 0.1s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => !loading && ((e.target as any).style.transform = "translateY(-1px)")}
                onMouseLeave={e => ((e.target as any).style.transform = "translateY(0)")}
              >
                {loading
                  ? <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white", animation: "spin 0.8s linear infinite",
                      display: "inline-block",
                    }} />
                  : <><LogIn size={18} /> دخول</>
                }
              </button>
            </form>
          </div>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 20 }}>
            الكويت — توقيت AST (UTC+3)
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          [data-login-grid] { grid-template-columns: 1fr !important; }
          [data-login-brand] { display: none !important; }
        }
      `}</style>
    </div>
  );
}
