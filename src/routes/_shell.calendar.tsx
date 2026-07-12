import { createFileRoute } from "@tanstack/react-router";
import { CalendarView } from "@/components/calendar/calendar-view";

export const Route = createFileRoute("/_shell/calendar")({
  head: () => ({
    meta: [
      { title: "Calendário — Padu Studios" },
      {
        name: "description",
        content:
          "Agenda semanal inteligente da Padu Studios: disponibilidade, ensaios e clientes.",
      },
    ],
  }),
  component: CalendarView,
});
