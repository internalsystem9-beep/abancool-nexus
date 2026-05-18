import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Cpu, HardDrive, Activity, Terminal, Plus, Network } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/vps")({
  head: () => ({
    meta: [
      { title: "VPS — ABANCOOL Command Center" },
      { name: "description", content: "VPS infrastructure, monitoring, SSH and deployments" },
    ],
  }),
  component: VPSPage,
});

const cpuData = Array.from({ length: 30 }).map((_, i) => ({
  t: i,
  c: 25 + Math.round(Math.sin(i / 3) * 20 + Math.random() * 15),
  r: 40 + Math.round(Math.cos(i / 4) * 15 + Math.random() * 10),
}));

const servers = [
  { name: "node-01.abancool", ip: "159.65.42.18", os: "Ubuntu 22.04", cpu: 42, ram: 68, disk: 54, status: "online", up: "187d" },
  { name: "node-02.abancool", ip: "159.65.42.19", os: "Ubuntu 22.04", cpu: 78, ram: 81, disk: 62, status: "online", up: "187d" },
  { name: "node-03.abancool", ip: "159.65.42.20", os: "Debian 12", cpu: 91, ram: 88, disk: 78, status: "warn", up: "44d" },
  { name: "node-04.abancool", ip: "159.65.42.21", os: "Ubuntu 22.04", cpu: 22, ram: 41, disk: 31, status: "online", up: "12d" },
  { name: "node-05.abancool", ip: "159.65.42.22", os: "AlmaLinux 9", cpu: 0, ram: 0, disk: 0, status: "offline", up: "—" },
];

function VPSPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="DevOps · Live metrics"
        title="VPS Infrastructure"
        description="Cloud servers, resource monitoring, SSH and deployments"
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm flex items-center gap-2">
              <Terminal className="size-3.5" /> SSH
            </button>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> Provision
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Servers" value="15" delta="14 online" icon={Cpu} />
        <StatTile label="Avg CPU" value="48%" delta="-3%" icon={Activity} tone="success" />
        <StatTile label="Total RAM" value="240 GB" delta="62% used" icon={HardDrive} />
        <StatTile label="Bandwidth" value="8.2 TB" delta="+18%" icon={Network} />
      </div>

      <Panel title="Live Metrics" subtitle="CPU & RAM · last 5 minutes">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cpuData}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="t" stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.09 0 0)", border: "1px solid oklch(0.72 0.18 235 / 0.4)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="c" stroke="oklch(0.72 0.18 235)" strokeWidth={2} dot={false} name="CPU %" />
              <Line type="monotone" dataKey="r" stroke="oklch(0.78 0.20 230)" strokeWidth={2} dot={false} strokeDasharray="4 4" name="RAM %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Server Inventory">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">Server</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">IP</th>
                <th className="px-2 py-3 font-medium hidden lg:table-cell">OS</th>
                <th className="px-2 py-3 font-medium">CPU</th>
                <th className="px-2 py-3 font-medium">RAM</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Disk</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Uptime</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s, i) => (
                <motion.tr
                  key={s.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/60 hover:bg-secondary/40"
                >
                  <td className="px-2 py-3 font-semibold text-primary">{s.name}</td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground">{s.ip}</td>
                  <td className="px-2 py-3 hidden lg:table-cell text-muted-foreground">{s.os}</td>
                  <td className="px-2 py-3">
                    <ResourceBar value={s.cpu} />
                  </td>
                  <td className="px-2 py-3">
                    <ResourceBar value={s.ram} />
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell">
                    <ResourceBar value={s.disk} />
                  </td>
                  <td className="px-2 py-3">
                    <Badge tone={s.status === "online" ? "success" : s.status === "warn" ? "warning" : "destructive"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground">{s.up}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Deployment Log" subtitle="Live tail · node-01">
        <div className="rounded-lg bg-black/60 border border-border p-4 font-mono text-[12px] leading-relaxed text-success/90 overflow-x-auto">
          <div><span className="text-muted-foreground">[15:42:01]</span> ✓ git pull origin main</div>
          <div><span className="text-muted-foreground">[15:42:03]</span> ✓ npm ci --production</div>
          <div><span className="text-muted-foreground">[15:42:18]</span> ✓ pm2 reload abancool-api</div>
          <div><span className="text-muted-foreground">[15:42:19]</span> ✓ healthcheck 200 OK · 42ms</div>
          <div><span className="text-muted-foreground">[15:42:20]</span> <span className="text-primary">→ Deployment complete</span></div>
          <div className="text-warning"><span className="text-muted-foreground">[15:43:11]</span> ⚠ Slow query detected · 1.2s</div>
          <div className="mt-2 flex items-center gap-2"><span className="size-1.5 rounded-full bg-success animate-pulse" /> streaming…</div>
        </div>
      </Panel>
    </div>
  );
}

function ResourceBar({ value }: { value: number }) {
  const color = value > 85 ? "bg-destructive" : value > 70 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2 w-24">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}
