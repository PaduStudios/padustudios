import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, MessageCircle, Phone, ArrowUpDown } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import { ClientEditDialog } from "./client-edit-dialog";
import type { Client } from "@/lib/scheduling/types";

type SortKey = "name-asc" | "name-desc" | "count-desc" | "count-asc" | "recent";

const SORT_LABELS: Record<SortKey, string> = {
  "name-asc": "Nome A → Z",
  "name-desc": "Nome Z → A",
  "count-desc": "Mais ensaios",
  "count-asc": "Menos ensaios",
  recent: "Cadastro recente",
};

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  // Use last 8 digits (the subscriber part) so variations in country code /
  // area code / trailing 9 all collapse into the same key.
  return digits.slice(-8);
}

export function ClientsView() {
  const { clients, appointments } = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [editing, setEditing] = useState<Client | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openEdit(c: Client) {
    setEditing(c);
    setDialogOpen(true);
  }

  const rows = useMemo(() => {
    // Group clients that share the same phone (normalized). Pick the most
    // "complete" record as the primary and aggregate ensaios across all
    // duplicates in the group.
    const groups = new Map<string, Client[]>();
    for (const c of clients) {
      const key = normalizePhone(c.phone) || `id:${c.id}`;
      const arr = groups.get(key);
      if (arr) arr.push(c);
      else groups.set(key, [c]);
    }

    const score = (c: Client) =>
      (c.band ? 2 : 0) + (c.email ? 1 : 0) + (c.cpf ? 1 : 0) + c.name.length / 100;

    const merged: { client: Client; count: number; aliases: number }[] = [];
    for (const group of groups.values()) {
      const primary = [...group].sort((a, b) => score(b) - score(a))[0];
      const ids = new Set(group.map((c) => c.id));
      const count = appointments.filter((a) => ids.has(a.clientId)).length;
      merged.push({ client: primary, count, aliases: group.length - 1 });
    }

    const filtered = q
      ? merged.filter(
          ({ client: c }) =>
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            (c.band ?? "").toLowerCase().includes(q.toLowerCase()) ||
            c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        )
      : merged;

    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
    filtered.sort((a, b) => {
      const nameA = (a.client.band || a.client.name).trim();
      const nameB = (b.client.band || b.client.name).trim();
      switch (sort) {
        case "name-asc":
          return collator.compare(nameA, nameB);
        case "name-desc":
          return collator.compare(nameB, nameA);
        case "count-desc":
          return b.count - a.count || collator.compare(nameA, nameB);
        case "count-asc":
          return a.count - b.count || collator.compare(nameA, nameB);
        case "recent":
          return b.client.createdAt.localeCompare(a.client.createdAt);
      }
    });
    return filtered;
  }, [clients, appointments, q, sort]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div>
          <p className="text-caption">Padu Studios</p>
          <h1 className="text-[15px] font-semibold tracking-tight">Clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <SortMenu value={sort} onChange={setSort} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente ou banda…"
              className="h-9 w-72 rounded-md border border-border bg-surface pl-8 pr-3 text-[12.5px] outline-none placeholder:text-muted-foreground focus:border-border-strong"
            />
          </div>
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
                  onClick={() => openEdit(c)}
                  className={cn(
                    "grid cursor-pointer grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_100px_120px] items-center gap-2 border-b border-border px-5 py-3.5 text-[13px] transition-colors last:border-b-0 hover:bg-surface-2/50",
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
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
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

      <ClientEditDialog
        client={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(SORT_LABELS) as SortKey[];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        {SORT_LABELS[value]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[170px] overflow-hidden rounded-md border border-border bg-surface shadow-lg">
            {keys.map((k) => (
              <button
                key={k}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-[12px] transition-colors hover:bg-surface-2",
                  value === k && "font-semibold text-primary"
                )}
              >
                {SORT_LABELS[k]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
