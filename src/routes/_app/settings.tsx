import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Building2, Palette, Mail, Shield, Bell, Code2, Globe2, DatabaseBackup, KeyRound,
} from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ABANCOOL Command Center" },
      { name: "description", content: "Enterprise configuration and preferences" },
    ],
  }),
  component: SettingsPage,
});

const sections = [
  { id: "company", label: "Company Profile", icon: Building2 },
  { id: "brand", label: "Branding", icon: Palette },
  { id: "smtp", label: "SMTP / Email", icon: Mail },
  { id: "security", label: "Security", icon: Shield },
  { id: "notif", label: "Notifications", icon: Bell },
  { id: "api", label: "API Settings", icon: Code2 },
  { id: "locale", label: "Localization", icon: Globe2 },
  { id: "backup", label: "Backups", icon: DatabaseBackup },
] as const;

function SettingsPage() {
  const [active, setActive] = useState<typeof sections[number]["id"]>("security");
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Enterprise configuration · roles · security" badge="Workspace" actions={<span />} />

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <Panel>
          <div className="space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition ${
                  active === s.id ? "bg-primary text-primary-foreground glow-blue" : "hover:bg-secondary text-muted-foreground"
                }`}
              >
                <s.icon className="size-4" />
                {s.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          {active === "security" && (
            <div className="space-y-5">
              <SectionHeader icon={Shield} title="Security" sub="Authentication, sessions and access" />
              <Toggle label="Enforce 2FA for all staff" sub="Require authenticator app on every login" defaultOn />
              <Toggle label="Force password rotation" sub="Every 90 days for admin roles" defaultOn />
              <Toggle label="Session timeout" sub="Auto-logout after 30 minutes idle" defaultOn />
              <Toggle label="IP allowlist for admin" sub="Limit /admin to office VPN ranges" />
              <Toggle label="Device authorization" sub="Email approval for new devices" defaultOn />
              <div className="grid md:grid-cols-2 gap-3 pt-2">
                <Field label="Max login attempts" value="5" />
                <Field label="Lockout duration (min)" value="15" />
                <Field label="OTP TTL (minutes)" value="10" />
                <Field label="JWT TTL (hours)" value="24" />
              </div>
              <div className="pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound className="size-3.5 text-primary" /> Master encryption key rotated 14 days ago
              </div>
            </div>
          )}
          {active === "company" && (
            <div className="space-y-5">
              <SectionHeader icon={Building2} title="Company Profile" sub="Public information used on invoices and emails" />
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Company Name" value="ABANCOOL TECHNOLOGY" />
                <Field label="Registration No." value="PVT-XYZA1234567" />
                <Field label="Email" value="hello@abancool.tech" />
                <Field label="Phone" value="+254 711 200 100" />
                <Field label="KRA PIN" value="P051000000A" />
                <Field label="Currency" value="KES" />
              </div>
            </div>
          )}
          {active === "smtp" && (
            <div className="space-y-5">
              <SectionHeader icon={Mail} title="SMTP / Email" sub="Outgoing transactional mail" />
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Host" value="smtp.abancool.tech" />
                <Field label="Port" value="587" />
                <Field label="Username" value="noreply@abancool.tech" />
                <Field label="From Name" value="ABANCOOL" />
              </div>
              <Toggle label="Use TLS" defaultOn />
              <button className="h-9 px-3.5 rounded-md border border-primary/40 bg-primary/10 text-primary text-sm font-medium">Send Test Email</button>
            </div>
          )}
          {active === "brand" && (
            <div className="space-y-5">
              <SectionHeader icon={Palette} title="Branding" sub="Theme and identity" />
              <Toggle label="Dark theme" defaultOn />
              <Toggle label="Electric blue accent" defaultOn />
              <Toggle label="Show logo in emails" defaultOn />
            </div>
          )}
          {active === "notif" && (
            <div className="space-y-5">
              <SectionHeader icon={Bell} title="Notifications" sub="What you get pinged about" />
              <Toggle label="New ticket created" defaultOn />
              <Toggle label="Payment received" defaultOn />
              <Toggle label="Domain expiring (≤14d)" defaultOn />
              <Toggle label="VPS CPU > 90%" defaultOn />
              <Toggle label="Failed cron job" defaultOn />
            </div>
          )}
          {active === "api" && (
            <div className="space-y-5">
              <SectionHeader icon={Code2} title="API Settings" sub="Public REST API" />
              <Field label="Base URL" value="https://api.abancool.tech/v1" />
              <Field label="Rate Limit (req/min)" value="240" />
              <Toggle label="Require API key" defaultOn />
              <Toggle label="Log every request" defaultOn />
            </div>
          )}
          {active === "locale" && (
            <div className="space-y-5">
              <SectionHeader icon={Globe2} title="Localization" />
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Default Language" value="English (EN)" />
                <Field label="Timezone" value="Africa/Nairobi" />
                <Field label="Date Format" value="DD MMM YYYY" />
                <Field label="Currency" value="KES" />
              </div>
            </div>
          )}
          {active === "backup" && (
            <div className="space-y-5">
              <SectionHeader icon={DatabaseBackup} title="Backups" sub="Automated database and file backups" />
              <Toggle label="Daily DB backup" defaultOn />
              <Toggle label="Weekly full system backup" defaultOn />
              <Toggle label="Encrypt backups (AES-256)" defaultOn />
              <Field label="Retention (days)" value="30" />
              <div className="text-xs text-muted-foreground">Last backup: 02:00 EAT · 2.4 GB · OK</div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-border">
      <div className="size-9 rounded-lg bg-primary/10 grid place-items-center text-primary"><Icon className="size-4" /></div>
      <div>
        <div className="font-semibold">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input defaultValue={value} className="mt-1 w-full h-10 rounded-md bg-secondary/60 border border-border px-3 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

function Toggle({ label, sub, defaultOn }: { label: string; sub?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/60 last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition ${on ? "bg-primary glow-blue" : "bg-secondary border border-border"}`}
      >
        <motion.span
          layout
          className={`absolute top-0.5 size-5 rounded-full bg-card ${on ? "right-0.5" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
