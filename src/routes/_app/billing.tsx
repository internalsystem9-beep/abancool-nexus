import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Receipt, DollarSign, TrendingUp, CreditCard, Smartphone,
  ArrowUpRight, ArrowDownRight, Plus, FileText,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({
    meta: [
      { title: "Billing — ABANCOOL Command Center" },
      { name: "description", content: "Invoices, payments, M-Pesa STK Push and revenue" },
    ],
  }),
  component: BillingPage,
});

const revenueData = Array.from({ length: 30 }).map((_, i) => ({
  d: `${i + 1}`,
  rev: 25000 + Math.round(Math.sin(i / 3) * 15000 + Math.random() * 12000),
}));

const methods = [
  { name: "M-Pesa", value: 62, color: "oklch(0.72 0.18 155)" },
  { name: "Card", value: 23, color: "oklch(0.72 0.18 235)" },
  { name: "Bank", value: 10, color: "oklch(0.78 0.20 230)" },
  { name: "Cash", value: 5, color: "oklch(0.62 0.02 250)" },
];

const txs = [
  { id: "TX-8421", client: "Safari Tours Ltd", method: "M-Pesa", amount: 48500, status: "paid", t: "2m" },
  { id: "TX-8420", client: "Kenya Tech Hub", method: "Card", amount: 32000, status: "paid", t: "14m" },
  { id: "TX-8419", client: "Nairobi Medical", method: "M-Pesa", amount: 64000, status: "pending", t: "1h" },
  { id: "TX-8418", client: "AgriCorp Kenya", method: "Bank", amount: 22500, status: "paid", t: "3h" },
  { id: "TX-8417", client: "Mombasa Logistics", method: "M-Pesa", amount: 18200, status: "failed", t: "5h" },
];

function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="Daraja · IntaSend · Paystack"
        title="Billing & Payments"
        description="Fintech-grade invoicing, transactions and revenue analytics"
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm flex items-center gap-2">
              <FileText className="size-3.5" /> New Quote
            </button>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> Invoice
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Revenue (MTD)" value="KES 1.28M" delta="+12.4%" icon={DollarSign} tone="success" />
        <StatTile label="Outstanding" value="KES 184K" delta="14 invoices" icon={Receipt} tone="warning" />
        <StatTile label="Profit Margin" value="42%" delta="+3pt" icon={TrendingUp} tone="success" />
        <StatTile label="Transactions" value="1,847" delta="+212" icon={CreditCard} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Revenue Timeline" subtitle="Last 30 days" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 235)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="d" stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.09 0 0)", border: "1px solid oklch(0.72 0.18 235 / 0.4)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="rev" stroke="oklch(0.72 0.18 235)" strokeWidth={2.5} fill="url(#rev2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Payment Methods" subtitle="Share of revenue">
          <div className="space-y-3 mt-2">
            {methods.map((m) => (
              <div key={m.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="flex items-center gap-2">
                    <Smartphone className="size-3.5" style={{ color: m.color }} /> {m.name}
                  </span>
                  <span className="font-mono">{m.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${m.value}%` }} className="h-full rounded-full" style={{ background: m.color }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Recent Transactions" subtitle="Live · auto-refreshing">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">ID</th>
                <th className="px-2 py-3 font-medium">Client</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Method</th>
                <th className="px-2 py-3 font-medium">Amount</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Time</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/60 hover:bg-secondary/40"
                >
                  <td className="px-2 py-3 font-mono text-xs text-primary">{t.id}</td>
                  <td className="px-2 py-3 font-medium">{t.client}</td>
                  <td className="px-2 py-3 hidden md:table-cell">
                    <Badge tone={t.method === "M-Pesa" ? "success" : "primary"}>{t.method}</Badge>
                  </td>
                  <td className="px-2 py-3 font-mono">KES {t.amount.toLocaleString()}</td>
                  <td className="px-2 py-3">
                    <Badge tone={t.status === "paid" ? "success" : t.status === "pending" ? "warning" : "destructive"}>
                      {t.status === "paid" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell text-muted-foreground text-xs">{t.t} ago</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Daily Volume" subtitle="Last 14 days">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData.slice(-14)}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.65 0 0)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.09 0 0)", border: "1px solid oklch(0.72 0.18 235 / 0.4)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="rev" fill="oklch(0.72 0.18 235)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
