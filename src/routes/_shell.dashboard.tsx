import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Padu OS" }] }),
  component: () => (
    <ModulePlaceholder
      icon={LayoutGrid}
      title="Dashboard"
      description="Visão geral da operação: ocupação, receita, próximos ensaios e alertas em tempo real."
    />
  ),
});
