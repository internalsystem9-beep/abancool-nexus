import { motion } from "framer-motion";
import { Download, Filter, Plus } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  badge?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6"
    >
      <div>
        {badge && (
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-primary border border-primary/30 rounded-md px-2.5 py-1 bg-primary/5 mb-3">
            <span className="size-1.5 rounded-full bg-primary animate-pulse-glow" />
            {badge}
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
      </div>
      {actions !== undefined ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-sm flex items-center gap-2 transition">
            <Filter className="size-3.5" /> Filter
          </button>
          <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-sm flex items-center gap-2 transition">
            <Download className="size-3.5" /> Export
          </button>
          <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-glow text-sm font-medium flex items-center gap-2 transition glow-blue">
            <Plus className="size-3.5" /> New
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function StatTile({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
  icon?: React.ElementType;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="glass rounded-xl p-4 relative overflow-hidden hover:shadow-[0_0_24px_-6px_oklch(0.72_0.18_235/0.5)] transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {Icon && <Icon className={`size-4 ${toneClass}`} />}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[11px] mt-1 flex items-center gap-1.5">
        {delta && <span className={toneClass}>{delta}</span>}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </motion.div>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <h3 className="font-semibold">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "destructive";
}) {
  const cls = {
    neutral: "bg-secondary text-muted-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/30",
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${cls}`}>
      {children}
    </span>
  );
}
