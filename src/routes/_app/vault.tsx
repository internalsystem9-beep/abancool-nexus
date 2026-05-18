import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/vault")({
  head: () => ({
    meta: [
      { title: "Password Vault — ABANCOOL Command Center" },
      { name: "description", content: "AES-256 encrypted secrets, SSH keys, API tokens" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Password Vault" description="AES-256 encrypted secrets, SSH keys, API tokens" icon={KeyRound} />
  ),
});
