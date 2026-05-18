import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ABANCOOL Command Center" },
      { name: "description", content: "Workspace, security, branding, billing" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Settings" description="Workspace, security, branding, billing" icon={Settings} />
  ),
});
