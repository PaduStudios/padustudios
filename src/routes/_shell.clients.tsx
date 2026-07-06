import { createFileRoute } from "@tanstack/react-router";
import { ClientsView } from "@/components/clients/clients-view";

export const Route = createFileRoute("/_shell/clients")({
  head: () => ({ meta: [{ title: "Clientes — Padu OS" }] }),
  component: ClientsView,
});
