import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";

/* ── palette (always dark on login, never changes with theme) ── */
const P = {
  bg:       "#0f172a",
  bgCard:   "#1e293b",
  border:   "#334155",
  borderHi: "#475569",
  text:     "#f8fafc",
  textDim:  "#cbd5e1",
  textMute: "#94a3b8",
  textFade: "#64748b",
  strip:    ["#f8fafc", "#cbd5e1", "#94a3b8", "#64748b", "#475569"],
};

const loginSchema = z.object({
  email:    z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});
type LoginForm = z.infer<typeof loginSchema>;

const DEMO = [
  { role: "IT Employee",  email: "employee@mavericks.com", password: "Employee@123!" },
  { role: "IT Manager",   email: "manager@mavericks.com",  password: "Manager@123!" },
  { role: "System Admin", email: "admin@mavericks.com",    password: "Admin@123!" },
  { role: "L2 Authority", email: "l2@mavericks.com",       password: "L2Auth@123!" },
];

/* ── tiny bottom-border input ─────────────────────────────────── */
function LineInput({
  type,
  placeholder,
  registration,
  rightSlot,
}: {
  type: string;
  placeholder: string;
  registration: object;
  rightSlot?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={type}
        placeholder={placeholder}
        {...registration}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: "block",
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${focused ? P.text : P.borderHi}`,
          color: P.text,
          fontSize: "14px",
          padding: "10px 28px 10px 0",
          outline: "none",
          transition: "border-color 0.2s",
        }}
      />
      {rightSlot && (
        <div style={{ position: "absolute", right: 0, bottom: "8px" }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setError(null);
    try {
      const user = await login(data.email, data.password);
      navigate(
        user.role === ROLES.USER || user.role === ROLES.EXECUTIVE
          ? "/my-assets"
          : "/dashboard"
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "Invalid credentials. Please try again.");
    }
  }

  function fill(email: string, password: string) {
    setValue("email", email);
    setValue("password", password);
    setError(null);
  }

  return (
    <div
      style={{
        background: P.bg,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle warm grain */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: `1px solid ${P.border}`,
        }}
      >
        <span style={{ color: P.text, letterSpacing: "0.18em", fontSize: "13px", fontWeight: 700 }}>
          MVX
        </span>
        <span style={{ color: P.textFade, letterSpacing: "0.14em", fontSize: "11px" }}>
          ASSET INTELLIGENCE SYSTEM
        </span>
        <span style={{ color: P.textFade, letterSpacing: "0.1em", fontSize: "11px" }}>
          v2.0
        </span>
      </div>

      {/* ── Main ────────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex" }}>

        {/* LEFT — editorial typography (desktop only) */}
        <div
          style={{
            display: "none",
            width: "55%",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 64px 48px",
            borderRight: `1px solid ${P.border}`,
          }}
          className="lg:flex! lg:flex-col"
        >
          {/* Big verbs */}
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            {(["TRACK", "VERIFY", "RENEW"] as const).map((word, i) => (
              <div key={word}>
                <div
                  style={{
                    fontSize: "clamp(52px, 7.5vw, 100px)",
                    fontWeight: 800,
                    letterSpacing: "-0.025em",
                    lineHeight: 0.95,
                    color: i === 0 ? P.text : i === 1 ? P.textDim : P.textMute,
                  }}
                >
                  {word}
                </div>
                {i < 2 && (
                  <div
                    style={{
                      height: "1px",
                      margin: "14px 0",
                      background: `linear-gradient(90deg, ${P.borderHi} 0%, transparent 55%)`,
                    }}
                  />
                )}
              </div>
            ))}

            {/* Tag line */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.38, duration: 0.6 }}
              style={{
                color: P.textFade,
                marginTop: "44px",
                fontSize: "15px",
                lineHeight: 1.9,
                maxWidth: "300px",
              }}
            >
              Every device. Every license.<br />
              Every renewal. Accounted for.
            </motion.p>

            {/* 5-color palette strip */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ transformOrigin: "left" }}
              transition={{ delay: 0.55, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 flex"
              aria-hidden
            >
              {P.strip.map((c) => (
                <div key={c} style={{ flex: 1, height: "3px", background: c }} />
              ))}
            </motion.div>
          </motion.div>

          {/* Bottom mini-stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            style={{ display: "flex", gap: "40px" }}
          >
            {[
              { n: "AI",   label: "Audit Engine" },
              { n: "90d",  label: "Renewal Cycle" },
              { n: "5",    label: "Access Roles"  },
            ].map(({ n, label }) => (
              <div key={label}>
                <div style={{ color: P.text, fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}>{n}</div>
                <div style={{ color: P.textMute, fontSize: "11px", letterSpacing: "0.12em", marginTop: "3px" }}>{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — form */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 32px",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: "100%", maxWidth: "360px" }}
          >
            {/* Form header */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ color: P.textFade, fontSize: "11px", letterSpacing: "0.22em", marginBottom: "10px" }}>
                CREDENTIAL VERIFICATION
              </div>
              <div style={{ height: "1px", background: P.border }} />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    marginBottom: "20px",
                    padding: "9px 12px",
                    background: "rgba(127,29,29,0.25)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#f87171",
                    fontSize: "13px",
                    borderRadius: "3px",
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Email */}
              <div style={{ marginBottom: "28px" }}>
                <label style={{ color: P.textMute, fontSize: "11px", letterSpacing: "0.2em", display: "block", marginBottom: "6px" }}>
                  EMAIL ADDRESS
                </label>
                <LineInput
                  type="email"
                  placeholder="you@company.com"
                  registration={register("email")}
                />
                {errors.email && (
                  <p style={{ color: "#f87171", fontSize: "12px", marginTop: "5px" }}>{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div style={{ marginBottom: "36px" }}>
                <label style={{ color: P.textMute, fontSize: "11px", letterSpacing: "0.2em", display: "block", marginBottom: "6px" }}>
                  PASSPHRASE
                </label>
                <LineInput
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  registration={register("password")}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      style={{ background: "none", border: "none", color: P.textFade, cursor: "pointer", padding: 0, lineHeight: 1 }}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />
                {errors.password && (
                  <p style={{ color: "#f87171", fontSize: "12px", marginTop: "5px" }}>{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={!isSubmitting ? { backgroundColor: P.text, color: P.bg } : {}}
                whileTap={!isSubmitting ? { scale: 0.97 } : {}}
                transition={{ duration: 0.12 }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                  border: `1px solid ${P.borderHi}`,
                  color: P.text,
                  fontSize: "12px",
                  letterSpacing: "0.22em",
                  padding: "15px 20px",
                  cursor: isSubmitting ? "default" : "pointer",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                <span>{isSubmitting ? "AUTHENTICATING…" : "AUTHENTICATE"}</span>
                {isSubmitting
                  ? <Loader2 size={15} className="mvx-spin" />
                  : <ArrowRight size={15} />
                }
              </motion.button>
            </form>

            {/* Quick access */}
            <div style={{ marginTop: "40px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "12px",
              }}>
                <span style={{ color: P.textFade, fontSize: "11px", letterSpacing: "0.2em" }}>QUICK ACCESS</span>
                <div style={{ flex: 1, height: "1px", background: P.border }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {DEMO.map((d, i) => (
                  <motion.button
                    key={d.email}
                    type="button"
                    onClick={() => fill(d.email, d.password)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i, duration: 0.28 }}
                    whileHover={{ borderColor: P.textDim }}
                    style={{
                      background: "transparent",
                      border: `1px solid ${P.borderHi}`,
                      color: P.textMute,
                      fontSize: "12px",
                      letterSpacing: "0.06em",
                      padding: "11px 13px",
                      textAlign: "left",
                      cursor: "pointer",
                      lineHeight: 1.4,
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: P.textDim }}>{d.role}</div>
                    <div style={{ color: P.textFade, fontSize: "11px", marginTop: "4px", letterSpacing: "0.04em" }}>
                      {d.email.split("@")[0]}
                    </div>
                  </motion.button>
                ))}
              </div>

              <p style={{ color: P.borderHi, fontSize: "11px", marginTop: "12px", letterSpacing: "0.06em" }}>
                Click a role to pre-fill, then authenticate
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Bottom strip ────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 32px",
          borderTop: `1px solid ${P.border}`,
        }}
      >
        <span style={{ color: P.borderHi, fontSize: "11px", letterSpacing: "0.15em" }}>
          © 2026 MAVERICKS TECHNOLOGIES
        </span>
        {/* Palette dots */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }} aria-hidden>
          {P.strip.map((c) => (
            <div key={c} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c }} />
          ))}
        </div>
        <span style={{ color: P.borderHi, fontSize: "11px", letterSpacing: "0.15em" }}>
          SECURE ACCESS
        </span>
      </div>
    </div>
  );
}
