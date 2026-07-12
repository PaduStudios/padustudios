import { createFileRoute } from "@tanstack/react-router";
import { AutomationView } from "@/components/automation/automation-view";

export const Route = createFileRoute("/_shell/automation")({
  head: () => ({ meta: [{ title: "Automação — Padu Studios" }] }),
  component: AutomationView,
});
