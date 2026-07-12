import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/_shell/automation")({
  head: () => ({ meta: [{ title: "Automação — Padu Studios" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Zap}
      title="Automação"
      description="Fluxos automáticos: confirmação, lembrete 24h antes, pesquisa pós-ensaio, tudo via WhatsApp."
    />
  ),
});
