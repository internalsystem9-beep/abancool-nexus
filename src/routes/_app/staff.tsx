import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/staff")({
  head: () => ({
    meta: [
      { title: "Staff — ABANCOOL Command Center" },
      { name: "description", content: "Team management, roles, permissions, payroll" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Staff" description="Team management, roles, permissions, payroll" icon={UserCog} />
  ),
});
