import { createFileRoute } from "@tanstack/react-router";
import { FolderArchive } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/files")({
  head: () => ({
    meta: [
      { title: "File Manager — ABANCOOL Command Center" },
      { name: "description", content: "Secure storage with permissions and previews" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="File Manager" description="Secure storage with permissions and previews" icon={FolderArchive} />
  ),
});
