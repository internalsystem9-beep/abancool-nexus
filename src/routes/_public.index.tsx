import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Server,
  ShoppingCart,
  MessageSquare,
  Cloud,
  Smartphone,
  Globe,
  CreditCard,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Users,
  Activity,
} from "lucide-react";
import {
  Section,
  Eyebrow,
  H1,
  H2,
  Lead,
  CTA,
  FeatureCard,
  Stat,
  CheckList,
} from "@/components/public/marketing";

export const Route = createFileRoute("/_public/")({
  head: () => ({
    meta: [
      { title: "ABANCOOL — Powering African Businesses With Smart Digital Infrastructure" },
      {
        name: "description",
        content:
          "Hosting, POS systems, bulk SMS, VPS, WhatsApp APIs, mobile apps, payment integrations and business automation — all in one ecosystem.",
      },
      { property: "og:title", content: "ABANCOOL — Africa's Business Operating System" },
      {
        property: "og:description",
        content: "One platform for hosting, POS, payments, SMS and WhatsApp.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

const services = [
  { icon: Server, title: "Premium Hosting", description: "cPanel & LiteSpeed-powered shared, reseller and managed hosting with daily backups." },
  { icon: ShoppingCart, title: "Multi-Tenant POS", description: "Cloud POS for supermarkets, pharmacies, restaurants, wholesalers and more." },
  { icon: MessageSquare, title: "Bulk SMS", description: "Branded sender IDs, REST APIs, OTP delivery and campaign analytics." },
  { icon: Cloud, title: "VPS Hosting", description: "NVMe-backed virtual servers with hourly snapshots and one-click scaling." },
  { icon: Smartphone, title: "WhatsApp Cloud API", description: "Verified business numbers, template messaging and chatbot automation." },
  { icon: Globe, title: "Domains & DNS", description: "Domain registration, transfers, DNSSEC, free WHOIS privacy on every TLD." },
  { icon: CreditCard, title: "Payments", description: "M-Pesa STK Push, IntaSend, Paystack & Flutterwave with auto-settlement." },
  { icon: Shield, title: "Security & Vault", description: "AES-256 vault, 2FA, audit logs, device tracking and DDoS protection." },
];

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,oklch(0.58_0.21_255/0.18),transparent_55%),radial-gradient(circle_at_80%_30%,oklch(0.68_0.20_250/0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <Eyebrow>
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                Trusted by 1,200+ African businesses
              </Eyebrow>
              <div className="mt-5">
                <H1>
                  Powering African businesses with{" "}
                  <span className="gradient-text">smart digital infrastructure</span>
                </H1>
              </div>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
                Hosting, POS systems, bulk SMS, VPS, WhatsApp APIs, mobile apps, payment
                integrations and business automation — all in one ecosystem.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CTA to="/login">Start free trial</CTA>
                <CTA to="/services" variant="ghost">
                  Explore services
                </CTA>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-primary" /> 99.99% uptime
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-primary" /> M-Pesa & Paystack ready
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-primary" /> 24/7 human support
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-8 bg-[var(--gradient-glow)] blur-2xl" />
                <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-secondary/50">
                    <div className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-red-400" />
                      <span className="size-2.5 rounded-full bg-yellow-400" />
                      <span className="size-2.5 rounded-full bg-green-400" />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">portal.abancool.com</span>
                    <span />
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Revenue today</div>
                        <div className="text-2xl font-bold mt-0.5">KES 482,910</div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                        +12.4%
                      </span>
                    </div>
                    <div className="h-24 rounded-lg bg-[var(--gradient-primary)] opacity-90 relative overflow-hidden">
                      <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                        <path
                          d="M0,60 L20,55 L40,40 L60,45 L80,30 L100,35 L120,20 L140,25 L160,15 L180,10 L200,18 L200,80 L0,80 Z"
                          fill="rgba(255,255,255,0.25)"
                        />
                        <path
                          d="M0,60 L20,55 L40,40 L60,45 L80,30 L100,35 L120,20 L140,25 L160,15 L180,10 L200,18"
                          stroke="white"
                          strokeWidth="2"
                          fill="none"
                        />
                      </svg>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Transactions", value: "1,284" },
                        { label: "Hosting", value: "342" },
                        { label: "SMS sent", value: "18.2k" },
                      ].map((s) => (
                        <div key={s.label} className="p-2.5 rounded-lg border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                          <div className="text-sm font-semibold mt-0.5">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="border-y border-border bg-secondary/30">
        <Section className="!py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <Stat value="1.2k+" label="Active businesses" />
            <Stat value="99.99%" label="Platform uptime" />
            <Stat value="18M+" label="Messages delivered" />
            <Stat value="KES 4.2B" label="Payments processed" />
          </div>
        </Section>
      </div>

      {/* SERVICES */}
      <Section>
        <div className="text-center mb-14">
          <Eyebrow>Services</Eyebrow>
          <div className="mt-4">
            <H2>Everything your business needs, in one platform</H2>
          </div>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Replace ten tools with one. Built for African businesses, from the till to the cloud.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((s) => (
            <FeatureCard key={s.title} {...s} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <CTA to="/services">See all services</CTA>
        </div>
      </Section>

      {/* POS */}
      <div className="bg-secondary/30 border-y border-border">
        <Section>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Eyebrow>Multi-tenant POS SaaS</Eyebrow>
              <div className="mt-4">
                <H2>The POS that grows with your business</H2>
              </div>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                One platform for supermarkets, restaurants, pharmacies, wholesalers,
                electronics shops and salons. Each business gets fully isolated data,
                staff, inventory and analytics.
              </p>
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                <CheckList
                  items={[
                    "Barcode & SKU sales",
                    "M-Pesa STK Push checkout",
                    "Real-time inventory",
                    "Multi-branch support",
                  ]}
                />
                <CheckList
                  items={[
                    "Restaurant table mgmt",
                    "Pharmacy expiry tracking",
                    "Offline mode + auto-sync",
                    "Receipt printer support",
                  ]}
                />
              </div>
              <div className="mt-8 flex gap-3">
                <CTA to="/pos">Explore POS</CTA>
                <CTA to="/pricing" variant="ghost">View plans</CTA>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 bg-[var(--gradient-glow)] blur-3xl" />
              <div className="relative rounded-2xl border border-border bg-card shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold">Daily sales</div>
                  <span className="text-xs px-2 py-1 rounded-full bg-accent text-primary font-medium">Live</span>
                </div>
                <div className="space-y-3">
                  {[
                    ["Mama Njeri Supermarket", "KES 142,500", TrendingUp],
                    ["Java Cafe — Westlands", "KES 89,340", TrendingUp],
                    ["MediPlus Pharmacy", "KES 64,210", Activity],
                    ["TechWorld Electronics", "KES 218,900", TrendingUp],
                  ].map(([name, value, Icon]) => (
                    <div key={String(name)} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-accent grid place-items-center text-primary">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(() => { const C = Icon as any; return <C className="size-4" />; })()}
                        </div>
                        <span className="text-sm font-medium">{String(name)}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* CTA STRIP */}
      <Section>
        <div className="relative overflow-hidden rounded-3xl p-10 lg:p-16 bg-[var(--gradient-primary)] text-primary-foreground text-center">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative">
            <Users className="size-10 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ready to run your business smarter?
            </h2>
            <p className="mt-3 text-primary-foreground/85 max-w-xl mx-auto">
              Start free. No credit card. Get a fully-loaded ABANCOOL workspace in 60 seconds.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 px-6 py-3 text-sm font-semibold rounded-md bg-background text-primary hover:bg-background/90 transition shadow-lg"
              >
                Start free <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center px-6 py-3 text-sm font-semibold rounded-md border border-primary-foreground/30 hover:bg-primary-foreground/10 transition"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
