import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Send, CheckCircle2, XCircle, Users, Megaphone, Plus, FileText } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/sms")({
  head: () => ({
    meta: [
      { title: "Bulk SMS — ABANCOOL Command Center" },
      { name: "description", content: "Enterprise SMS campaigns and delivery analytics" },
    ],
  }),
  component: SMSPage,
});

const data = Array.from({ length: 12 }).map((_, i) => ({
  m: `${i + 1}h`,
  sent: 2000 + Math.round(Math.sin(i / 2) * 1200 + Math.random() * 800),
  delivered: 1800 + Math.round(Math.sin(i / 2) * 1100 + Math.random() * 700),
}));

const campaigns = [
  { name: "Renewal Reminder · April", sent: 1248, delivered: 1219, failed: 29, rate: 97.7, status: "active", cost: 1872 },
  { name: "Easter Promo Blast", sent: 8420, delivered: 8198, failed: 222, rate: 97.4, status: "complete", cost: 12630 },
  { name: "VPS Maintenance Notice", sent: 412, delivered: 410, failed: 2, rate: 99.5, status: "complete", cost: 618 },
  { name: "Welcome Sequence", sent: 184, delivered: 182, failed: 2, rate: 98.9, status: "active", cost: 276 },
];

function SMSPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="ABANCOOL · Africa's Talking"
        title="Bulk SMS"
        description="Enterprise messaging campaigns, delivery reports and analytics"
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm flex items-center gap-2">
              <FileText className="size-3.5" /> Templates
            </button>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> New Campaign
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Sent (24h)" value="48,240" delta="+12%" icon={Send} />
        <StatTile label="Delivery Rate" value="97.8%" delta="industry avg 92%" icon={CheckCircle2} tone="success" />
        <StatTile label="Failed" value="1,062" delta="2.2%" icon={XCircle} tone="warning" />
        <StatTile label="Cost (MTD)" value="KES 72.4K" delta="-8%" icon={Megaphone} tone="success" />
      </div>

      <Panel title="Throughput" subtitle="Sent vs Delivered · last 12 hours">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="m" stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.09 0 0)", border: "1px solid oklch(0.72 0.18 235 / 0.4)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="sent" stroke="oklch(0.72 0.18 235)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="delivered" stroke="oklch(0.72 0.18 155)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Campaigns" subtitle="Active and recent SMS blasts">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">Campaign</th>
                <th className="px-2 py-3 font-medium">Sent</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Delivered</th>
                <th className="px-2 py-3 font-medium">Rate</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Cost</th>
                <th className="px-2 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <motion.tr
                  key={c.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/60 hover:bg-secondary/40"
                >
                  <td className="px-2 py-3 font-medium">{c.name}</td>
                  <td className="px-2 py-3 font-mono">{c.sent.toLocaleString()}</td>
                  <td className="px-2 py-3 hidden md:table-cell font-mono text-success">{c.delivered.toLocaleString()}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2 w-24">
                      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-success" style={{ width: `${c.rate}%` }} />
                      </div>
                      <span className="text-[11px] font-mono">{c.rate}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell font-mono">KES {c.cost.toLocaleString()}</td>
                  <td className="px-2 py-3">
                    <Badge tone={c.status === "active" ? "primary" : "success"}>{c.status}</Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Sender IDs" subtitle="Approved with operators">
          {["ABANCOOL", "SAFARITOURS", "KTHCLOUD", "NBIMEDICAL"].map((s) => (
            <div key={s} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="size-2 rounded-full bg-success animate-pulse" /> {s}
              </div>
              <Badge tone="success">approved</Badge>
            </div>
          ))}
        </Panel>
        <Panel title="Contact Groups">
          {[
            { n: "All Customers", c: 847 },
            { n: "Hosting Clients", c: 542 },
            { n: "VIP", c: 36 },
            { n: "Trial Users", c: 122 },
          ].map((g) => (
            <div key={g.n} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
              <div className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-primary" /> {g.n}
              </div>
              <span className="text-xs font-mono text-muted-foreground">{g.c}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
