import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_shell/finance")({
  head: () => ({ meta: [{ title: "Financeiro — Padu OS" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Wallet}
      title="Financeiro"
      description="Recebimentos, cobrança automática, relatórios por período e integração com Pix."
    />
  ),
});
