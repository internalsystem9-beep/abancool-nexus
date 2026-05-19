import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PageHero, Section } from "@/components/public/marketing";

export const Route = createFileRoute("/_public/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Frequently Asked Questions | ABANCOOL" },
      { name: "description", content: "Answers about ABANCOOL hosting, POS, payments, SMS, billing, security and onboarding." },
      { property: "og:title", content: "ABANCOOL FAQ" },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: FaqPage,
});

const faqs = [
  { q: "What is ABANCOOL?", a: "ABANCOOL is Africa's all-in-one business operating system — combining hosting, multi-tenant POS, bulk SMS, WhatsApp Cloud API, VPS, domains, payments and automation into one platform." },
  { q: "How do I get started?", a: "Click 'Get started' and create a free account. You'll have access to a fully-loaded ABANCOOL workspace in under 60 seconds. No credit card required for the trial." },
  { q: "Which payment methods do you support?", a: "M-Pesa (STK Push, Till, Paybill), Card payments via Paystack and Flutterwave, IntaSend, and bank transfer for enterprise contracts." },
  { q: "Is my data secure?", a: "Yes. We use AES-256 encryption at rest, TLS 1.3 in transit, 2FA on every account, audit logging on sensitive actions and DDoS protection at the edge. Backups run hourly for VPS and daily for shared hosting." },
  { q: "Can I migrate from another provider?", a: "Yes — Business and Enterprise hosting plans include free migration. Our team handles the move, tests the result, and switches DNS only when you approve." },
  { q: "Do you support multi-branch businesses?", a: "Absolutely. The POS is built for multi-branch and multi-tenant operation from day one. Each branch gets its own inventory, staff and analytics, with consolidated reporting at the top." },
  { q: "What happens if the internet goes down?", a: "The POS keeps selling in offline mode. Transactions are queued locally and synced automatically when your connection returns." },
  { q: "Can I cancel any time?", a: "Yes. All subscriptions are month-to-month and you can cancel from your dashboard at any time. We'll prorate refunds for annual plans." },
  { q: "Do you offer custom development?", a: "Yes. Our App Development team builds custom web and mobile apps on top of the ABANCOOL platform. Get in touch via the Contact page." },
  { q: "Where are your servers located?", a: "We operate in multiple data centers across Africa and Europe, including Nairobi, Johannesburg, Frankfurt and London, with CDN edge nodes globally." },
];

function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="Help center"
        title={<>Questions, <span className="gradient-text">answered</span></>}
        description="Everything you need to know about ABANCOOL. Still stuck? Talk to our team — we reply within an hour."
      />

      <Section>
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
        </div>
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">Can't find what you need?</p>
          <Link to="/contact" className="mt-3 inline-flex px-5 py-3 rounded-md bg-[var(--gradient-primary)] text-primary-foreground text-sm font-semibold">
            Contact support
          </Link>
        </div>
      </Section>
    </>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-accent/30 transition"
      >
        <span className="font-semibold">{q}</span>
        <ChevronDown className={`size-5 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
          {a}
        </div>
      )}
    </div>
  );
}
