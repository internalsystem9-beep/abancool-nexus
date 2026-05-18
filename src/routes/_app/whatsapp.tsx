import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageSquare, Send, CheckCheck, Bot, Plus, Paperclip, Smile } from "lucide-react";
import { PageHeader, StatTile, Panel, Badge } from "@/components/PageHeader";

export const Route = createFileRoute("/_app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — ABANCOOL Command Center" },
      { name: "description", content: "WhatsApp Business conversations, bots and broadcasts" },
    ],
  }),
  component: WhatsAppPage,
});

const conversations = [
  { name: "Safari Tours Ltd", last: "Backup restored ✓", t: "2m", unread: 0, online: true },
  { name: "Kenya Tech Hub", last: "Can we schedule a call?", t: "14m", unread: 3, online: true },
  { name: "Nairobi Medical", last: "Invoice received, thanks", t: "1h", unread: 0, online: false },
  { name: "AgriCorp Kenya", last: "👍", t: "3h", unread: 0, online: false },
  { name: "Mombasa Logistics", last: "Domain transfer status?", t: "5h", unread: 1, online: false },
];

const chat = [
  { from: "them", msg: "Hi! Quick question about our VPS", t: "10:42" },
  { from: "me", msg: "Hey Sam — happy to help, what's up?", t: "10:43" },
  { from: "them", msg: "We're seeing high CPU on node-02. Is something running?", t: "10:43" },
  { from: "me", msg: "Checking now. Looks like the backup cron is running — should be done in ~8 minutes.", t: "10:45" },
  { from: "them", msg: "Perfect, thanks for the quick response 🙌", t: "10:46" },
];

function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="WhatsApp Business · Cloud API"
        title="WhatsApp Center"
        description="Conversations, bots, broadcasts and customer engagement"
        actions={
          <>
            <button className="h-9 px-3 rounded-md border border-border bg-secondary/60 text-sm flex items-center gap-2">
              <Bot className="size-3.5" /> Bots
            </button>
            <button className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Plus className="size-3.5" /> Broadcast
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Messages (24h)" value="12,420" delta="+8%" icon={MessageSquare} />
        <StatTile label="Active Chats" value="284" delta="42 unread" icon={Send} tone="primary" />
        <StatTile label="Bot Resolved" value="68%" delta="auto-handled" icon={Bot} tone="success" />
        <StatTile label="Avg Response" value="2.4m" delta="-32s" icon={CheckCheck} tone="success" />
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[640px]">
        {/* Conversations list */}
        <Panel title="Conversations" subtitle="Live">
          <div className="space-y-1">
            {conversations.map((c, i) => (
              <motion.button
                key={c.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition ${i === 1 ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary"}`}
              >
                <div className="relative">
                  <div className="size-10 rounded-full bg-gradient-to-br from-primary/30 to-primary-glow/10 grid place-items-center text-primary text-xs font-bold border border-primary/20">
                    {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  {c.online && <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success border-2 border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold truncate">{c.name}</div>
                    <span className="text-[10px] text-muted-foreground font-mono">{c.t}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground truncate">{c.last}</div>
                    {c.unread > 0 && (
                      <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{c.unread}</span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </Panel>

        {/* Chat view */}
        <div className="glass rounded-2xl flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="size-10 rounded-full bg-gradient-to-br from-primary/30 to-primary-glow/10 grid place-items-center text-primary text-xs font-bold border border-primary/20">KT</div>
            <div className="flex-1">
              <div className="font-semibold">Kenya Tech Hub</div>
              <div className="text-[11px] text-success flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> Online</div>
            </div>
            <Badge tone="primary">VIP</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chat.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "me" ? "bg-primary text-primary-foreground rounded-br-sm glow-blue" : "bg-secondary rounded-bl-sm"}`}>
                  <div>{m.msg}</div>
                  <div className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {m.t} {m.from === "me" && <CheckCheck className="size-3" />}
                  </div>
                </div>
              </motion.div>
            ))}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" />
                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.15s" }} />
                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.3s" }} />
              </span>
              typing…
            </div>
          </div>
          <div className="p-3 border-t border-border flex items-center gap-2">
            <button className="size-9 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground"><Paperclip className="size-4" /></button>
            <input className="flex-1 h-10 bg-secondary/60 border border-border rounded-md px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60" placeholder="Type a message…" />
            <button className="size-9 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground"><Smile className="size-4" /></button>
            <button className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 glow-blue">
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
