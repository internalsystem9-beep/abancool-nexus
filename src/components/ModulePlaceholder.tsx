import { motion } from "framer-motion";
import { Construction } from "lucide-react";

export function ModulePlaceholder({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-12 text-center relative overflow-hidden grid-bg"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="size-16 rounded-2xl bg-primary/10 grid place-items-center text-primary mx-auto mb-4 glow-blue">
          <Icon className="size-8" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-semibold">Module ready for wiring</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
          UI scaffolded. Connect your REST API endpoints, JWT auth, and database
          to bring this module online.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs font-mono text-primary border border-primary/30 rounded-md px-3 py-1.5 bg-primary/5">
          <span className="size-1.5 rounded-full bg-primary animate-pulse-glow" />
          AWAITING BACKEND CONNECTION
        </div>
      </motion.div>
    </div>
  );
}
