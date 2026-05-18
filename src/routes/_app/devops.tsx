import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Terminal, GitBranch, Container, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/devops")({
  head: () => ({
    meta: [
      { title: "DevOps — ABANCOOL Command Center" },
      { name: "description", content: "CI/CD, Docker, deployments and observability" },
    ],
  }),
  component: DevOpsPage,
});

const metrics = Array.from({ length: 40 }).map((_, i) => ({
  t: i,
  rps: 200 + Math.round(Math.sin(i / 3) * 80 + Math.random() * 40),
  err: Math.round(Math.random() * 5),
}));

const builds = [
  { id: "#4218", branch: "main", commit: "8f3a2c1", msg: "fix: ssl renewal hook timeout", status: "success", t: "3m", dur: "1m 42s" },
  { id: "#4217", branch: "feat/billing-v2", commit: "a1d92b4", msg: "wip: paystack webhook handler", status: "success", t: "12m", dur: "2m 08s" },
  { id: "#4216", branch: "main", commit: "ff21c89", msg: "chore: bump deps", status: "success", t: "1h", dur: "1m 51s" },
  { id: "#4215", branch: "hotfix/dns", commit: "7c3e0aa", msg: "fix: cloudflare api 429 retry", status: "failed", t: "2h", dur: "0m 38s" },
  { id: "#4214", branch: "main", commit: "33d8eef", msg: "feat: vault audit logs", status: "success", t: "4h", dur: "2m 14s" },
];

function DevOpsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="GitHub Actions · Docker"
        title="DevOps Center"
        description="CI/CD pipelines, container orchestration and live observability"
        actions={
          <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
            <Terminal className="size-3.5" /> Open Shell
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Deployments (24h)" value="42" delta="+8" icon={GitBranch} />
        <StatTile label="Containers" value="86" delta="all healthy" icon={Container} tone="success" />
        <StatTile label="Avg Response" value="84ms" delta="-12ms" icon={Activity} tone="success" />
        <StatTile label="Failed Cron" value="3" delta="last 24h" icon={AlertCircle} tone="warning" />
      </div>

      <Panel title="Request Rate & Errors" subtitle="Live · last 40 minutes">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="t" stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.09 0 0)", border: "1px solid oklch(0.72 0.18 235 / 0.4)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="rps" stroke="oklch(0.72 0.18 235)" strokeWidth={2} dot={false} name="req/s" />
              <Line type="monotone" dataKey="err" stroke="oklch(0.65 0.22 25)" strokeWidth={2} dot={false} name="err/s" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="CI/CD Pipeline" subtitle="Latest builds">
        <div className="space-y-2">
          {builds.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50"
            >
              <div className={`size-9 rounded-md grid place-items-center ${b.status === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {b.status === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-primary">{b.id}</span>
                  <Badge>{b.branch}</Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">{b.commit}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{b.msg}</div>
              </div>
              <div className="text-right text-[11px]">
                <div className="font-mono">{b.dur}</div>
                <div className="text-muted-foreground">{b.t} ago</div>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel title="Live Logs" subtitle="abancool-api · production">
        <div className="rounded-lg bg-black/60 border border-border p-4 font-mono text-[12px] leading-relaxed overflow-x-auto">
          {[
            ["INFO ", "GET  /api/v1/clients 200 42ms", "text-success"],
            ["INFO ", "POST /api/v1/auth/login 200 128ms", "text-success"],
            ["INFO ", "POST /api/v1/payments/stk 200 412ms", "text-success"],
            ["WARN ", "Slow query: SELECT * FROM invoices (1.2s)", "text-warning"],
            ["INFO ", "GET  /api/v1/hosting 200 38ms", "text-success"],
            ["ERROR", "Cloudflare API 429 - retry in 4s", "text-destructive"],
            ["INFO ", "POST /api/v1/sms/dispatch 200 78ms", "text-success"],
          ].map(([level, msg, color], i) => (
            <div key={i} className={color}>
              <span className="text-muted-foreground">[15:42:{18 + i}]</span> <span className="font-bold">{level}</span> {msg}
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2 text-success"><span className="size-1.5 rounded-full bg-success animate-pulse" /> streaming…</div>
        </div>
      </Panel>
    </div>
  );
}
