import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — ABANCOOL Command Center" },
      { name: "description", content: "Business API, bots and conversation analytics" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="WhatsApp" description="Business API, bots and conversation analytics" icon={MessageSquare} />
  ),
});
