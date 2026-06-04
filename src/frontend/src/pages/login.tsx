import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { ROLES } from "@/lib/constants";
import { CursorGlow } from "@/components/cursor-glow";

/* ─────────────────────────────────────────────────────────────────
   Obsidian login — deep slate, warm amber accent.
   Self-contained palette (independent of app theme switcher)
   so the login experience is consistent for all roles.
───────────────────────────────────────────────────────────────── */
const C = {
  bg:        "#0b0d12",
  bgDeeper:  "#070810",
  surface:   "#11141c",
  surfaceHi: "#181c26",
  border:    "#1f2532",
  borderHi:  "#2a3142",
  text:      "#f4f5f7",
  textDim:   "#c8ccd6",
  textMute:  "#8a91a1",
  textFade:  "#5a6072",
  accent:    "#f5a623",
  accentDim: "#c98a1c",
  danger:    "#f87171",
};

const loginSchema = z.object({
  email:    z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof loginSchema>;

const DEMO = [
  { role: "IT Employee",  name: "John Developer",       email: "employee@mavericks.com", password: "Employee@123!" },
  { role: "Executive",    name: "Executive User",       email: "exec@mavericks.com",     password: "Exec@123!"     },
  { role: "IT Manager",   name: "Inventory Manager",    email: "manager@mavericks.com",  password: "Manager@123!"  },
  { role: "L2 Authority", name: "Management Authority", email: "l2@mavericks.com",       password: "L2Auth@123!"   },
  { role: "System Admin", name: "System Administrator", email: "admin@mavericks.com",    password: "Admin@123!"    },
];

/* ─── Form field ─────────────────────────────────────────────── */
function Field({
  label,
  type,
  placeholder,
  registration,
  error,
  rightSlot,
  autoComplete,
}: {
  label: string;
  type: string;
  placeholder: string;
  registration: object;
  error?: string;
  rightSlot?: React.ReactNode;
  autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label
        style={{
          display: "block",
          color: focused ? C.text : C.textMute,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          marginBottom: 8,
          transition: "color 200ms",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...registration}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            display: "block",
            width: "100%",
            background: C.surface,
            color: C.text,
            fontSize: 14,
            padding: "13px 44px 13px 14px",
            border: `1px solid ${error ? C.danger : focused ? C.accent : C.border}`,
            borderRadius: 8,
            outline: "none",
            transition: "border-color 180ms, box-shadow 180ms, background 180ms",
            boxShadow: focused
              ? `0 0 0 3px ${C.accent}22, inset 0 1px 0 0 ${C.borderHi}40`
              : "inset 0 1px 0 0 #00000040",
          }}
        />
        {rightSlot && (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: focused ? C.text : C.textMute,
            }}
          >
            {rightSlot}
          </div>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              color: C.danger,
              fontSize: 12,
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <AlertCircle size={12} />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
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
      setError(e?.response?.data?.message ?? "Invalid credentials. Please check your email and password.");
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
        background: C.bg,
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Cursor-trailing amber glow (desktop only) */}
      <CursorGlow color={C.accent} size={520} opacity={0.22} />

      {/* ── Ambient background (radial glows + grain) ───────── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(900px 600px at 12% 18%, ${C.accent}10, transparent 60%),
            radial-gradient(700px 500px at 92% 84%, #3b82f615, transparent 65%),
            radial-gradient(circle at 50% 50%, ${C.bg} 0%, ${C.bgDeeper} 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="mvx-drift"
        style={{
          position: "absolute",
          top: "-15%",
          left: "-10%",
          width: 520,
          height: 520,
          background: `radial-gradient(circle, ${C.accent}14 0%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        className="mvx-drift"
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "-8%",
          width: 460,
          height: 460,
          background: `radial-gradient(circle, #3b82f618 0%, transparent 70%)`,
          filter: "blur(45px)",
          animationDelay: "8s",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
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
          padding: "20px 32px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo />
          <span
            style={{
              color: C.text,
              letterSpacing: "0.16em",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            MAVERICKS
          </span>
          <span
            style={{
              color: C.textFade,
              fontSize: 11,
              letterSpacing: "0.1em",
              marginLeft: 4,
            }}
          >
            INVENTORY
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span
            style={{
              color: C.textMute,
              fontSize: 11,
              letterSpacing: "0.16em",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              className="mvx-pulse-soft"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            SYSTEMS NOMINAL
          </span>
          <span style={{ color: C.textFade, fontSize: 11, letterSpacing: "0.12em" }}>
            v2.0
          </span>
        </div>
      </div>

      {/* ── Main two-column ────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr",
        }}
        className="lg:!grid-cols-[1.1fr_1fr]"
      >
        {/* LEFT — editorial brand panel (desktop only) */}
        <div
          className="hidden lg:flex"
          style={{
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 72px 56px",
            borderRight: `1px solid ${C.border}`,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
                background: `${C.accent}10`,
                border: `1px solid ${C.accent}40`,
                borderRadius: 999,
                color: C.accent,
                fontSize: 11,
                letterSpacing: "0.14em",
                fontWeight: 600,
                marginBottom: 36,
              }}
            >
              <Sparkles size={12} />
              ASSET INTELLIGENCE PLATFORM
            </div>

            <h1
              className="numeral-display"
              style={{
                fontSize: "clamp(48px, 6.8vw, 92px)",
                fontWeight: 700,
                lineHeight: 0.98,
                letterSpacing: "-0.035em",
                color: C.text,
                margin: 0,
              }}
            >
              The single source <br />
              of truth for every <br />
              <span style={{ color: C.accent }}>asset.</span>
            </h1>

            <p
              style={{
                color: C.textMute,
                marginTop: 32,
                fontSize: 15,
                lineHeight: 1.7,
                maxWidth: 460,
              }}
            >
              Track devices, licenses, and inventory across every team. Approve, audit,
              and renew with confidence — backed by AI-driven anomaly detection.
            </p>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ transformOrigin: "left" }}
              transition={{ delay: 0.45, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12 flex h-[3px] overflow-hidden rounded-full"
              aria-hidden
            >
              <div style={{ flex: 1, background: C.text }} />
              <div style={{ flex: 1, background: C.textDim }} />
              <div style={{ flex: 1, background: C.textMute }} />
              <div style={{ flex: 1, background: C.accent }} />
              <div style={{ flex: 1, background: C.accentDim }} />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.55 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 40,
              borderTop: `1px solid ${C.border}`,
              paddingTop: 28,
            }}
          >
            {[
              { n: "AI",  label: "AUDIT ENGINE" },
              { n: "90d", label: "RENEWAL CYCLE" },
              { n: "5",   label: "ROLE TIERS" },
            ].map(({ n, label }) => (
              <div key={label}>
                <div
                  className="numeral-display"
                  style={{
                    color: C.text,
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    color: C.textFade,
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    fontWeight: 600,
                    marginTop: 6,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — sign-in card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: "100%",
              maxWidth: 420,
              background: `linear-gradient(180deg, ${C.surface}f5 0%, ${C.surface}e8 100%)`,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "36px 32px",
              boxShadow:
                "0 24px 60px -12px rgba(0, 0, 0, 0.6), 0 8px 18px -6px rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(12px) saturate(140%)",
            }}
          >
            {/* Mobile logo */}
            <div className="lg:hidden" style={{ marginBottom: 24 }}>
              <Logo size={32} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <h2
                style={{
                  color: C.text,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Welcome back
              </h2>
              <p
                style={{
                  color: C.textMute,
                  fontSize: 13,
                  marginTop: 8,
                  lineHeight: 1.55,
                }}
              >
                Sign in to access your inventory workspace.
              </p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 18 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    style={{
                      padding: "11px 14px",
                      background: "#f8717118",
                      border: `1px solid ${C.danger}44`,
                      color: C.danger,
                      fontSize: 13,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 9,
                    }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 18 }}>
              <Field
                label="Email"
                type="email"
                placeholder="you@company.com"
                registration={register("email")}
                error={errors.email?.message}
                autoComplete="email"
              />

              <Field
                label="Password"
                type={showPw ? "text" : "password"}
                placeholder="Enter your password"
                registration={register("password")}
                error={errors.password?.message}
                autoComplete="current-password"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      color: "inherit",
                    }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={!isSubmitting ? { y: -1 } : {}}
                whileTap={!isSubmitting ? { scale: 0.985 } : {}}
                transition={{ duration: 0.12 }}
                style={{
                  marginTop: 4,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: isSubmitting
                    ? `${C.accent}cc`
                    : `linear-gradient(180deg, ${C.accent} 0%, ${C.accentDim} 100%)`,
                  border: `1px solid ${C.accent}`,
                  color: "#1a1208",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  padding: "13px 20px",
                  borderRadius: 9,
                  cursor: isSubmitting ? "default" : "pointer",
                  boxShadow: `0 6px 18px -4px ${C.accent}55`,
                  opacity: isSubmitting ? 0.85 : 1,
                  transition: "background 160ms, box-shadow 160ms",
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="mvx-spin" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={15} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "26px 0 16px",
              }}
            >
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span
                style={{
                  color: C.textFade,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                }}
              >
                QUICK ACCESS
              </span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {DEMO.map((d, i) => (
                <motion.button
                  key={d.email}
                  type="button"
                  onClick={() => fill(d.email, d.password)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + 0.06 * i, duration: 0.3 }}
                  whileHover={{ borderColor: C.accent, backgroundColor: C.surfaceHi }}
                  whileTap={{ scale: 0.97 }}
                  // Last card spans both columns when the count is odd (5 roles)
                  style={{
                    gridColumn:
                      i === DEMO.length - 1 && DEMO.length % 2 === 1
                        ? "1 / -1"
                        : undefined,
                    background: C.bgDeeper,
                    border: `1px solid ${C.border}`,
                    color: C.textDim,
                    fontSize: 12,
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: 8,
                    transition: "border-color 160ms, background 160ms",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: C.text,
                      fontSize: 12,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {d.role}
                  </div>
                  <div
                    style={{
                      color: C.textFade,
                      fontSize: 10.5,
                      marginTop: 3,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {d.name} · {d.email.split("@")[0]}
                  </div>
                </motion.button>
              ))}
            </div>

            <p
              style={{
                color: C.textFade,
                fontSize: 11,
                marginTop: 14,
                textAlign: "center",
              }}
            >
              Click a role to pre-fill credentials, then sign in.
            </p>
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
          padding: "14px 32px",
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <span
          style={{
            color: C.textFade,
            fontSize: 11,
            letterSpacing: "0.12em",
          }}
        >
          © 2026 MAVERICKS TECHNOLOGIES
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: C.textMute,
            fontSize: 11,
            letterSpacing: "0.12em",
          }}
        >
          <ShieldCheck size={12} />
          ENCRYPTED · SOC 2 READY
        </div>
      </div>
    </div>
  );
}

/* ─── Logo mark ──────────────────────────────────────────────── */
function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="7" fill={C.accent} />
      <path
        d="M9 22V10l7 8 7-8v12"
        stroke="#1a1208"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
