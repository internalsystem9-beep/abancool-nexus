import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Check, X, Loader2 } from "lucide-react";
import { PageHero, Section } from "@/components/public/marketing";

export const Route = createFileRoute("/_public/domains")({
  head: () => ({
    meta: [
      { title: "Domain Search — Register & Transfer | ABANCOOL" },
      { name: "description", content: "Find your perfect domain. Register .com, .co.ke, .africa and 400+ TLDs with free WHOIS privacy." },
      { property: "og:title", content: "ABANCOOL Domains" },
      { property: "og:url", content: "/domains" },
    ],
    links: [{ rel: "canonical", href: "/domains" }],
  }),
  component: DomainsPage,
});

const tlds = [
  { tld: ".com", price: "1,499" },
  { tld: ".co.ke", price: "1,200" },
  { tld: ".africa", price: "2,100" },
  { tld: ".io", price: "5,400" },
  { tld: ".net", price: "1,800" },
  { tld: ".org", price: "1,700" },
  { tld: ".app", price: "2,800" },
  { tld: ".dev", price: "2,600" },
];

type Result = { domain: string; available: boolean; price: string };

function DomainsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const base = query.trim().toLowerCase().replace(/\s+/g, "-").replace(/\.[a-z.]+$/, "");
    if (!base) return;
    setLoading(true);
    setResults([]);
    setTimeout(() => {
      // simulated availability — deterministic
      const r = tlds.map((t) => ({
        domain: `${base}${t.tld}`,
        available: (base.length + t.tld.length) % 3 !== 0,
        price: t.price,
      }));
      setResults(r);
      setLoading(false);
    }, 700);
  }

  return (
    <>
      <PageHero
        eyebrow="Domains"
        title={<>Claim your <span className="gradient-text">presence online</span></>}
        description="Search across 400+ TLDs. Free WHOIS privacy on every registration. Bundle with hosting and save."
      />

      <Section className="!py-12">
        <form onSubmit={search} className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border shadow-lg">
            <Search className="size-5 text-muted-foreground ml-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="yourbusiness"
              className="flex-1 bg-transparent outline-none text-base px-2 py-3"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[var(--gradient-primary)] text-primary-foreground text-sm font-semibold hover:shadow-lg transition flex items-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
            Popular: {["mybiz", "shopkenya", "myrestaurant"].map((s) => (
              <button key={s} type="button" onClick={() => setQuery(s)} className="px-2 py-1 rounded-md bg-accent hover:bg-accent/80">{s}</button>
            ))}
          </div>
        </form>

        {results.length > 0 && (
          <div className="mt-10 max-w-3xl mx-auto space-y-2">
            {results.map((r) => (
              <div key={r.domain} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 min-w-0">
                  {r.available ? (
                    <Check className="size-5 text-green-600 shrink-0" />
                  ) : (
                    <X className="size-5 text-red-500 shrink-0" />
                  )}
                  <span className="font-medium truncate">{r.domain}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">
                    {r.available ? <><span className="text-muted-foreground">KES </span><span className="font-semibold">{r.price}</span><span className="text-muted-foreground">/yr</span></> : <span className="text-muted-foreground text-sm">Taken</span>}
                  </span>
                  {r.available && (
                    <button className="px-3 py-1.5 rounded-md bg-[var(--gradient-primary)] text-primary-foreground text-xs font-semibold">
                      Register
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="bg-secondary/30 border-t border-border">
        <Section>
          <h2 className="text-2xl font-bold text-center mb-8">Popular TLD pricing</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {tlds.map((t) => (
              <div key={t.tld} className="p-5 rounded-xl border border-border bg-card flex items-baseline justify-between">
                <span className="text-lg font-semibold">{t.tld}</span>
                <span className="text-sm"><span className="text-muted-foreground">KES </span><span className="font-bold">{t.price}</span><span className="text-muted-foreground">/yr</span></span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
