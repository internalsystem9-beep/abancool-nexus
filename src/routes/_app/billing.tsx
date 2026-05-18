import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({
    meta: [
      { title: "Billing — ABANCOOL Command Center" },
      { name: "description", content: "Invoices, M-Pesa STK push, IntaSend, Paystack" },
    ],
  }),
  component: () => (
    <ModulePlaceholder title="Billing" description="Invoices, M-Pesa STK push, IntaSend, Paystack" icon={Receipt} />
  ),
});
