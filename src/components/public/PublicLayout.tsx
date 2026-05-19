import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ArrowRight, Zap } from "lucide-react";

const nav = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/pos", label: "POS" },
  { to: "/pricing", label: "Pricing" },
  { to: "/domains", label: "Domains" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/faq", label: "FAQ" },
] as const;

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="theme-light min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-lg grid place-items-center bg-[var(--gradient-primary)] text-primary-foreground">
              <Zap className="size-4" />
            </div>
            <span className="tracking-tight text-lg">ABANCOOL</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-2 text-sm rounded-md transition ${
                    active
                      ? "text-primary bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-foreground hover:text-primary"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md bg-[var(--gradient-primary)] text-primary-foreground shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
            >
              Get started <ArrowRight className="size-3.5" />
            </Link>
            <button
              className="lg:hidden p-2 rounded-md hover:bg-accent"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden border-t border-border bg-background">
            <div className="px-6 py-3 flex flex-col gap-1">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-sm rounded-md hover:bg-accent"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-secondary/40 mt-24">
        <div className="mx-auto max-w-7xl px-6 py-14 grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <div className="size-8 rounded-lg grid place-items-center bg-[var(--gradient-primary)] text-primary-foreground">
                <Zap className="size-4" />
              </div>
              <span className="text-lg tracking-tight">ABANCOOL</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm">
              Africa's all-in-one business operating system. Hosting, POS, SMS,
              VPS, WhatsApp APIs, payments and automation — in one platform.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["/services", "Services"],
              ["/pos", "POS"],
              ["/pricing", "Pricing"],
              ["/domains", "Domains"],
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              ["/about", "About"],
              ["/contact", "Contact"],
              ["/faq", "FAQ"],
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              ["/login", "Sign in"],
              ["/login", "Get started"],
              ["/dashboard", "Dashboard"],
            ]}
          />
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} ABANCOOL Technology. All rights reserved.</span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-green-500" />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">{title}</div>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to + label}>
            <Link to={to} className="text-sm text-muted-foreground hover:text-primary">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
