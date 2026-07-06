import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_shell/crm")({
  head: () => ({ meta: [{ title: "CRM — Padu OS" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Sparkles}
      title="CRM"
      description="Pipeline de leads, follow-up automatizado por WhatsApp e histórico completo de cada banda."
    />
  ),
});
