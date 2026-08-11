import { createFileRoute } from "@tanstack/react-router";
import { InternalAgendaView } from "@/components/internal/internal-agenda-view";

export const Route = createFileRoute("/_shell/internal")({
  head: () => ({
    meta: [
      { title: "Agenda Interna — Padu Studios" },
      {
        name: "description",
        content:
          "Agenda interna da equipe Padu Studios: tarefas e obrigações de Padu, Flávio, Guma e Luísa.",
      },
      { property: "og:title", content: "Agenda Interna — Padu Studios" },
      {
        property: "og:description",
        content: "Coordenação de tarefas da equipe do Padu Studios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InternalAgendaView,
});
