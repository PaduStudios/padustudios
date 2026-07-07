import { createFileRoute } from "@tanstack/react-router";
import { CrmView } from "@/components/crm/crm-view";

export const Route = createFileRoute("/_shell/crm")({
  head: () => ({ meta: [{ title: "CRM — Padu OS" }] }),
  component: CrmView,
});
