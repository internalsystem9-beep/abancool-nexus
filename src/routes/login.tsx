import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — ABANCOOL Command Center" },
      { name: "description", content: "Secure access to the ABANCOOL Command Center." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden grid-bg">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/20 blur-[120px] animate-float-slow" />
        <div className="absolute bottom-0 right-0 size-[28rem] rounded-full bg-primary-glow/15 blur-[140px]" />
        <div className="absolute top-1/3 right-1/4 size-64 rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="relative z-10 min-h-screen grid place-items-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <div className="size-11 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-[0_0_40px_-4px_oklch(0.72_0.18_235/0.7)]">
                <Zap className="size-6 text-primary-foreground" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-[0.18em] text-primary text-glow font-mono">
              ABANCOOL
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Command Center
            </p>
          </div>

          {/* Card */}
          <div className="glass rounded-2xl p-6 shadow-[var(--shadow-elevated)] relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

            {/* Tabs */}
            <div className="relative grid grid-cols-2 gap-1 p-1 rounded-lg bg-secondary/50 mb-6">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="relative py-2.5 text-sm font-semibold rounded-md transition-colors"
                >
                  {mode === m && (
                    <motion.span
                      layoutId="auth-tab"
                      className="absolute inset-0 rounded-md bg-primary shadow-[0_0_20px_-4px_oklch(0.72_0.18_235/0.7)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className={`relative ${mode === m ? "text-primary-foreground" : "text-muted-foreground"}`}>
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <h2 className="text-2xl font-bold">
                {mode === "signin" ? "Welcome Back" : "Get Started"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "signin"
                  ? "Sign in to your secure command center"
                  : "Provision your enterprise workspace"}
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate({ to: "/dashboard" });
                }}
                className="mt-6 space-y-4"
              >
                {mode === "signup" && (
                  <Field icon={<ShieldCheck className="size-4" />} type="text" placeholder="Full name" />
                )}
                <Field icon={<Mail className="size-4" />} type="email" placeholder="you@abancool.tech" defaultValue="admin@abancool.tech" />
                <Field icon={<Lock className="size-4" />} type="password" placeholder="••••••••••" defaultValue="password" />

                {mode === "signin" && (
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                      <input type="checkbox" className="accent-primary" /> Remember me
                    </label>
                    <a href="#" className="text-primary hover:text-primary-glow transition">Forgot password?</a>
                  </div>
                )}

                <button
                  type="submit"
                  className="group w-full h-12 rounded-md bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-semibold tracking-wide shadow-[0_0_30px_-6px_oklch(0.72_0.18_235/0.7)] hover:shadow-[0_0_40px_-4px_oklch(0.72_0.18_235/0.9)] transition-all flex items-center justify-center gap-2"
                >
                  {mode === "signin" ? "Sign In" : "Create Account"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>

              <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground justify-center">
                <ShieldCheck className="size-3.5 text-primary" />
                Protected by AES-256 · 2FA Ready · SOC 2 aligned
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © 2026 ABANCOOL Technology · <Link to="/dashboard" className="text-primary hover:underline">Skip to demo</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Field({
  icon, ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
      <input
        {...props}
        className="w-full h-12 rounded-md bg-secondary/60 border border-border pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/25 focus:bg-secondary/80 transition"
      />
    </div>
  );
}
