import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Bell, Search, Command } from "lucide-react";

export function AppShell() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/70 backdrop-blur-xl flex items-center gap-4 px-6">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search clients, domains, invoices…"
              className="w-full h-10 rounded-md bg-secondary/60 border border-border pl-10 pr-20 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
              <Command className="size-3" /> K
            </kbd>
          </div>
          <button className="relative size-10 grid place-items-center rounded-md hover:bg-secondary/60 transition">
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-primary animate-pulse-glow" />
          </button>
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="size-2 rounded-full bg-success" />
            <span className="text-muted-foreground">All systems operational</span>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
