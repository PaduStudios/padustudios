import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, MessageCircle, Phone } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

export function ClientsView() {
  const { clients, appointments } = useStore();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const filtered = q
      ? clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            (c.band ?? "").toLowerCase().includes(q.toLowerCase()) ||
            c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        )
      : clients;
    return filtered.map((c) => ({
      client: c,
      count: appointments.filter((a) => a.clientId === c.id).length,
    }));
  }, [clients, appointments, q]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div>
          <p className="text-caption">Padu OS</p>
          <h1 className="text-[15px] font-semibold tracking-tight">Clientes</h1>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente ou banda…"
            className="h-9 w-72 rounded-md border border-border bg-surface pl-8 pr-3 text-[12.5px] outline-none placeholder:text-muted-foreground focus:border-border-strong"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="surface-panel overflow-hidden"
        >
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_100px_120px] border-b border-border px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Banda / Cliente</span>
            <span>Telefone</span>
            <span>Origem</span>
            <span className="text-right">Ensaios</span>
            <span className="text-right">Ações</span>
          </div>
          <ul>
            {rows.map(({ client: c, count }, i) => {
              const initials = (c.band || c.name)
                .split(" ")
                .slice(0, 2)
                .map((s) => s[0])
                .join("")
                .toUpperCase();
              return (
                <li
                  key={c.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_100px_120px] items-center gap-2 border-b border-border px-5 py-3.5 text-[13px] transition-colors last:border-b-0 hover:bg-surface-2/50",
                    i % 2 === 1 && "bg-surface-2/20"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-3 text-[11px] font-bold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {c.band || c.name}
                      </p>
                      {c.band && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="truncate font-mono text-[12px]">{c.phone}</span>
                  <span className="text-[11.5px] capitalize text-muted-foreground">
                    {c.origin}
                  </span>
                  <span className="flex items-center justify-end gap-1 tabular-nums">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    {count}
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface transition-colors hover:border-primary/40 hover:text-primary"
                      title="WhatsApp"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </a>
                    <a
                      href={`tel:${c.phone}`}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface transition-colors hover:text-foreground"
                      title="Ligar"
                    >
                      <Phone className="h-3 w-3" />
                    </a>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="px-5 py-12 text-center text-[13px] text-muted-foreground">
                Nenhum cliente encontrado.
              </li>
            )}
          </ul>
        </motion.div>
      </div>
    </>
  );
}
