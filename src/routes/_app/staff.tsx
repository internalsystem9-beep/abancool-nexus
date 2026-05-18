import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { UserCog, ShieldCheck, Clock, Activity, Plus } from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/staff")({
  head: () => ({
    meta: [
      { title: "Staff — ABANCOOL Command Center" },
      { name: "description", content: "Team management, roles, permissions and attendance" },
    ],
  }),
  component: StaffPage,
});

const staff = [
  { name: "John Njoroge", role: "Super Admin", dept: "Leadership", email: "john@abancool.tech", status: "online", last: "now", attendance: 98 },
  { name: "Kate Auma", role: "Admin", dept: "Operations", email: "kate@abancool.tech", status: "online", last: "now", attendance: 95 },
  { name: "Moses Otieno", role: "Lead Developer", dept: "Engineering", email: "moses@abancool.tech", status: "away", last: "12m", attendance: 92 },
  { name: "Lily Kamau", role: "DevOps", dept: "Engineering", email: "lily@abancool.tech", status: "online", last: "now", attendance: 96 },
  { name: "David Mwangi", role: "Finance", dept: "Finance", email: "david@abancool.tech", status: "offline", last: "2h", attendance: 88 },
  { name: "Sarah Wanjiku", role: "Support Lead", dept: "Support", email: "sarah@abancool.tech", status: "online", last: "now", attendance: 99 },
  { name: "Peter Kiprop", role: "Sales", dept: "Sales", email: "peter@abancool.tech", status: "online", last: "now", attendance: 91 },
];

function StaffPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="HR · Team of 18"
        title="Staff"
        description="Roles, permissions, attendance and performance"
        actions={
          <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
            <Plus className="size-3.5" /> Invite Member
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Staff" value="18" delta="+2 this Q" icon={UserCog} />
        <StatTile label="Online" value="14" delta="78%" icon={Activity} tone="success" />
        <StatTile label="Avg Attendance" value="94%" delta="+1pt" icon={Clock} tone="success" />
        <StatTile label="Roles Configured" value="6" delta="all secured" icon={ShieldCheck} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {staff.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -3, boxShadow: "0 0 24px -6px oklch(0.72 0.18 235 / 0.5)" }}
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="relative">
                <div className="size-12 rounded-full bg-gradient-to-br from-primary/30 to-primary-glow/10 grid place-items-center text-primary text-sm font-bold border border-primary/20">
                  {s.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <span className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-card ${s.status === "online" ? "bg-success" : s.status === "away" ? "bg-warning" : "bg-muted-foreground"}`} />
              </div>
              <Badge tone="primary">{s.role.split(" ")[0]}</Badge>
            </div>
            <div className="font-semibold text-sm">{s.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{s.email}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{s.dept}</div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last seen</span>
              <span className="font-mono">{s.last}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Attendance</span>
                <span className="font-mono">{s.attendance}%</span>
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${s.attendance}%` }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Panel title="Roles & Permissions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">Role</th>
                <th className="px-2 py-3 text-center font-medium">Clients</th>
                <th className="px-2 py-3 text-center font-medium">Billing</th>
                <th className="px-2 py-3 text-center font-medium">Hosting</th>
                <th className="px-2 py-3 text-center font-medium">Vault</th>
                <th className="px-2 py-3 text-center font-medium">DevOps</th>
                <th className="px-2 py-3 text-center font-medium">Settings</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Super Admin", true, true, true, true, true, true],
                ["Admin", true, true, true, false, true, true],
                ["Developer", false, false, true, false, true, false],
                ["Support", true, false, true, false, false, false],
                ["Finance", true, true, false, false, false, false],
                ["Sales", true, false, false, false, false, false],
              ].map((row, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="px-2 py-3 font-medium">{row[0]}</td>
                  {row.slice(1).map((v, j) => (
                    <td key={j} className="px-2 py-3 text-center">
                      {v ? <CheckMark /> : <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function CheckMark() {
  return (
    <span className="inline-grid place-items-center size-5 rounded bg-primary/15 text-primary">
      <svg viewBox="0 0 16 16" className="size-3"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  );
}
