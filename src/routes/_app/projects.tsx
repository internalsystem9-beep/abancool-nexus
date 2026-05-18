import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  FolderGit2, GitBranch, Clock, CheckCircle2, AlertCircle,
  Calendar, Users, Plus, MoreVertical,
} from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({
    meta: [
      { title: "Projects — ABANCOOL Command Center" },
      { name: "description", content: "Development pipeline and delivery tracking" },
    ],
  }),
  component: ProjectsPage,
});

const columns = [
  { id: "lead", title: "Lead", color: "oklch(0.62 0.02 250)" },
  { id: "discovery", title: "Discovery", color: "oklch(0.72 0.18 235)" },
  { id: "design", title: "UI/UX", color: "oklch(0.78 0.16 280)" },
  { id: "dev", title: "Development", color: "oklch(0.78 0.20 230)" },
  { id: "qa", title: "QA", color: "oklch(0.78 0.16 75)" },
  { id: "deploy", title: "Deployment", color: "oklch(0.72 0.18 155)" },
];

const cards = {
  lead: [
    { title: "Coast Realty Portal", client: "Coast Realty", tag: "Web", priority: "low", progress: 5 },
  ],
  discovery: [
    { title: "AgriCorp ERP", client: "AgriCorp Kenya", tag: "ERP", priority: "med", progress: 22 },
    { title: "Mombasa Tracking", client: "Mombasa Logistics", tag: "Mobile", priority: "med", progress: 18 },
  ],
  design: [
    { title: "Safari Booking v2", client: "Safari Tours", tag: "Design", priority: "high", progress: 48 },
  ],
  dev: [
    { title: "KTH Cloud Migration", client: "Kenya Tech Hub", tag: "DevOps", priority: "high", progress: 67 },
    { title: "Nairobi Medical EHR", client: "Nairobi Medical", tag: "Web", priority: "high", progress: 72 },
  ],
  qa: [
    { title: "Payments Module", client: "Internal", tag: "API", priority: "high", progress: 88 },
  ],
  deploy: [
    { title: "WHMCS Integration", client: "Internal", tag: "Integration", priority: "med", progress: 95 },
  ],
} as const;

function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="Sprint 24 · Week 2"
        title="Projects"
        description="Delivery pipeline, sprints, milestones and team velocity"
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-sm">Board</button>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-sm">Timeline</button>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> New Project
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Active Projects" value="18" delta="+3" hint="this sprint" icon={FolderGit2} />
        <StatTile label="On Track" value="14" delta="78%" icon={CheckCircle2} tone="success" />
        <StatTile label="At Risk" value="3" delta="needs review" icon={AlertCircle} tone="warning" />
        <StatTile label="Team Velocity" value="142 pts" delta="+18%" icon={GitBranch} tone="success" />
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto">
        <div className="grid grid-flow-col auto-cols-[280px] gap-4 pb-2">
          {columns.map((col) => {
            const items = (cards as Record<string, typeof cards.lead>)[col.id] ?? [];
            return (
              <div key={col.id} className="glass rounded-2xl p-3">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-semibold">{col.title}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{items.length}</span>
                  </div>
                  <button className="size-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((c, i) => (
                    <motion.div
                      key={c.title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ y: -2, boxShadow: "0 0 24px -6px oklch(0.72 0.18 235 / 0.5)" }}
                      className="rounded-lg border border-border bg-secondary/40 p-3 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold leading-tight">{c.title}</div>
                        <MoreVertical className="size-3.5 text-muted-foreground shrink-0" />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">{c.client}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge tone="primary">{c.tag}</Badge>
                        <Badge tone={c.priority === "high" ? "destructive" : c.priority === "med" ? "warning" : "neutral"}>
                          {c.priority}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span className="font-mono">{c.progress}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${c.progress}%` }} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex -space-x-1.5">
                          {["JN", "KA", "MO"].slice(0, 2 + (i % 2)).map((u) => (
                            <span key={u} className="size-5 rounded-full bg-primary/20 border border-card grid place-items-center text-[9px] font-bold text-primary">
                              {u}
                            </span>
                          ))}
                        </div>
                        <span className="flex items-center gap-1"><Clock className="size-3" /> Apr 28</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Upcoming Milestones" subtitle="Next 14 days" className="lg:col-span-2">
          <div className="space-y-3">
            {[
              { p: "Nairobi Medical EHR", m: "Beta release to staging", d: "Apr 24", pct: 72 },
              { p: "KTH Cloud Migration", m: "DNS cutover window", d: "Apr 26", pct: 67 },
              { p: "Safari Booking v2", m: "Design system signoff", d: "Apr 28", pct: 48 },
              { p: "WHMCS Integration", m: "Production deploy", d: "May 02", pct: 95 },
            ].map((x) => (
              <div key={x.m} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-secondary/30">
                <Calendar className="size-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{x.m}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{x.p}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono">{x.d}</div>
                  <div className="text-[10px] text-muted-foreground">{x.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Developer Productivity" subtitle="Commits · last 7 days">
          <div className="space-y-3">
            {[
              { dev: "John N.", commits: 84, role: "Lead Dev" },
              { dev: "Kate A.", commits: 62, role: "Frontend" },
              { dev: "Moses O.", commits: 51, role: "Backend" },
              { dev: "Lily K.", commits: 39, role: "DevOps" },
            ].map((d, i) => (
              <div key={d.dev} className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                  {d.dev.split(" ").map((s) => s[0]).join("")}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{d.dev}</div>
                  <div className="text-[11px] text-muted-foreground">{d.role}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-primary">{d.commits}</div>
                  <div className="text-[10px] text-muted-foreground">commits</div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3.5" /> 18 contributors active
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
