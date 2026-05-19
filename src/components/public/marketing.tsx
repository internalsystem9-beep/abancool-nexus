import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check } from "lucide-react";

export function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-7xl px-6 py-20 ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-accent text-primary border border-primary/20">
      {children}
    </div>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
      {children}
    </h1>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
      {children}
    </h2>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">{children}</p>;
}

export function CTA({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  if (variant === "ghost") {
    return (
      <Link
        to={to}
        className="inline-flex items-center gap-1 px-5 py-3 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent transition"
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 px-5 py-3 text-sm font-medium rounded-md bg-[var(--gradient-primary)] text-primary-foreground shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all"
    >
      {children} <ArrowRight className="size-4" />
    </Link>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-xl transition-all">
      <div className="size-11 rounded-xl bg-accent text-primary grid place-items-center mb-4 group-hover:bg-[var(--gradient-primary)] group-hover:text-primary-foreground transition-colors">
        <Icon className="size-5" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2 text-sm">
          <Check className="size-4 text-primary mt-0.5 shrink-0" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl sm:text-4xl font-bold gradient-text">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.58_0.21_255/0.12),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-28 text-center">
        <Eyebrow>{eyebrow}</Eyebrow>
        <div className="mt-5">
          <H1>{title}</H1>
        </div>
        <p className="mt-5 mx-auto text-lg text-muted-foreground max-w-2xl">{description}</p>
      </div>
    </div>
  );
}
