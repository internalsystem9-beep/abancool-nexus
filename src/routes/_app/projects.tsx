import { createFileRoute } from "@tanstack/react-router";
import { FolderGit2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({
    meta: [
      { title: "Projects — ABANCOOL Command Center" },
      { name: "description", content: "Development pipeline and delivery tracking" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Projects" description="Development pipeline and delivery tracking" icon={FolderGit2} />
  ),
});
