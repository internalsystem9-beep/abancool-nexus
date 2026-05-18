import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/sms")({
  head: () => ({
    meta: [
      { title: "Bulk SMS — ABANCOOL Command Center" },
      { name: "description", content: "Campaigns, delivery reports, sender IDs" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Bulk SMS" description="Campaigns, delivery reports, sender IDs" icon={Send} />
  ),
});
