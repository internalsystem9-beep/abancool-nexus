import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users, DollarSign, Server, Globe, Activity, MessageSquare, Send,
  LifeBuoy, UserCog, AlertTriangle, ShieldAlert, Cpu, TrendingUp, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ABANCOOL Command Center" },
      { name: "description", content: "Real-time analytics across hosting, billing, messaging and DevOps." },
    ],
  }),
  component: Dashboard,
});

const revenueData = [
  { day: "Mon", revenue: 42000, expenses: 18000 },
  { day: "Tue", revenue: 51000, expenses: 21000 },
  { day: "Wed", revenue: 47000, expenses: 19500 },
  { day: "Thu", revenue: 68000, expenses: 24000 },
  { day: "Fri", revenue: 82000, expenses: 28000 },
  { day: "Sat", revenue: 71000, expenses: 22000 },
  { day: "Sun", revenue: 94000, expenses: 26000 },
];

const apiData = [
  { t: "00", r: 240 }, { t: "04", r: 180 }, { t: "08", r: 520 },
  { t: "12", r: 880 }, { t: "16", r: 1240 }, { t: "20", r: 760 }, { t: "24", r: 420 },
];

const paymentSplit = [
  { name: "M-Pesa", value: 62, color: "oklch(0.72 0.18 235)" },
  { name: "Card", value: 23, color: "oklch(0.62 0.20 250)" },
  { name: "Bank", value: 10, color: "oklch(0.55 0.15 230)" },
  { name: "Cash", value: 5, color: "oklch(0.45 0.10 250)" },
];

function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Analytics <span className="text-primary text-glow">Dashboard</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time overview of ABANCOOL Technology operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm">
            <Activity className="size-4 text-primary" />
            <span className="text-muted-foreground">All branches</span>
            <span className="font-semibold">3 Active</span>
          </div>
        </div>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Revenue" value="KES 1,284,400" delta="+12.4%" up tint="primary" />
        <StatCard icon={Users} label="Active Clients" value="847" delta="+38" up />
        <StatCard icon={Server} label="Hosting Accounts" value="1,256" delta="+6.2%" up />
        <StatCard icon={Globe} label="Active Domains" value="934" delta="-2" />
      </div>

      {/* Secondary stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MiniStat icon={Cpu} label="VPS Online" value="14/15" />
        <MiniStat icon={Send} label="SMS Sent (24h)" value="48.2k" />
        <MiniStat icon={MessageSquare} label="WhatsApp" value="12.4k" />
        <MiniStat icon={Activity} label="API Calls" value="2.1M" />
        <MiniStat icon={LifeBuoy} label="Open Tickets" value="23" warn />
        <MiniStat icon={UserCog} label="Staff Online" value="18" />
      </div>

      {/* Alerts */}
      <div className="grid md:grid-cols-2 gap-4">
        <AlertBar
          icon={AlertTriangle}
          tone="warning"
          title="SSL expiring soon"
          message="3 domains have SSL certificates expiring within 14 days"
        />
        <AlertBar
          icon={ShieldAlert}
          tone="danger"
          title="Security notification"
          message="2 failed login attempts on admin@abancool.tech blocked"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Weekly Revenue</h3>
              <p className="text-xs text-muted-foreground">Revenue vs Expenses — last 7 days</p>
            </div>
            <div className="flex gap-4 text-xs">
              <Legend dot="oklch(0.72 0.18 235)" label="Revenue" />
              <Legend dot="oklch(0.55 0.15 230 / 0.6)" label="Expenses" />
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.15 230)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.55 0.15 230)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.65 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.65 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.09 0.008 250)",
                    border: "1px solid oklch(0.72 0.18 235 / 0.4)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="expenses" stroke="oklch(0.55 0.15 230)" strokeWidth={2} fill="url(#exp)" />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.72 0.18 235)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold text-lg">Payment Breakdown</h3>
          <p className="text-xs text-muted-foreground">Current month</p>
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentSplit}
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {paymentSplit.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.09 0.008 250)",
                    border: "1px solid oklch(0.72 0.18 235 / 0.4)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {paymentSplit.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
                  <span className="text-muted-foreground">{p.name}</span>
                </div>
                <span className="font-semibold">{p.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">API Requests</h3>
              <p className="text-xs text-muted-foreground">Hourly throughput · last 24h</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary text-glow">2.1M</div>
              <div className="text-xs text-success flex items-center gap-1 justify-end">
                <ArrowUpRight className="size-3" /> +18% vs yesterday
              </div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apiData}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="t" stroke="oklch(0.65 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.65 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "oklch(0.72 0.18 235 / 0.08)" }}
                  contentStyle={{
                    background: "oklch(0.09 0.008 250)",
                    border: "1px solid oklch(0.72 0.18 235 / 0.4)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="r" fill="oklch(0.72 0.18 235)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold text-lg">Recent Activity</h3>
          <p className="text-xs text-muted-foreground mb-4">Live feed</p>
          <div className="space-y-3">
            {[
              { t: "New client", d: "Safari Tours Ltd", time: "2m" },
              { t: "Domain renewed", d: "kenyatech.co.ke", time: "12m" },
              { t: "STK Push success", d: "KES 12,500", time: "24m" },
              { t: "VPS rebooted", d: "node-04.abancool", time: "1h" },
              { t: "SMS campaign", d: "8,420 delivered", time: "2h" },
              { t: "Ticket resolved", d: "#1240 by John", time: "3h" },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="size-8 rounded-md bg-primary/10 grid place-items-center">
                  <TrendingUp className="size-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.t}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.d}</div>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, delta, up, tint,
}: {
  icon: React.ElementType; label: string; value: string; delta?: string; up?: boolean; tint?: "primary";
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={`relative overflow-hidden glass rounded-2xl p-5 ${tint === "primary" ? "ring-1 ring-primary/30" : ""}`}
    >
      {tint === "primary" && (
        <div className="absolute -top-12 -right-12 size-32 rounded-full bg-primary/20 blur-3xl" />
      )}
      <div className="relative flex items-start justify-between">
        <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <Icon className="size-5" />
        </div>
        {delta && (
          <div className={`text-xs flex items-center gap-1 font-medium ${up ? "text-success" : "text-destructive"}`}>
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {delta}
          </div>
        )}
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </motion.div>
  );
}

function MiniStat({
  icon: Icon, label, value, warn,
}: { icon: React.ElementType; label: string; value: string; warn?: boolean }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`size-3.5 ${warn ? "text-warning" : "text-primary"}`} />
        {label}
      </div>
      <div className="mt-1.5 text-lg font-bold">{value}</div>
    </div>
  );
}

function AlertBar({
  icon: Icon, tone, title, message,
}: { icon: React.ElementType; tone: "warning" | "danger"; title: string; message: string }) {
  const color = tone === "warning" ? "text-warning" : "text-destructive";
  const bg = tone === "warning" ? "bg-warning/10" : "bg-destructive/10";
  return (
    <div className={`glass rounded-xl p-4 flex items-start gap-3 ${bg}`}>
      <div className={`size-9 rounded-md grid place-items-center ${bg} ${color}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: dot }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
