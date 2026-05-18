import { createFileRoute } from "@tanstack/react-router";
import { Plug } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — ABANCOOL Command Center" },
      { name: "description", content: "Third-party APIs, webhooks, Cloudflare" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Integrations" description="Third-party APIs, webhooks, Cloudflare" icon={Plug} />
  ),
});
