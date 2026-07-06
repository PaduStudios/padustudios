import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Guitar } from "lucide-react";

export const Route = createFileRoute("/_shell/equipment")({
  head: () => ({ meta: [{ title: "Equipamentos — Padu OS" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Guitar}
      title="Equipamentos"
      description="Inventário, manutenção e reserva de equipamentos por ensaio."
    />
  ),
});
