import { createFileRoute } from "@tanstack/react-router";
import { HardDrive } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/vps")({
  head: () => ({
    meta: [
      { title: "VPS — ABANCOOL Command Center" },
      { name: "description", content: "Virtual private server fleet and monitoring" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="VPS" description="Virtual private server fleet and monitoring" icon={HardDrive} />
  ),
});
