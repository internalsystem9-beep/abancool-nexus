import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users, UserPlus, Mail, Phone, Building2, Search, MoreHorizontal,
  TrendingUp, DollarSign, Activity, MessageSquare,
} from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/clients")({
  head: () => ({
    meta: [
      { title: "Clients — ABANCOOL Command Center" },
      { name: "description", content: "Enterprise CRM and customer intelligence" },
    ],
  }),
  component: ClientsPage,
});

const clients = [
  { name: "Safari Tours Ltd", company: "Tourism", email: "ops@safaritours.co.ke", phone: "+254 711 200 100", status: "active", mrr: 48500, projects: 3, tag: "VIP" },
  { name: "Kenya Tech Hub", company: "Technology", email: "admin@kenyatech.co.ke", phone: "+254 722 334 556", status: "active", mrr: 32000, projects: 5, tag: "Enterprise" },
  { name: "Mombasa Logistics", company: "Logistics", email: "billing@mombasalog.com", phone: "+254 733 778 990", status: "pending", mrr: 18200, projects: 1, tag: "Lead" },
  { name: "Nairobi Medical", company: "Healthcare", email: "it@nbimedical.co.ke", phone: "+254 700 112 233", status: "active", mrr: 64000, projects: 4, tag: "VIP" },
  { name: "Coast Realty", company: "Real Estate", email: "info@coastrealty.co.ke", phone: "+254 715 990 008", status: "churned", mrr: 0, projects: 0, tag: "Cold" },
  { name: "AgriCorp Kenya", company: "Agriculture", email: "tech@agricorp.ke", phone: "+254 720 445 667", status: "active", mrr: 22500, projects: 2, tag: "Standard" },
];

const stages = [
  { name: "Lead", count: 24, color: "oklch(0.62 0.02 250)" },
  { name: "Discovery", count: 12, color: "oklch(0.72 0.18 235)" },
  { name: "Proposal", count: 7, color: "oklch(0.78 0.16 75)" },
  { name: "Negotiation", count: 4, color: "oklch(0.78 0.20 230)" },
  { name: "Closed Won", count: 38, color: "oklch(0.72 0.18 155)" },
];

function ClientsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="CRM · 847 active"
        title="Clients"
        description="Enterprise customer intelligence, lifecycle and engagement"
        actions={
          <>
            <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm">
              <Search className="size-3.5 text-muted-foreground" />
              <input className="bg-transparent outline-none w-48 placeholder:text-muted-foreground text-sm" placeholder="Search clients…" />
            </div>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-glow text-sm font-medium flex items-center gap-2 glow-blue">
              <UserPlus className="size-3.5" /> Add Client
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Clients" value="847" delta="+38" hint="this month" icon={Users} />
        <StatTile label="MRR" value="KES 1.28M" delta="+12.4%" icon={DollarSign} tone="success" />
        <StatTile label="Active Deals" value="47" delta="9 closing" icon={TrendingUp} />
        <StatTile label="Churn Risk" value="6" delta="needs attention" icon={Activity} tone="warning" />
      </div>

      {/* Pipeline */}
      <Panel title="Pipeline" subtitle="Lead stage distribution">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stages.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative rounded-lg border border-border bg-secondary/40 p-3 overflow-hidden"
            >
              <div className="absolute top-0 left-0 h-full w-1" style={{ background: s.color }} />
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.name}</div>
              <div className="text-2xl font-bold mt-1">{s.count}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">deals</div>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel
        title="All Clients"
        subtitle="Search, filter and manage relationships"
        right={
          <div className="flex gap-2 text-xs">
            <Badge tone="primary">All</Badge>
            <Badge>Active</Badge>
            <Badge>Pending</Badge>
            <Badge>Churned</Badge>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="font-medium px-2 py-3">Client</th>
                <th className="font-medium px-2 py-3 hidden md:table-cell">Contact</th>
                <th className="font-medium px-2 py-3 hidden lg:table-cell">Industry</th>
                <th className="font-medium px-2 py-3">MRR</th>
                <th className="font-medium px-2 py-3 hidden md:table-cell">Projects</th>
                <th className="font-medium px-2 py-3">Status</th>
                <th className="font-medium px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <motion.tr
                  key={c.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/60 hover:bg-secondary/40 transition-colors"
                >
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary-glow/10 grid place-items-center text-primary text-xs font-bold border border-primary/20">
                        {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Building2 className="size-3" /> {c.company}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    <div className="flex items-center gap-1.5"><Mail className="size-3" /> {c.email}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><Phone className="size-3" /> {c.phone}</div>
                  </td>
                  <td className="px-2 py-3 hidden lg:table-cell">
                    <Badge>{c.tag}</Badge>
                  </td>
                  <td className="px-2 py-3 font-mono">KES {c.mrr.toLocaleString()}</td>
                  <td className="px-2 py-3 hidden md:table-cell">{c.projects}</td>
                  <td className="px-2 py-3">
                    <Badge tone={c.status === "active" ? "success" : c.status === "pending" ? "warning" : "destructive"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <button className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground">
                      <MoreHorizontal className="size-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>Showing 6 of 847 clients</span>
          <div className="flex gap-1">
            <button className="h-7 px-2.5 rounded border border-border hover:bg-secondary">Prev</button>
            <button className="h-7 px-2.5 rounded bg-primary text-primary-foreground">1</button>
            <button className="h-7 px-2.5 rounded border border-border hover:bg-secondary">2</button>
            <button className="h-7 px-2.5 rounded border border-border hover:bg-secondary">3</button>
            <button className="h-7 px-2.5 rounded border border-border hover:bg-secondary">Next</button>
          </div>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Recent Communications" subtitle="Email & WhatsApp threads">
          <div className="space-y-2">
            {[
              { who: "Safari Tours Ltd", chan: "WhatsApp", msg: "Backup restored successfully", t: "3m" },
              { who: "Kenya Tech Hub", chan: "Email", msg: "Renewal invoice attached", t: "1h" },
              { who: "Nairobi Medical", chan: "WhatsApp", msg: "VPS upgrade scheduled", t: "2h" },
              { who: "AgriCorp Kenya", chan: "Email", msg: "Domain transferred", t: "5h" },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/40">
                <div className={`size-8 rounded-md grid place-items-center ${m.chan === "WhatsApp" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                  {m.chan === "WhatsApp" ? <MessageSquare className="size-4" /> : <Mail className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.who}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.msg}</div>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">{m.t}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Top Revenue Clients" subtitle="Last 30 days">
          <div className="space-y-3">
            {[
              { name: "Nairobi Medical", rev: 184000, pct: 95 },
              { name: "Safari Tours Ltd", rev: 142000, pct: 78 },
              { name: "Kenya Tech Hub", rev: 96000, pct: 56 },
              { name: "AgriCorp Kenya", rev: 67500, pct: 38 },
            ].map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{c.name}</span>
                  <span className="font-mono text-muted-foreground">KES {c.rev.toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${c.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-primary to-primary-glow"
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
