import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Settings as SettingsIcon, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_shell/settings/")({
  head: () => ({
    meta: [{ title: "Configurações — Padu OS" }],
  }),
  component: SettingsIndex,
});

function SettingsIndex() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-muted text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Configurações</h1>
          <p className="text-[13px] text-muted-foreground">
            Perfil do estúdio, integrações e importação de dados.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/settings/import"
          className="surface-panel group flex items-start gap-3 p-5 transition-colors hover:border-primary/40"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-muted text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[14px] font-semibold">Importar do SuperSaaS</h2>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Traga seus clientes e o histórico de ensaios em CSV. Faz dedupe
              por telefone e preenche o calendário automaticamente.
            </p>
          </div>
        </Link>

        <div className="surface-panel flex items-start gap-3 p-5 opacity-60">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-muted-foreground">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold">Perfil do estúdio</h2>
              <span className="rounded-sm border border-border px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                em breve
              </span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Nome, salas, horário de funcionamento e políticas de cancelamento.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
