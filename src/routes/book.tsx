import { createFileRoute } from "@tanstack/react-router";
import { PublicBooking } from "@/components/public-booking";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Agende seu ensaio — Padu Studios" },
      {
        name: "description",
        content:
          "Reserve seu horário na Padu Studios. Selecione a data, o horário e confirme em segundos.",
      },
    ],
  }),
  component: PublicBooking,
});
