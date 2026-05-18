import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LifeBuoy, Clock, CheckCircle2, AlertOctagon, Plus, MessageSquare } from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/support")({
  head: () => ({
    meta: [
      { title: "Support — ABANCOOL Command Center" },
      { name: "description", content: "Enterprise helpdesk, tickets and SLA management" },
    ],
  }),
  component: SupportPage,
});

const tickets = [
  { id: "#1248", subject: "SSL renewal failed for safaritours.co.ke", client: "Safari Tours", priority: "high", dept: "Hosting", sla: "1h 22m", agent: "John N.", status: "open" },
  { id: "#1247", subject: "WHM cPanel password reset request", client: "Kenya Tech Hub", priority: "med", dept: "Hosting", sla: "4h", agent: "Kate A.", status: "pending" },
  { id: "#1246", subject: "M-Pesa STK push timing out intermittently", client: "Nairobi Medical", priority: "high", dept: "Billing", sla: "OVERDUE", agent: "Moses O.", status: "open" },
  { id: "#1245", subject: "Add new sub-domain blog.agricorp.ke", client: "AgriCorp Kenya", priority: "low", dept: "DNS", sla: "11h", agent: "Lily K.", status: "open" },
  { id: "#1244", subject: "Bulk SMS template approval", client: "Mombasa Logistics", priority: "med", dept: "Messaging", sla: "—", agent: "John N.", status: "resolved" },
];

function SupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="SLA Tier · Enterprise"
        title="Support Desk"
        description="Tickets, SLA timers, escalation and customer satisfaction"
        actions={
          <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
            <Plus className="size-3.5" /> New Ticket
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Open" value="23" delta="+5 today" icon={LifeBuoy} />
        <StatTile label="Avg Resolution" value="3h 18m" delta="-22m" icon={Clock} tone="success" />
        <StatTile label="CSAT" value="94%" delta="+2pt" icon={CheckCircle2} tone="success" />
        <StatTile label="SLA Breached" value="2" delta="needs escalation" icon={AlertOctagon} tone="destructive" />
      </div>

      <div className="grid lg:grid-cols-4 gap-3">
        {[
          { l: "All", c: 184, active: true },
          { l: "Open", c: 23 },
          { l: "Pending", c: 12 },
          { l: "Resolved", c: 149 },
        ].map((b) => (
          <button key={b.l} className={`glass rounded-xl px-4 py-3 text-left transition ${b.active ? "ring-1 ring-primary/40" : ""}`}>
            <div className="text-xs text-muted-foreground">{b.l}</div>
            <div className="text-2xl font-bold mt-1">{b.c}</div>
          </button>
        ))}
      </div>

      <Panel title="Ticket Queue">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">ID</th>
                <th className="px-2 py-3 font-medium">Subject</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Client</th>
                <th className="px-2 py-3 font-medium">Priority</th>
                <th className="px-2 py-3 font-medium hidden lg:table-cell">Dept</th>
                <th className="px-2 py-3 font-medium">SLA</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Agent</th>
                <th className="px-2 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/60 hover:bg-secondary/40 cursor-pointer"
                >
                  <td className="px-2 py-3 font-mono text-xs text-primary">{t.id}</td>
                  <td className="px-2 py-3 font-medium max-w-xs truncate">{t.subject}</td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground">{t.client}</td>
                  <td className="px-2 py-3">
                    <Badge tone={t.priority === "high" ? "destructive" : t.priority === "med" ? "warning" : "neutral"}>
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 hidden lg:table-cell">
                    <Badge tone="primary">{t.dept}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <span className={`text-xs font-mono ${t.sla === "OVERDUE" ? "text-destructive" : t.sla.includes("h") && parseInt(t.sla) < 2 ? "text-warning" : "text-muted-foreground"}`}>
                      {t.sla}
                    </span>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground text-xs">{t.agent}</td>
                  <td className="px-2 py-3">
                    <Badge tone={t.status === "open" ? "primary" : t.status === "pending" ? "warning" : "success"}>{t.status}</Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Agent Performance" subtitle="Last 30 days">
          {[
            { n: "John N.", res: 84, csat: 96 },
            { n: "Kate A.", res: 72, csat: 94 },
            { n: "Moses O.", res: 68, csat: 91 },
            { n: "Lily K.", res: 51, csat: 98 },
          ].map((a) => (
            <div key={a.n} className="py-2.5 border-b border-border/60 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{a.n}</span>
                <span className="text-xs text-muted-foreground"><span className="font-mono">{a.res}</span> resolved · <span className="text-success font-mono">{a.csat}%</span> CSAT</span>
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${a.csat}%` }} />
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="Recent Activity">
          {[
            { who: "John N.", what: "resolved #1244", t: "5m" },
            { who: "Kate A.", what: "replied to #1247", t: "18m" },
            { who: "Moses O.", what: "escalated #1246", t: "1h" },
            { who: "Lily K.", what: "created #1245", t: "2h" },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
              <MessageSquare className="size-4 text-primary" />
              <div className="flex-1 text-sm">
                <span className="font-medium">{a.who}</span>
                <span className="text-muted-foreground"> {a.what}</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">{a.t}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
