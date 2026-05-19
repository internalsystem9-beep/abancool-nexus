import { createFileRoute } from "@tanstack/react-router";
import {
  ShoppingCart, Pill, UtensilsCrossed, Store, Smartphone, Scissors,
  Barcode, Receipt, Wifi, CreditCard, Users, BarChart3,
} from "lucide-react";
import { PageHero, Section, FeatureCard, CheckList, H2, Eyebrow, CTA } from "@/components/public/marketing";

export const Route = createFileRoute("/_public/pos")({
  head: () => ({
    meta: [
      { title: "POS — Multi-Tenant POS SaaS for Africa | ABANCOOL" },
      { name: "description", content: "Cloud POS for supermarkets, restaurants, pharmacies, wholesalers and salons. M-Pesa STK Push, multi-branch, offline mode." },
      { property: "og:title", content: "ABANCOOL POS" },
      { property: "og:url", content: "/pos" },
    ],
    links: [{ rel: "canonical", href: "/pos" }],
  }),
  component: PosPage,
});

const industries = [
  { icon: Store, title: "Supermarkets & Minimarts", description: "Barcode sales, multi-branch inventory, supplier orders." },
  { icon: UtensilsCrossed, title: "Restaurants & Bars", description: "Tables, kitchen tickets, waiter assignment, split bills." },
  { icon: Pill, title: "Pharmacies", description: "Prescription tracking, expiry alerts, batch numbers." },
  { icon: Smartphone, title: "Electronics Shops", description: "Serial-number tracking, warranty management, IMEI capture." },
  { icon: ShoppingCart, title: "Wholesalers", description: "Tiered pricing, credit accounts, B2B invoicing." },
  { icon: Scissors, title: "Salons & Service shops", description: "Appointment booking, staff commissions, customer profiles." },
];

const features = [
  { icon: Barcode, title: "Barcode & SKU sales", description: "Scan, sell, print receipts — under 2 seconds per transaction." },
  { icon: CreditCard, title: "M-Pesa STK Push", description: "Customers approve payments on their phones. Reconciled automatically." },
  { icon: Receipt, title: "Thermal printer support", description: "USB & Bluetooth printers, cash drawers, weight scales." },
  { icon: Wifi, title: "Offline-first", description: "Keep selling when the internet is down. Auto-sync when back online." },
  { icon: Users, title: "Staff & roles", description: "Cashiers, managers, admins — granular permissions and activity logs." },
  { icon: BarChart3, title: "Analytics", description: "Revenue, best-sellers, branch performance, cashier productivity." },
];

function PosPage() {
  return (
    <>
      <PageHero
        eyebrow="Multi-tenant POS SaaS"
        title={<>The point of sale, <span className="gradient-text">reinvented for Africa</span></>}
        description="Built for every kind of business. Each tenant gets isolated data, staff, inventory and analytics — managed from a beautiful cloud dashboard."
      />

      <Section>
        <div className="text-center mb-12">
          <Eyebrow>Built for every industry</Eyebrow>
          <div className="mt-4"><H2>One POS. Every kind of business.</H2></div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {industries.map((i) => <FeatureCard key={i.title} {...i} />)}
        </div>
      </Section>

      <div className="bg-secondary/30 border-y border-border">
        <Section>
          <div className="text-center mb-12">
            <Eyebrow>Features</Eyebrow>
            <div className="mt-4"><H2>Everything you'd expect — and a lot you wouldn't</H2></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
        </Section>
      </div>

      <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Eyebrow>Compliance & control</Eyebrow>
            <div className="mt-4"><H2>Enterprise-grade by default</H2></div>
            <p className="mt-4 text-muted-foreground">
              Cloud backups, audit logs, 2FA, KRA-compliant receipts, and a security
              vault for every credential.
            </p>
            <div className="mt-6">
              <CheckList items={[
                "Automatic daily cloud backups",
                "Audit logs for every sensitive action",
                "Two-factor authentication (TOTP + SMS)",
                "Role-based access control with custom roles",
                "AES-256 encrypted credential vault",
                "GDPR-style data export on demand",
              ]} />
            </div>
            <div className="mt-8"><CTA to="/pricing">Start your free trial</CTA></div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="font-semibold mb-4">Live transaction stream</div>
            <div className="space-y-2 font-mono text-xs">
              {[
                ["09:42:18", "Supermarket A", "STK ✓", "KES 1,240"],
                ["09:42:14", "Java Cafe", "Cash", "KES 480"],
                ["09:42:09", "MediPlus", "STK ✓", "KES 3,820"],
                ["09:42:01", "TechWorld", "Card", "KES 18,500"],
                ["09:41:55", "Salon Glow", "STK ✓", "KES 2,100"],
                ["09:41:48", "Supermarket B", "STK ✓", "KES 640"],
              ].map((r, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2 rounded-md border border-border">
                  <span className="text-muted-foreground">{r[0]}</span>
                  <span>{r[1]}</span>
                  <span className="text-primary">{r[2]}</span>
                  <span className="text-right tabular-nums font-semibold">{r[3]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
