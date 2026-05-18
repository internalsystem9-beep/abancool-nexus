import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, FolderGit2, Server, Globe, HardDrive,
  KeyRound, FolderArchive, Receipt, MessageSquare, Send, LifeBuoy,
  UserCog, Workflow, Terminal, Plug, Settings, LogOut, Zap,
} from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", to: "/clients", icon: Users },
  { label: "Projects", to: "/projects", icon: FolderGit2 },
  { label: "Hosting", to: "/hosting", icon: Server },
  { label: "Domains", to: "/domains", icon: Globe },
  { label: "VPS", to: "/vps", icon: HardDrive },
  { label: "Password Vault", to: "/vault", icon: KeyRound },
  { label: "File Manager", to: "/files", icon: FolderArchive },
  { label: "Billing", to: "/billing", icon: Receipt },
  { label: "Bulk SMS", to: "/sms", icon: Send },
  { label: "WhatsApp", to: "/whatsapp", icon: MessageSquare },
  { label: "Support", to: "/support", icon: LifeBuoy },
  { label: "Staff", to: "/staff", icon: UserCog },
  { label: "Automation", to: "/automation", icon: Workflow },
  { label: "DevOps", to: "/devops", icon: Terminal },
  { label: "Integrations", to: "/integrations", icon: Plug },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
      {/* Brand */}
      <div className="px-6 pt-6 pb-5 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="size-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-[0_0_24px_-4px_oklch(0.72_0.18_235/0.6)]">
              <Zap className="size-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-wider text-primary text-glow">ABANCOOL</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Command Center</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
        {items.map((item) => {
          const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-[0_0_20px_-6px_oklch(0.72_0.18_235/0.7)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="active-sidebar"
                  className="absolute inset-0 rounded-md bg-primary -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3 space-y-1">
        <div className="flex items-center gap-3 rounded-md px-2 py-2.5">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground font-bold text-sm">
            A
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Admin</div>
            <div className="text-[11px] text-muted-foreground truncate">admin@abancool.tech</div>
          </div>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          Logout
        </Link>
      </div>
    </aside>
  );
}
