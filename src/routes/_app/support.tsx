import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/support")({
  head: () => ({
    meta: [
      { title: "Support — ABANCOOL Command Center" },
      { name: "description", content: "Tickets, SLAs and live customer chat" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Support" description="Tickets, SLAs and live customer chat" icon={LifeBuoy} />
  ),
});
