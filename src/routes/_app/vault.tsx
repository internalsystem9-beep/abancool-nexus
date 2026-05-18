import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  KeyRound, Lock, Eye, EyeOff, ShieldCheck, Folder,
  Mail, Server, Code2, FileLock2, Plus, Copy, Sparkles,
} from "lucide-react";
import { useState } from "react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/vault")({
  head: () => ({
    meta: [
      { title: "Password Vault — ABANCOOL Command Center" },
      { name: "description", content: "Encrypted credentials, SSH keys, API tokens" },
    ],
  }),
  component: VaultPage,
});

const folders = [
  { name: "All Items", icon: KeyRound, count: 248 },
  { name: "Email", icon: Mail, count: 42 },
  { name: "Hosting", icon: Server, count: 86 },
  { name: "SSH Keys", icon: Code2, count: 18 },
  { name: "API Keys", icon: FileLock2, count: 64 },
  { name: "Secure Notes", icon: Lock, count: 38 },
];

const entries = [
  { name: "admin@abancool.tech", folder: "Email", user: "admin@abancool.tech", strength: 92, updated: "2d" },
  { name: "WHM Root · node-01", folder: "Hosting", user: "root", strength: 98, updated: "8d" },
  { name: "Stripe Live Key", folder: "API Keys", user: "sk_live_••••8421", strength: 100, updated: "30d" },
  { name: "Daraja Consumer", folder: "API Keys", user: "abancool_prod", strength: 94, updated: "12d" },
  { name: "GitHub Deploy Key", folder: "SSH Keys", user: "id_ed25519", strength: 100, updated: "5d" },
  { name: "Cloudflare API", folder: "API Keys", user: "api@abancool", strength: 88, updated: "18d" },
];

function VaultPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="🔒 AES-256 · 2FA Enforced"
        title="Password Vault"
        description="Military-grade encrypted credentials, SSH keys and secure notes"
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" /> Generator
            </button>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> Add Entry
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Entries" value="248" icon={KeyRound} />
        <StatTile label="Strong Passwords" value="231" delta="93%" icon={ShieldCheck} tone="success" />
        <StatTile label="Weak / Reused" value="7" delta="rotate now" icon={Lock} tone="warning" />
        <StatTile label="Last Access" value="3m ago" delta="from 102.x.x.x" icon={Eye} />
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <Panel title="Folders">
          <div className="space-y-0.5">
            {folders.map((f, i) => (
              <button
                key={f.name}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition ${
                  i === 0 ? "bg-primary/10 text-primary border border-primary/30" : "hover:bg-secondary text-muted-foreground"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <f.icon className="size-4" /> {f.name}
                </span>
                <span className="text-[11px] font-mono">{f.count}</span>
              </button>
            ))}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Folder className="size-3.5" /> Custom folders
              </div>
              {["Internal Tools", "Client Vault", "Banking"].map((x) => (
                <button key={x} className="w-full text-left px-2.5 py-1.5 mt-1 text-sm rounded-md hover:bg-secondary text-muted-foreground">
                  {x}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Credentials" subtitle="Click an entry to reveal — audit trail logged">
          <div className="space-y-2">
            {entries.map((e, i) => (
              <VaultRow key={e.name} entry={e} index={i} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Password Generator">
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
          <div className="font-mono text-lg bg-black/40 border border-border rounded-lg px-4 py-3 truncate text-primary text-glow">
            x9$Kf2&amp;Hq@7nP!vR4mZ#wY8tBLcQe
          </div>
          <div className="flex gap-2">
            <button className="h-11 px-4 rounded-lg border border-border bg-secondary text-sm flex items-center gap-2">
              <Copy className="size-4" /> Copy
            </button>
            <button className="h-11 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Sparkles className="size-4" /> Regenerate
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
          {[["Length", "28"], ["Uppercase", "✓"], ["Numbers", "✓"], ["Symbols", "✓"]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-secondary/40">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-mono text-primary">{v}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function VaultRow({ entry, index }: { entry: typeof entries[number]; index: number }) {
  const [shown, setShown] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:border-primary/30 hover:shadow-[0_0_20px_-8px_oklch(0.72_0.18_235/0.4)] transition"
    >
      <div className="size-10 rounded-md bg-primary/10 grid place-items-center text-primary border border-primary/20">
        <KeyRound className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{entry.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{entry.user} · {entry.folder}</div>
      </div>
      <div className="hidden md:flex flex-col items-end gap-1 w-28">
        <div className="text-[10px] text-muted-foreground">Strength {entry.strength}%</div>
        <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full ${entry.strength > 90 ? "bg-success" : entry.strength > 70 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${entry.strength}%` }} />
        </div>
      </div>
      <div className="font-mono text-xs text-muted-foreground w-32 truncate hidden lg:block">
        {shown ? "TempPass2024!@#" : "••••••••••••••••"}
      </div>
      <button onClick={() => setShown((s) => !s)} className="size-8 grid place-items-center rounded hover:bg-secondary text-muted-foreground">
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button className="size-8 grid place-items-center rounded hover:bg-secondary text-muted-foreground">
        <Copy className="size-4" />
      </button>
    </motion.div>
  );
}
