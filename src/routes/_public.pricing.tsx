import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHero, Section, Eyebrow, H2 } from "@/components/public/marketing";

export const Route = createFileRoute("/_public/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Hosting, VPS, POS & SMS | ABANCOOL" },
      { name: "description", content: "Transparent pricing for hosting, VPS, POS subscriptions and bulk SMS. Pay-as-you-grow with no hidden fees." },
      { property: "og:title", content: "ABANCOOL Pricing" },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const hosting = [
  { name: "Starter", price: "499", period: "/mo", description: "Perfect for small sites and blogs.",
    features: ["10 GB NVMe storage", "Unmetered bandwidth", "1 domain", "Free SSL", "Daily backups", "Email support"] },
  { name: "Business", price: "1,499", period: "/mo", description: "For growing businesses & e-commerce.", highlighted: true,
    features: ["50 GB NVMe storage", "Unlimited domains", "Free CDN", "Free SSL wildcard", "Daily backups", "Priority support", "Free migration", "Staging environment"] },
  { name: "Enterprise", price: "4,999", period: "/mo", description: "Mission-critical apps & high traffic.",
    features: ["200 GB NVMe storage", "Unlimited everything", "Dedicated IP", "24/7 phone support", "Hourly backups", "DDoS protection", "Custom SLA"] },
];

const vps = [
  { name: "VPS-1", price: "1,999", specs: "2 vCPU · 4 GB RAM · 80 GB NVMe" },
  { name: "VPS-2", price: "3,999", specs: "4 vCPU · 8 GB RAM · 160 GB NVMe", highlighted: true },
  { name: "VPS-3", price: "7,999", specs: "8 vCPU · 16 GB RAM · 320 GB NVMe" },
  { name: "VPS-4", price: "14,999", specs: "16 vCPU · 32 GB RAM · 640 GB NVMe" },
];

const pos = [
  { name: "Starter", price: "999", description: "Single till, 1 branch.",
    features: ["1 user", "1 branch", "500 SKUs", "M-Pesa STK", "Basic reports", "Email support"] },
  { name: "Business", price: "2,999", description: "Multi-branch, multi-user.", highlighted: true,
    features: ["10 users", "3 branches", "Unlimited SKUs", "All payment gateways", "Advanced analytics", "SMS & WhatsApp", "Priority support"] },
  { name: "Enterprise", price: "Custom", description: "Large operations & franchises.",
    features: ["Unlimited users", "Unlimited branches", "Custom integrations", "Dedicated success manager", "Custom SLA", "On-premise option"] },
];

function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title={<>Simple pricing. <span className="gradient-text">Built to scale.</span></>}
        description="Start small, grow big. No hidden fees, no surprise overage. Switch plans any time."
      />

      <Section>
        <div className="text-center mb-10">
          <Eyebrow>Web hosting</Eyebrow>
          <div className="mt-4"><H2>cPanel hosting plans</H2></div>
        </div>
        <PlanGrid plans={hosting} suffix="KES" />
      </Section>

      <div className="bg-secondary/30 border-y border-border">
        <Section>
          <div className="text-center mb-10">
            <Eyebrow>VPS hosting</Eyebrow>
            <div className="mt-4"><H2>Powerful virtual servers</H2></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vps.map((v) => (
              <div key={v.name} className={`p-6 rounded-2xl border bg-card ${v.highlighted ? "border-primary shadow-xl ring-1 ring-primary/20" : "border-border"}`}>
                <div className="font-semibold">{v.name}</div>
                <div className="mt-3 text-3xl font-bold">
                  <span className="text-base font-normal text-muted-foreground">KES </span>
                  {v.price}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{v.specs}</div>
                <Link to="/login" className="mt-5 block text-center px-4 py-2 rounded-md bg-[var(--gradient-primary)] text-primary-foreground text-sm font-medium hover:shadow-lg transition">
                  Deploy now
                </Link>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section>
        <div className="text-center mb-10">
          <Eyebrow>POS subscriptions</Eyebrow>
          <div className="mt-4"><H2>Per-business POS plans</H2></div>
        </div>
        <PlanGrid plans={pos} suffix="KES" />
      </Section>

      <div className="bg-secondary/30 border-t border-border">
        <Section>
          <div className="text-center max-w-3xl mx-auto">
            <Eyebrow>SMS & WhatsApp</Eyebrow>
            <div className="mt-4"><H2>Pay only for what you send</H2></div>
            <p className="mt-4 text-muted-foreground">
              SMS from KES 0.80 / msg · WhatsApp templates from KES 1.50 / msg. Volume discounts kick in automatically above 10,000 messages.
            </p>
            <div className="mt-8">
              <Link to="/contact" className="inline-flex px-5 py-3 rounded-md bg-[var(--gradient-primary)] text-primary-foreground text-sm font-medium">
                Request a quote
              </Link>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}

function PlanGrid({ plans, suffix }: { plans: { name: string; price: string; period?: string; description: string; features: string[]; highlighted?: boolean }[]; suffix: string }) {
  return (
    <div className="grid md:grid-cols-3 gap-5">
      {plans.map((p) => (
        <div key={p.name} className={`p-7 rounded-2xl border bg-card ${p.highlighted ? "border-primary shadow-xl ring-1 ring-primary/20 relative" : "border-border"}`}>
          {p.highlighted && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--gradient-primary)] text-primary-foreground text-xs font-semibold">
              Most popular
            </div>
          )}
          <div className="font-semibold text-lg">{p.name}</div>
          <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
          <div className="mt-5 flex items-baseline gap-1">
            {p.price !== "Custom" && <span className="text-sm text-muted-foreground">{suffix}</span>}
            <span className="text-4xl font-bold">{p.price}</span>
            {p.period && <span className="text-sm text-muted-foreground">{p.period}</span>}
            {p.price !== "Custom" && !p.period && <span className="text-sm text-muted-foreground">/mo</span>}
          </div>
          <Link to="/login" className={`mt-6 block text-center px-4 py-2.5 rounded-md text-sm font-medium transition ${p.highlighted ? "bg-[var(--gradient-primary)] text-primary-foreground hover:shadow-lg" : "border border-border hover:bg-accent"}`}>
            {p.price === "Custom" ? "Contact sales" : "Get started"}
          </Link>
          <ul className="mt-6 space-y-2.5">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="size-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
