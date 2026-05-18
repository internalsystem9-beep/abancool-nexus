import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plug, KeyRound, Webhook, Activity, CheckCircle2, Plus } from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — ABANCOOL Command Center" },
      { name: "description", content: "API keys, webhooks and 3rd-party connections" },
    ],
  }),
  component: IntegrationsPage,
});

const integrations = [
  { name: "Safaricom Daraja", category: "Payments", status: "connected", calls: 12842, color: "oklch(0.72 0.18 155)" },
  { name: "IntaSend", category: "Payments", status: "connected", calls: 4218, color: "oklch(0.72 0.18 235)" },
  { name: "Paystack", category: "Payments", status: "connected", calls: 1862, color: "oklch(0.78 0.16 75)" },
  { name: "Stripe", category: "Payments", status: "connected", calls: 412, color: "oklch(0.78 0.20 230)" },
  { name: "Africa's Talking", category: "Messaging", status: "connected", calls: 48240, color: "oklch(0.65 0.22 25)" },
  { name: "Twilio", category: "Messaging", status: "available", calls: 0, color: "oklch(0.65 0.22 25)" },
  { name: "WhatsApp Cloud API", category: "Messaging", status: "connected", calls: 12420, color: "oklch(0.72 0.18 155)" },
  { name: "cPanel / WHM", category: "Hosting", status: "connected", calls: 8420, color: "oklch(0.72 0.18 235)" },
  { name: "WHMCS", category: "Hosting", status: "connected", calls: 2840, color: "oklch(0.78 0.20 230)" },
  { name: "Cloudflare", category: "Infrastructure", status: "connected", calls: 18420, color: "oklch(0.78 0.16 75)" },
  { name: "GitHub", category: "DevOps", status: "connected", calls: 642, color: "oklch(0.45 0 0)" },
  { name: "Google Workspace", category: "Productivity", status: "available", calls: 0, color: "oklch(0.62 0.20 250)" },
];

const webhooks = [
  { url: "https://abancool.tech/api/webhooks/daraja", event: "payment.completed", last: "2m", status: 200 },
  { url: "https://abancool.tech/api/webhooks/intasend", event: "payment.created", last: "8m", status: 200 },
  { url: "https://abancool.tech/api/webhooks/github", event: "push", last: "14m", status: 200 },
  { url: "https://abancool.tech/api/webhooks/cloudflare", event: "zone.updated", last: "2h", status: 500 },
];

function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="API Hub · 9 connected"
        title="Integrations"
        description="API keys, webhooks and third-party service connections"
        actions={
          <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
            <Plus className="size-3.5" /> Add Integration
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Connected" value="9 / 12" icon={Plug} tone="success" />
        <StatTile label="API Calls (24h)" value="108K" delta="+14%" icon={Activity} />
        <StatTile label="Active Webhooks" value="18" delta="all healthy" icon={Webhook} tone="success" />
        <StatTile label="API Keys" value="42" delta="2 expiring" icon={KeyRound} tone="warning" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {integrations.map((it, i) => (
          <motion.div
            key={it.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ y: -3, boxShadow: "0 0 24px -6px oklch(0.72 0.18 235 / 0.5)" }}
            className="glass rounded-2xl p-4 relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="size-10 rounded-lg grid place-items-center text-primary-foreground font-bold" style={{ background: it.color }}>
                {it.name[0]}
              </div>
              {it.status === "connected" ? (
                <Badge tone="success"><CheckCircle2 className="size-3" /> live</Badge>
              ) : (
                <Badge>available</Badge>
              )}
            </div>
            <div className="mt-3 font-semibold text-sm">{it.name}</div>
            <div className="text-[11px] text-muted-foreground">{it.category}</div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Calls (24h)</span>
              <span className="font-mono text-primary">{it.calls.toLocaleString()}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <Panel title="Webhooks" subtitle="Outgoing event delivery">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">URL</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Event</th>
                <th className="px-2 py-3 font-medium">Last</th>
                <th className="px-2 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w, i) => (
                <tr key={i} className="border-b border-border/60 hover:bg-secondary/40">
                  <td className="px-2 py-3 font-mono text-xs truncate max-w-xs">{w.url}</td>
                  <td className="px-2 py-3 hidden md:table-cell"><Badge tone="primary">{w.event}</Badge></td>
                  <td className="px-2 py-3 text-muted-foreground text-xs">{w.last} ago</td>
                  <td className="px-2 py-3">
                    <Badge tone={w.status === 200 ? "success" : "destructive"}>HTTP {w.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
