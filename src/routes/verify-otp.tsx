import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, ArrowRight, RefreshCw, Mail } from "lucide-react";
import { api, setToken } from "@/lib/api";
import { z } from "zod";

const search = z.object({
  email: z.string().email().optional().catch(undefined),
  ttl: z.number().optional().catch(undefined),
  dev: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (s: Record<string, unknown>) => search.parse(s),
  head: () => ({
    meta: [{ title: "Verify Code — ABANCOOL Command Center" }],
  }),
  component: VerifyOtpPage,
});

const LENGTH = 6;

function VerifyOtpPage() {
  const navigate = useNavigate();
  const { email = "", ttl = 600, dev } = useSearch({ from: "/verify-otp" });
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(ttl);
  const [cooldown, setCooldown] = useState(60);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const t = setInterval(() => setRemaining((s: number) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s: number) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < LENGTH - 1) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(""));
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(LENGTH).fill("").map((_, i) => text[i] || "");
    setDigits(next);
    if (next.every(Boolean)) submit(next.join(""));
    else refs.current[Math.min(text.length, LENGTH - 1)]?.focus();
  }

  async function submit(code: string) {
    if (!email) { setError("Missing email — return to sign in"); return; }
    setBusy(true); setError(null);
    try {
      const { token, user } = await api.verifyOtp(email, code);
      setToken(token);
      localStorage.setItem("abancool.user", JSON.stringify(user));
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setError(e.message || "Verification failed");
      setDigits(Array(LENGTH).fill(""));
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!email || cooldown > 0) return;
    setError(null);
    try {
      const r = await api.resendOtp(email);
      setRemaining(r.ttlSeconds);
      setCooldown(60);
    } catch (e: any) {
      setError(e.message || "Could not resend");
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="relative min-h-screen w-full overflow-hidden grid-bg">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/20 blur-[120px] animate-float-slow" />
        <div className="absolute bottom-0 right-0 size-[28rem] rounded-full bg-primary-glow/15 blur-[140px]" />
      </div>

      <div className="relative z-10 min-h-screen grid place-items-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex size-11 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-[0_0_40px_-4px_oklch(0.72_0.18_235/0.7)]">
              <Zap className="size-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-[0.18em] text-primary text-glow font-mono">ABANCOOL</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">Two-Factor Verification</p>
          </div>

          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <Mail className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Enter security code</h2>
                <p className="text-xs text-muted-foreground">
                  We sent a {LENGTH}-digit code to <span className="text-foreground font-medium">{email || "your email"}</span>
                </p>
              </div>
            </div>

            {dev && (
              <div className="mb-4 text-xs font-mono text-warning border border-warning/30 bg-warning/10 rounded-md px-3 py-2">
                DEV: code is <span className="font-bold">{dev}</span>
              </div>
            )}

            <div className="grid grid-cols-6 gap-2" onPaste={onPaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  disabled={busy}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                  }}
                  className="h-14 text-center text-xl font-bold font-mono rounded-md bg-secondary/60 border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition"
                />
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Code expires in <span className="text-foreground font-mono">{mm}:{ss}</span>
              </div>
              <button
                onClick={resend}
                disabled={cooldown > 0 || busy}
                className="flex items-center gap-1.5 text-primary hover:text-primary-glow disabled:text-muted-foreground transition"
              >
                <RefreshCw className="size-3.5" />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>

            <button
              onClick={() => submit(digits.join(""))}
              disabled={busy || digits.some((d) => !d)}
              className="mt-6 group w-full h-12 rounded-md bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-semibold tracking-wide shadow-[0_0_30px_-6px_oklch(0.72_0.18_235/0.7)] hover:shadow-[0_0_40px_-4px_oklch(0.72_0.18_235/0.9)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {busy ? "Verifying…" : "Verify & Continue"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground justify-center">
              <ShieldCheck className="size-3.5 text-primary" />
              Hashed · Single-use · Rate-limited · Audited
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Wrong account? <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
