import { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { Eye, EyeOff, LogIn } from "lucide-react";
import logoImg from "@/assets/logo.png";

// Brand colours extracted from the logo
const GOLD       = "#D4A534";
const GOLD_LIGHT = "#E8BE55";
const GOLD_DARK  = "#A87C20";
const GREEN_DARK  = "#0b1a10";
const GREEN_MID   = "#132a18";
const GREEN_LIGHT = "#1e4028";

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
    <div id="login-grid" style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
    }}>

      {/* ══ LEFT — Brand Panel ══ */}
      <div id="login-brand" style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, ${GREEN_DARK} 0%, ${GREEN_MID} 55%, ${GREEN_LIGHT} 100%)`,
      }}>

        {/* Decorative rings — gold tones */}
        {[
          { top: 40,  left: 40,  size: 340, opacity: 0.18 },
          { top: 90,  left: 90,  size: 220, opacity: 0.10 },
          { bottom: 50, right: 30,  size: 400, opacity: 0.14 },
          { bottom: 110, right: 110, size: 240, opacity: 0.08 },
        ].map((r, i) => (
          <div key={i} style={{
            position: "absolute",
            width: r.size, height: r.size,
            borderRadius: "50%",
            border: `1px solid rgba(212,165,52,${r.opacity})`,
            top: (r as any).top, left: (r as any).left,
            bottom: (r as any).bottom, right: (r as any).right,
          }} />
        ))}

        {/* Glow blobs */}
        <div style={{
          position: "absolute", top: -60, left: -60,
          width: 420, height: 420, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,165,52,0.22), transparent 70%)`,
          filter: "blur(55px)",
        }} />
        <div style={{
          position: "absolute", bottom: -60, right: -60,
          width: 380, height: 380, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(30,64,40,0.9), transparent 70%)`,
          filter: "blur(55px)",
        }} />

        {/* Brand content */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 56px", direction: "rtl" }}>

          {/* Logo — floating card */}
          <div style={{
            margin: "0 auto 28px",
            background: "rgba(255,255,255,0.96)",
            borderRadius: 24,
            padding: "22px 36px",
            boxShadow: `0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,165,52,0.25)`,
            display: "inline-block",
          }}>
            <img
              src={logoImg}
              alt="Arabian Group Logo"
              style={{ width: 210, display: "block", objectFit: "contain" }}
            />
          </div>

          {/* Gold divider */}
          <div style={{
            width: 72, height: 2, margin: "0 auto 24px",
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            borderRadius: 2,
          }} />

          <p style={{ color: GOLD_LIGHT, fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: 0.3 }}>
            نظام إدارة المناقصات والعقود
          </p>
        </div>

        {/* Footer */}
        <p style={{
          position: "absolute", bottom: 22,
          color: `rgba(212,165,52,0.28)`, fontSize: 11, direction: "rtl",
        }}>
          © {new Date().getFullYear()} المجموعة العربية للخدمات التعلمية
        </p>
      </div>

      {/* ══ RIGHT — Login Form ══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f7f5ef",   /* warm parchment — echoes the gold */
        padding: "48px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 380, direction: "rtl" }}>

          {/* Mobile logo (hidden on desktop via media query) */}
          <div id="login-mobile-logo" style={{ textAlign: "center", marginBottom: 28 }}>
            <img
              src={logoImg}
              alt="Arabian Group Logo"
              style={{ width: 160, objectFit: "contain", margin: "0 auto 6px", display: "block" }}
            />
            <p style={{ color: "#7a6a40", fontSize: 13, margin: 0 }}>نظام إدارة المناقصات والعقود</p>
          </div>

          {/* Form card */}
          <div style={{
            background: "white",
            borderRadius: 22,
            boxShadow: `0 6px 48px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)`,
            border: `1.5px solid rgba(212,165,52,0.18)`,
            padding: 36,
          }}>
            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              {/* Gold accent bar */}
              <div style={{
                width: 36, height: 4, borderRadius: 2,
                background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
                marginBottom: 14,
              }} />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: GREEN_MID, margin: 0 }}>
                تسجيل الدخول
              </h2>
              <p style={{ color: "#8a8070", fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                أدخل بياناتك للوصول إلى النظام
              </p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="on" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Username */}
              <div>
                <label htmlFor="login-username" style={{
                  display: "block", fontSize: 13, fontWeight: 700,
                  color: GREEN_MID, marginBottom: 6,
                }}>
                  اسم المستخدم
                </label>
                <input
                  id="login-username"
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم" required autoComplete="username"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    border: "1.5px solid #e8e0cc", borderRadius: 12,
                    padding: "12px 16px", fontSize: 14, color: "#1e2a1e",
                    background: "#fdfbf6", outline: "none",
                    fontFamily: "inherit", direction: "rtl",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = GOLD;
                    e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.18)`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = "#e8e0cc";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" style={{
                  display: "block", fontSize: 13, fontWeight: 700,
                  color: GREEN_MID, marginBottom: 6,
                }}>
                  كلمة المرور
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور" required autoComplete="current-password"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      border: "1.5px solid #e8e0cc", borderRadius: 12,
                      padding: "12px 16px", paddingLeft: 44, fontSize: 14, color: "#1e2a1e",
                      background: "#fdfbf6", outline: "none",
                      fontFamily: "inherit", direction: "rtl",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = GOLD;
                      e.target.style.boxShadow = `0 0 0 3px rgba(212,165,52,0.18)`;
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = "#e8e0cc";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button" onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    style={{
                      position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#a89060", display: "flex", padding: 0,
                    }}>
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "#fff8f0", border: `1px solid rgba(212,165,52,0.4)`,
                  borderRadius: 10, padding: "12px 16px",
                  color: "#8a4500", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>⚠</span> {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", padding: "14px 0",
                  background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
                  color: "white", fontWeight: 800, fontSize: 16,
                  border: "none", borderRadius: 12,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: `0 8px 28px rgba(212,165,52,0.45)`,
                  opacity: loading ? 0.7 : 1,
                  transition: "opacity 0.15s, transform 0.1s, box-shadow 0.15s",
                  fontFamily: "inherit",
                  letterSpacing: 0.5,
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 36px rgba(212,165,52,0.55)`;
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px rgba(212,165,52,0.45)`;
                }}
              >
                {loading
                  ? <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.35)",
                      borderTopColor: "white", animation: "spin 0.8s linear infinite",
                      display: "inline-block",
                    }} />
                  : <><LogIn size={18} /> دخول</>
                }
              </button>
            </form>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          #login-grid { grid-template-columns: 1fr !important; }
          #login-brand { display: none !important; }
        }
        @media (min-width: 769px) {
          #login-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}
