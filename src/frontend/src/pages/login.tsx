import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Brain, Loader2, Zap, Shield, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  {
    label: "System Admin",
    email: "admin@mavericks.com",
    password: "Admin@123!",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30",
  },
  {
    label: "Executive",
    email: "exec@mavericks.com",
    password: "Exec@123!",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30",
  },
  {
    label: "Manager L1",
    email: "manager@mavericks.com",
    password: "Manager@123!",
    color: "bg-teal-500/20 text-teal-400 border-teal-500/30 hover:bg-teal-500/30",
  },
  {
    label: "L2 Authority",
    email: "l2@mavericks.com",
    password: "L2Auth@123!",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setError(null);
    try {
      await login(data.email, data.password);
      navigate("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(
        e?.response?.data?.message ?? "Invalid credentials. Please try again."
      );
    }
  }

  function fillDemo(email: string, password: string) {
    setValue("email", email);
    setValue("password", password);
    setError(null);
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900/50 p-12 lg:flex lg:w-1/2">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Mavericks AI</span>
          </div>
        </div>

        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold leading-tight text-white">
              Autonomous
              <br />
              Inventory
              <br />
              <span className="text-teal-400">Intelligence</span>
            </h1>
            <p className="mt-4 text-slate-300">
              AI-powered inventory management with self-healing data, intelligent approvals, and real-time anomaly detection.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {[
              { icon: Zap, title: "AI Self-Healing Uploads", desc: "Automatically corrects data errors during bulk uploads" },
              { icon: Shield, title: "Intelligent Approval Workflows", desc: "Risk-scored approvals with AI recommendations" },
              { icon: BarChart3, title: "Anomaly Detection", desc: "Real-time detection of stock irregularities and patterns" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20">
                  <Icon className="h-4 w-4 text-teal-400" />
                </div>
                <div>
                  <div className="font-medium text-white">{title}</div>
                  <div className="text-sm text-slate-400">{desc}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="text-sm text-slate-500">
          Powered by{" "}
          <span className="font-semibold text-teal-400">Hexaware Technologies</span>
          {" "}· Built for Mavericks Challenge
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-[hsl(var(--background))] p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Mavericks AI</span>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-[hsl(var(--foreground))]">Welcome back</h2>
            <p className="mt-2 text-[hsl(var(--muted-foreground))]">
              Sign in to your inventory account
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="space-y-3">
            <p className="text-center text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Quick access — demo accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account.email, account.password)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${account.color}`}
                >
                  {account.label}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
              Click a role above to fill credentials, then sign in
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
