import { createFileRoute } from "@tanstack/react-router";
import { ImportWizard } from "@/components/import/import-wizard";

export const Route = createFileRoute("/_shell/settings/import")({
  head: () => ({
    meta: [
      { title: "Importar do SuperSaaS — Padu Studios" },
      {
        name: "description",
        content:
          "Importe clientes e histórico de agendamentos do SuperSaaS via CSV.",
      },
    ],
  }),
  component: ImportWizard,
});
