import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Workflow, Zap, Clock, CheckCircle2, XCircle, Plus, Play, Pause } from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/automation")({
  head: () => ({
    meta: [
      { title: "Automation — ABANCOOL Command Center" },
      { name: "description", content: "Visual workflow automation engine" },
    ],
  }),
  component: AutomationPage,
});

const flows = [
  { name: "Invoice Renewal Reminder", trigger: "Invoice due in 7 days", actions: 3, runs: 1248, success: 97.8, status: "active" },
  { name: "Domain Expiry Alert", trigger: "Domain expires in 14 days", actions: 4, runs: 412, success: 100, status: "active" },
  { name: "Hosting Auto-Suspend", trigger: "Invoice overdue 7 days", actions: 2, runs: 18, success: 100, status: "active" },
  { name: "Nightly DB Backup", trigger: "Cron · 02:00 EAT", actions: 5, runs: 84, success: 98.8, status: "active" },
  { name: "Welcome Sequence", trigger: "New client signup", actions: 6, runs: 38, success: 100, status: "paused" },
];

function AutomationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="Workflows · 24 active"
        title="Automation"
        description="Visual workflow builder, triggers, cron jobs and integrations"
        actions={
          <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
            <Plus className="size-3.5" /> Create Flow
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Active Flows" value="24" delta="+3" icon={Workflow} />
        <StatTile label="Executions (24h)" value="3,182" delta="+12%" icon={Zap} tone="success" />
        <StatTile label="Success Rate" value="98.6%" icon={CheckCircle2} tone="success" />
        <StatTile label="Failed Runs" value="42" delta="needs review" icon={XCircle} tone="warning" />
      </div>

      {/* Visual workflow preview */}
      <Panel title="Featured Flow" subtitle="Invoice Renewal Reminder — visual graph">
        <div className="rounded-xl border border-border bg-secondary/20 p-6 grid-bg relative overflow-x-auto">
          <div className="flex items-center gap-3 min-w-max">
            <FlowNode icon={Clock} label="Trigger" sub="Cron · daily 09:00" tone="primary" />
            <FlowEdge />
            <FlowNode icon={Workflow} label="Filter" sub="Invoices due ≤ 7d" />
            <FlowEdge />
            <FlowNode icon={Zap} label="Send SMS" sub="Africa's Talking" />
            <FlowEdge />
            <FlowNode icon={Zap} label="Send WhatsApp" sub="Cloud API" />
            <FlowEdge />
            <FlowNode icon={CheckCircle2} label="Log Activity" sub="audit_log table" tone="success" />
          </div>
        </div>
      </Panel>

      <Panel title="All Workflows">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">Name</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Trigger</th>
                <th className="px-2 py-3 font-medium">Steps</th>
                <th className="px-2 py-3 font-medium">Runs</th>
                <th className="px-2 py-3 font-medium">Success</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f, i) => (
                <motion.tr
                  key={f.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/60 hover:bg-secondary/40"
                >
                  <td className="px-2 py-3 font-medium">{f.name}</td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground text-xs">{f.trigger}</td>
                  <td className="px-2 py-3 font-mono">{f.actions}</td>
                  <td className="px-2 py-3 font-mono">{f.runs}</td>
                  <td className="px-2 py-3">
                    <span className={f.success >= 99 ? "text-success" : "text-warning"}>{f.success}%</span>
                  </td>
                  <td className="px-2 py-3">
                    <Badge tone={f.status === "active" ? "success" : "neutral"}>{f.status}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <button className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground">
                      {f.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FlowNode({ icon: Icon, label, sub, tone = "neutral" }: { icon: React.ElementType; label: string; sub: string; tone?: "neutral" | "primary" | "success" }) {
  const toneCls = tone === "primary" ? "border-primary/40 bg-primary/10" : tone === "success" ? "border-success/40 bg-success/10" : "border-border bg-card";
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative rounded-xl border ${toneCls} px-4 py-3 min-w-[160px] shadow-[0_0_24px_-12px_oklch(0.72_0.18_235/0.6)]`}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1 font-mono">{sub}</div>
    </motion.div>
  );
}

function FlowEdge() {
  return (
    <div className="relative flex items-center w-12">
      <div className="w-full h-px bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
      <motion.span
        className="absolute size-1.5 rounded-full bg-primary glow-blue"
        animate={{ x: [0, 40, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
