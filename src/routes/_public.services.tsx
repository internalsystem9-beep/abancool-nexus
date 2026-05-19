import { createFileRoute } from "@tanstack/react-router";
import {
  Server, ShoppingCart, MessageSquare, Cloud, Smartphone, Globe,
  CreditCard, Shield, Code2, Database, Mail, BarChart3,
} from "lucide-react";
import { PageHero, Section, FeatureCard, CTA } from "@/components/public/marketing";

export const Route = createFileRoute("/_public/services")({
  head: () => ({
    meta: [
      { title: "Services — ABANCOOL" },
      { name: "description", content: "Hosting, POS, SMS, VPS, WhatsApp, domains, payments and security — all the infrastructure African businesses need." },
      { property: "og:title", content: "ABANCOOL Services" },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

const all = [
  { icon: Server, title: "Web Hosting", description: "cPanel, LiteSpeed, free SSL, daily backups, malware scanning, free migration." },
  { icon: Cloud, title: "VPS Hosting", description: "NVMe SSD virtual servers, hourly snapshots, full root access, one-click scaling." },
  { icon: Globe, title: "Domain Registration", description: "Register .com, .co.ke, .africa, .io and 400+ TLDs with free WHOIS privacy." },
  { icon: ShoppingCart, title: "Multi-Tenant POS", description: "Cloud POS for retail, restaurants, pharmacies, wholesalers and salons." },
  { icon: MessageSquare, title: "Bulk SMS", description: "Branded sender IDs, OTP messaging, scheduled campaigns, REST APIs." },
  { icon: Smartphone, title: "WhatsApp Cloud API", description: "Verified business numbers, template messaging, chatbots and broadcasts." },
  { icon: CreditCard, title: "Payment Integrations", description: "M-Pesa Daraja, IntaSend, Paystack, Flutterwave — one unified API." },
  { icon: Code2, title: "App Development", description: "Custom web and mobile apps built on the ABANCOOL platform." },
  { icon: Database, title: "Managed Databases", description: "MySQL, PostgreSQL and Redis with automated backups and replication." },
  { icon: Mail, title: "Business Email", description: "Branded mailboxes with anti-spam, calendars and shared inboxes." },
  { icon: Shield, title: "Security & Vault", description: "AES-256 password vault, 2FA, audit logs and DDoS protection." },
  { icon: BarChart3, title: "Analytics & Reporting", description: "Real-time dashboards, custom reports and scheduled exports." },
];

function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title={<>One ecosystem. <span className="gradient-text">Every service.</span></>}
        description="From the till to the cloud — replace ten vendors with one platform built for African businesses."
      />
      <Section>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {all.map((s) => <FeatureCard key={s.title} {...s} />)}
        </div>
        <div className="mt-14 text-center">
          <CTA to="/pricing">See pricing</CTA>
        </div>
      </Section>
    </>
  );
}
