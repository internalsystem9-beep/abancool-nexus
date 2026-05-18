import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Server, ShieldCheck, HardDrive, Activity, AlertTriangle,
  Database, Cloud, Plus,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/hosting")({
  head: () => ({
    meta: [
      { title: "Hosting — ABANCOOL Command Center" },
      { name: "description", content: "cPanel accounts, packages, SSL and resource monitoring" },
    ],
  }),
  component: HostingPage,
});

const trafficData = Array.from({ length: 14 }).map((_, i) => ({
  d: `D${i + 1}`,
  gb: Math.round(220 + Math.sin(i / 2) * 90 + Math.random() * 60),
}));

const accounts = [
  { domain: "safaritours.co.ke", pkg: "Business Pro", disk: 78, bw: 64, ssl: "valid", status: "online", expiry: "12d" },
  { domain: "kenyatech.co.ke", pkg: "Enterprise", disk: 42, bw: 31, ssl: "valid", status: "online", expiry: "48d" },
  { domain: "mombasalog.com", pkg: "Starter", disk: 92, bw: 88, ssl: "expiring", status: "online", expiry: "4d" },
  { domain: "nbimedical.co.ke", pkg: "Enterprise", disk: 56, bw: 42, ssl: "valid", status: "online", expiry: "90d" },
  { domain: "coastrealty.co.ke", pkg: "Business", disk: 18, bw: 12, ssl: "expired", status: "suspended", expiry: "—" },
  { domain: "agricorp.ke", pkg: "Business Pro", disk: 64, bw: 51, ssl: "valid", status: "online", expiry: "23d" },
];

function HostingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="WHMCS · 4 servers"
        title="Hosting"
        description="cPanel account management, SSL, backups and resource health"
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm">Sync WHM</button>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> New Account
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Accounts" value="1,256" delta="+24" icon={Server} />
        <StatTile label="Online" value="1,248" delta="99.4%" icon={Activity} tone="success" />
        <StatTile label="SSL Valid" value="1,201" delta="14 expiring" icon={ShieldCheck} tone="success" />
        <StatTile label="Disk Used" value="3.4 TB" delta="62% of pool" icon={HardDrive} />
        <StatTile label="Suspended" value="8" delta="action needed" icon={AlertTriangle} tone="warning" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Bandwidth" subtitle="Cluster-wide · 14 days" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="d" stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.09 0 0)", border: "1px solid oklch(0.72 0.18 235 / 0.4)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="gb" stroke="oklch(0.72 0.18 235)" strokeWidth={2.5} fill="url(#bw)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Server Health">
          {[
            { name: "node-01", load: 0.42, ok: true },
            { name: "node-02", load: 0.68, ok: true },
            { name: "node-03", load: 0.91, ok: false },
            { name: "node-04", load: 0.34, ok: true },
          ].map((s) => (
            <div key={s.name} className="py-2.5 border-b border-border/60 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <Database className={`size-4 ${s.ok ? "text-success" : "text-destructive"}`} />
                  {s.name}
                </div>
                <span className={`text-xs font-mono ${s.ok ? "text-success" : "text-destructive"}`}>
                  {(s.load * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.load * 100}%` }}
                  className={`h-full ${s.ok ? "bg-gradient-to-r from-primary to-primary-glow" : "bg-destructive"}`}
                />
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="cPanel Accounts" subtitle="Disk · Bandwidth · SSL · Expiry">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">Domain</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Package</th>
                <th className="px-2 py-3 font-medium">Disk</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Bandwidth</th>
                <th className="px-2 py-3 font-medium">SSL</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <motion.tr
                  key={a.domain}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/60 hover:bg-secondary/40"
                >
                  <td className="px-2 py-3 font-medium flex items-center gap-2">
                    <Cloud className="size-4 text-primary" /> {a.domain}
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground">{a.pkg}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2 w-24">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full ${a.disk > 85 ? "bg-destructive" : a.disk > 70 ? "bg-warning" : "bg-primary"}`} style={{ width: `${a.disk}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">{a.disk}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell">
                    <span className="text-xs font-mono">{a.bw}%</span>
                  </td>
                  <td className="px-2 py-3">
                    <Badge tone={a.ssl === "valid" ? "success" : a.ssl === "expiring" ? "warning" : "destructive"}>
                      {a.ssl}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <Badge tone={a.status === "online" ? "success" : "destructive"}>{a.status}</Badge>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs">{a.expiry}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
