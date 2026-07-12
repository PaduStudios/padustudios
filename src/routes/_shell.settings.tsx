import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({ meta: [{ title: "Configurações — Padu Studios" }] }),
  component: () => <Outlet />,
});
