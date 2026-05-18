import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/domains")({
  head: () => ({
    meta: [
      { title: "Domains — ABANCOOL Command Center" },
      { name: "description", content: "Registrations, renewals and DNS control" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Domains" description="Registrations, renewals and DNS control" icon={Globe} />
  ),
});
