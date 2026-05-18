import { createFileRoute } from "@tanstack/react-router";
import { Terminal } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/devops")({
  head: () => ({
    meta: [
      { title: "DevOps — ABANCOOL Command Center" },
      { name: "description", content: "Docker, deployments, server health, cron" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="DevOps" description="Docker, deployments, server health, cron" icon={Terminal} />
  ),
});
