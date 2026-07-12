import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Padu OS" },
      {
        name: "description",
        content:
          "Visão geral da Padu Studios: ocupação da semana, saldo do mês, agenda do dia e alertas de retenção.",
      },
    ],
  }),
  component: DashboardView,
});
