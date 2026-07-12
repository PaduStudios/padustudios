import { createFileRoute } from "@tanstack/react-router";
import { FinanceView } from "@/components/finance/finance-view";

export const Route = createFileRoute("/_shell/finance")({
  head: () => ({
    meta: [
      { title: "Financeiro — Padu Studios" },
      {
        name: "description",
        content:
          "Fluxo de caixa da Padu Studios: receita por ensaio, saídas manuais e saldo mensal.",
      },
    ],
  }),
  component: FinanceView,
});
