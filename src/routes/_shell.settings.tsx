import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({ meta: [{ title: "Configurações — Padu OS" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Settings}
      title="Configurações"
      description="Perfil do estúdio, horários de funcionamento, salas, times e integrações."
    />
  ),
});
