import { createFileRoute } from "@tanstack/react-router";
import { Server } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/hosting")({
  head: () => ({
    meta: [
      { title: "Hosting — ABANCOOL Command Center" },
      { name: "description", content: "cPanel, WHMCS and shared hosting accounts" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Hosting" description="cPanel, WHMCS and shared hosting accounts" icon={Server} />
  ),
});
