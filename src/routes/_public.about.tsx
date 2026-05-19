import { createFileRoute } from "@tanstack/react-router";
import { Target, Heart, Award, Globe2 } from "lucide-react";
import { PageHero, Section, FeatureCard, Stat, Eyebrow, H2 } from "@/components/public/marketing";

export const Route = createFileRoute("/_public/about")({
  head: () => ({
    meta: [
      { title: "About — ABANCOOL Technology" },
      { name: "description", content: "ABANCOOL is building Africa's all-in-one business operating system — hosting, POS, payments, SMS and WhatsApp in one platform." },
      { property: "og:title", content: "About ABANCOOL" },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

const values = [
  { icon: Target, title: "Built for Africa", description: "Designed around M-Pesa, local TLDs, intermittent connectivity and the realities of African commerce." },
  { icon: Heart, title: "Customer obsessed", description: "Real humans, 24/7 — on WhatsApp, phone and email. We treat every business like our own." },
  { icon: Award, title: "Enterprise grade", description: "99.99% uptime SLAs, ISO-aligned security, audited backups. The boring stuff, done right." },
  { icon: Globe2, title: "One platform", description: "We replace ten vendors with one tightly integrated ecosystem — and we do it at a fair price." },
];

function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our story"
        title={<>Africa's business <span className="gradient-text">operating system</span></>}
        description="We started ABANCOOL because African businesses deserved more than fragmented tools and foreign-built software. One platform. Built here. Built right."
      />

      <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Eyebrow>Mission</Eyebrow>
            <div className="mt-4"><H2>Empower a million African businesses by 2030</H2></div>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              From the corner shop in Kibera to the multi-branch retailer in Lagos,
              every business should have access to enterprise-grade tools. ABANCOOL
              unifies hosting, POS, payments and communication into one platform any
              business can afford and any developer can extend.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We're a team of engineers, designers and operators who've spent the
              last decade building infrastructure across Kenya, Uganda, Tanzania
              and beyond. ABANCOOL is the platform we wished existed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 p-8 rounded-2xl border border-border bg-card">
            <Stat value="1.2k+" label="Businesses served" />
            <Stat value="6" label="Countries" />
            <Stat value="42" label="Team members" />
            <Stat value="99.99%" label="Uptime SLA" />
          </div>
        </div>
      </Section>

      <div className="bg-secondary/30 border-y border-border">
        <Section>
          <div className="text-center mb-10">
            <Eyebrow>What we stand for</Eyebrow>
            <div className="mt-4"><H2>Our values</H2></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((v) => <FeatureCard key={v.title} {...v} />)}
          </div>
        </Section>
      </div>
    </>
  );
}
