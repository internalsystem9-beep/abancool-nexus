import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Globe, ShieldCheck, RefreshCw, Search, Plus, AlertTriangle } from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/domains")({
  head: () => ({
    meta: [
      { title: "Domains — ABANCOOL Command Center" },
      { name: "description", content: "Domain registrations, DNS, SSL and renewals" },
    ],
  }),
  component: DomainsPage,
});

const domains = [
  { name: "safaritours.co.ke", reg: "KENIC", expires: "2026-04-12", ssl: true, dns: "Cloudflare", days: 12 },
  { name: "kenyatech.co.ke", reg: "KENIC", expires: "2026-08-30", ssl: true, dns: "Route53", days: 138 },
  { name: "mombasalog.com", reg: "Namecheap", expires: "2026-04-04", ssl: false, dns: "Cloudflare", days: 4 },
  { name: "nbimedical.co.ke", reg: "KENIC", expires: "2026-11-22", ssl: true, dns: "Cloudflare", days: 222 },
  { name: "coastrealty.co.ke", reg: "KENIC", expires: "2026-03-18", ssl: false, dns: "—", days: -2 },
  { name: "agricorp.ke", reg: "KENIC", expires: "2026-09-01", ssl: true, dns: "Cloudflare", days: 140 },
];

function DomainsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="Registrar sync · 8m ago"
        title="Domains"
        description="WHOIS, DNS, SSL monitoring and renewal automation"
        actions={
          <>
            <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm">
              <Search className="size-3.5 text-muted-foreground" />
              <input className="bg-transparent outline-none w-44 text-sm placeholder:text-muted-foreground" placeholder="Search domains…" />
            </div>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> Register
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Active Domains" value="934" delta="+12" icon={Globe} />
        <StatTile label="SSL Secured" value="891" delta="95%" icon={ShieldCheck} tone="success" />
        <StatTile label="Expiring 30d" value="23" delta="auto-renew on" icon={RefreshCw} tone="warning" />
        <StatTile label="Expired" value="2" delta="needs attention" icon={AlertTriangle} tone="destructive" />
      </div>

      <Panel title="Domain Registry" subtitle="Status, registrar, SSL and expiry">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-2 py-3 font-medium">Domain</th>
                <th className="px-2 py-3 font-medium hidden md:table-cell">Registrar</th>
                <th className="px-2 py-3 font-medium hidden lg:table-cell">DNS</th>
                <th className="px-2 py-3 font-medium">SSL</th>
                <th className="px-2 py-3 font-medium">Expires</th>
                <th className="px-2 py-3 font-medium">Countdown</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d, i) => {
                const expired = d.days < 0;
                const urgent = d.days >= 0 && d.days < 14;
                return (
                  <motion.tr
                    key={d.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/60 hover:bg-secondary/40"
                  >
                    <td className="px-2 py-3 font-medium flex items-center gap-2">
                      <Globe className="size-4 text-primary" /> {d.name}
                    </td>
                    <td className="px-2 py-3 hidden md:table-cell text-muted-foreground">{d.reg}</td>
                    <td className="px-2 py-3 hidden lg:table-cell text-muted-foreground">{d.dns}</td>
                    <td className="px-2 py-3">
                      <Badge tone={d.ssl ? "success" : "destructive"}>{d.ssl ? "valid" : "expired"}</Badge>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs">{d.expires}</td>
                    <td className="px-2 py-3">
                      <span className={`text-xs font-mono ${expired ? "text-destructive" : urgent ? "text-warning" : "text-muted-foreground"}`}>
                        {expired ? `${Math.abs(d.days)}d overdue` : `${d.days}d`}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="DNS Records" subtitle="safaritours.co.ke">
          <div className="space-y-1.5 font-mono text-xs">
            {[
              ["A", "@", "104.21.78.12", "Auto"],
              ["A", "www", "104.21.78.12", "Auto"],
              ["MX", "@", "mail.safaritours.co.ke", "10"],
              ["TXT", "@", "v=spf1 include:_spf...", "Auto"],
              ["CNAME", "shop", "shopify-store.myshopify.com", "Auto"],
            ].map((r, i) => (
              <div key={i} className="grid grid-cols-[60px_80px_1fr_60px] gap-2 px-2 py-1.5 rounded border border-border/60 hover:bg-secondary/40">
                <Badge tone="primary">{r[0]}</Badge>
                <span className="text-muted-foreground">{r[1]}</span>
                <span className="truncate">{r[2]}</span>
                <span className="text-muted-foreground text-right">{r[3]}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="WHOIS" subtitle="safaritours.co.ke">
          <div className="space-y-2 text-sm">
            {[
              ["Registrar", "KENIC"],
              ["Registered", "2019-04-12"],
              ["Expires", "2026-04-12"],
              ["Owner", "Safari Tours Ltd"],
              ["Nameservers", "ns1.cloudflare.com, ns2.cloudflare.com"],
              ["DNSSEC", "Signed"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
                <span className="text-muted-foreground text-xs">{k}</span>
                <span className="text-xs font-mono text-right truncate">{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
