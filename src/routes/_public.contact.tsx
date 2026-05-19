import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, MessageSquare, MapPin, Send, CheckCircle2 } from "lucide-react";
import { PageHero, Section } from "@/components/public/marketing";

export const Route = createFileRoute("/_public/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Talk to ABANCOOL" },
      { name: "description", content: "Get in touch with our sales and support teams. We respond within 1 business hour." },
      { property: "og:title", content: "Contact ABANCOOL" },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={<>Let's <span className="gradient-text">build together</span></>}
        description="Sales, support, partnerships — we're here. Most messages get a reply within one business hour."
      />

      <Section>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            {[
              { icon: Mail, title: "Email", value: "hello@abancool.com", sub: "Reply in <1 hr" },
              { icon: Phone, title: "Phone", value: "+254 700 000 000", sub: "Mon–Fri 8am–6pm EAT" },
              { icon: MessageSquare, title: "WhatsApp", value: "+254 700 000 001", sub: "24/7 chat support" },
              { icon: MapPin, title: "Office", value: "Westlands, Nairobi", sub: "Visit by appointment" },
            ].map((c) => (
              <div key={c.title} className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-accent text-primary grid place-items-center shrink-0">
                    <c.icon className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{c.title}</div>
                    <div className="font-semibold mt-0.5">{c.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            <div className="p-8 rounded-2xl border border-border bg-card shadow-xl">
              {sent ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="size-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold">Message received</h3>
                  <p className="text-muted-foreground mt-2">Our team will reply to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <h3 className="text-xl font-semibold mb-2">Send us a message</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Full name" name="name" required />
                    <Field label="Work email" name="email" type="email" required />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Company" name="company" />
                    <Field label="Phone" name="phone" type="tel" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">How can we help?</label>
                    <select className="w-full h-11 px-3 rounded-md border border-border bg-background text-sm">
                      <option>General inquiry</option>
                      <option>Sales — POS</option>
                      <option>Sales — Hosting / VPS</option>
                      <option>Sales — SMS / WhatsApp</option>
                      <option>Support</option>
                      <option>Partnership</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Message</label>
                    <textarea
                      rows={5}
                      required
                      className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none"
                      placeholder="Tell us about your business and what you need…"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-[var(--gradient-primary)] text-primary-foreground text-sm font-semibold hover:shadow-lg transition"
                  >
                    Send message <Send className="size-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}{required && <span className="text-primary"> *</span>}</label>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full h-11 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
    </div>
  );
}
