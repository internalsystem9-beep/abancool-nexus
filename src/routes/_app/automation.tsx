import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/automation")({
  head: () => ({
    meta: [
      { title: "Automation — ABANCOOL Command Center" },
      { name: "description", content: "Workflow builder, schedulers, triggers" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Automation" description="Workflow builder, schedulers, triggers" icon={Workflow} />
  ),
});
