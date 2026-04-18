import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role",  data.role);
        if (data.role === "admin")          navigate("/admin");
        else if (data.role === "patient")   navigate("/patient");
        else if (data.role === "clinician") navigate("/clinician");
        else                                navigate("/");
      } else {
        setError(data.msg || "Invalid email or password.");
      }
    } catch {
      setError("Cannot reach the server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.logo}>
            <span style={styles.logoDot} />
            <span style={styles.logoText}>Arinze</span>
          </div>
          <h1 style={styles.heroTitle}>Smarter hospital management, all in one place.</h1>
          <p style={styles.heroSub}>
            Arinze Health Systems gives administrators, clinicians, and patients a unified platform to manage admissions, track care, and handle billing.
          </p>
        </div>

        <div style={{ ...styles.circle, width: 340, height: 340, top: -80, right: -120, opacity: 0.08 }} />
        <div style={{ ...styles.circle, width: 200, height: 200, bottom: 60, right: 20, opacity: 0.06 }} />
      </div>

      <div style={styles.right}>
        <form style={styles.card} onSubmit={handleLogin}>
          <div style={styles.cardLogo}>
            <span style={styles.cardLogoDot} />
            <span style={styles.cardLogoText}>Arinze</span>
          </div>

          <h2 style={styles.formTitle}>Welcome back</h2>
          <p style={styles.formSub}>Sign in to your account to continue</p>

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              autoFocus
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? (
              <span style={styles.spinner} />
            ) : (
              "Sign in"
            )}
          </button>

          <div style={styles.roleHints}>
            <p style={styles.hintTitle}>Quick access</p>
            <div style={styles.hintGrid}>
              {[
                { role: "Admin",     email: "admin@arinze.com",         password: "admin2026",  color: "#7c3aed" },
                { role: "Clinician", email: "almeta.carter@arinze.com", password: "almeta2026", color: "#0891b2" },
                { role: "Patient",   email: "abel.dooley@gmail.com",    password: "abel2026",   color: "#059669" },
              ].map((h) => (
                <button
                  key={h.role}
                  type="button"
                  style={{ ...styles.hintChip, borderColor: h.color, color: h.color }}
                  onClick={() => { setEmail(h.email); setPassword(h.password); setError(""); }}
                >
                  <span style={{ ...styles.hintDot, background: h.color }} />
                  {h.role}
                </button>
              ))}
            </div>
          </div>
        </form>

        <p style={styles.footer}>© 2026 Arinze Health Systems</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', sans-serif",
  },

  left: {
    flex: 1,
    background: "linear-gradient(145deg, #1a56db 0%, #1e3a8a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 48px",
    position: "relative",
    overflow: "hidden",
  },
  leftInner: {
    position: "relative",
    zIndex: 1,
    maxWidth: 440,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 48,
  },
  logoDot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#60a5fa",
    display: "inline-block",
  },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "0.02em",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.25,
    margin: "0 0 16px",
  },
  heroSub: {
    fontSize: 15,
    color: "#bfdbfe",
    lineHeight: 1.7,
    margin: 0,
  },
  circle: {
    position: "absolute",
    borderRadius: "50%",
    background: "#fff",
    pointerEvents: "none",
  },

  right: {
    width: 480,
    minWidth: 380,
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 32px",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "36px 32px",
    width: "100%",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    border: "1px solid #e5e7eb",
    boxSizing: "border-box",
  },
  cardLogo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
  },
  cardLogoDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#1a56db",
    display: "inline-block",
  },
  cardLogoText: {
    fontSize: 17,
    fontWeight: 800,
    color: "#1a56db",
    letterSpacing: "0.02em",
  },
  formTitle: {
    margin: "0 0 6px",
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },
  formSub: {
    margin: "0 0 24px",
    fontSize: 14,
    color: "#6b7280",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#991b1b",
    marginBottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  errorIcon: { fontSize: 15 },
  fieldGroup: {
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    padding: "11px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 9,
    fontSize: 14,
    color: "#111827",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  btn: {
    width: "100%",
    padding: "12px",
    marginTop: 8,
    background: "#1a56db",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    transition: "background 0.15s",
  },
  spinner: {
    width: 18,
    height: 18,
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },

  roleHints: {
    marginTop: 28,
    paddingTop: 20,
    borderTop: "1px solid #f3f4f6",
  },
  hintTitle: {
    margin: "0 0 10px",
    fontSize: 12,
    fontWeight: 700,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  hintGrid: {
    display: "flex",
    gap: 8,
  },
  hintChip: {
    flex: 1,
    padding: "8px 6px",
    border: "1.5px solid",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "opacity 0.15s",
  },
  hintDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    color: "#9ca3af",
  },
};
