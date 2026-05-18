import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/clients")({
  head: () => ({
    meta: [
      { title: "Clients — ABANCOOL Command Center" },
      { name: "description", content: "CRM and customer intelligence" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Clients" description="CRM and customer intelligence" icon={Users} />
  ),
});
