import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  MessageCircle,
  Phone,
  Plus,
  ChevronDown,
  Calendar,
  Clock,
} from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { store } from "@/lib/scheduling/store";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/scheduling/types";

type Tab = "pipeline" | "clientes";
type LeadStatus = Lead["status"];

const COLUMNS: { key: LeadStatus; label: string; accent: string }[] = [
  { key: "open",      label: "Abertos",    accent: "text-primary border-primary/30" },
  { key: "converted", label: "Convertidos", accent: "text-green-500 border-green-500/30" },
  { key: "lost",      label: "Perdidos",    accent: "text-destructive border-destructive/30" },
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  open: "Aberto",
  converted: "Convertido",
  lost: "Perdido",
};

function LeadCard({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);

  function moveTo(status: LeadStatus) {
    store.addLead; // already exists — update via direct state patch
    // We update by replacing the lead in the store
    const current = store.getSnapshot();
    const updated = current.leads.map((l) =>
      l.id === lead.id ? { ...l, status } : l
    );
    // Persist via internal method
    (store as any)._setState?.({ ...current, leads: updated });
    // Fallback: re-use addLead workaround via store reset trick
    // Since store doesn't expose updateLead yet, we do it via the
    // subscription model — store exposes no direct updateLead, so we
    // patch the snapshot via a small helper below.
    patchLead(lead.id, status);
    setOpen(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-panel rounded-lg p-4 text-[13px]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{lead.name}</p>
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            {STATUS_LABELS[lead.status]}
            <ChevronDown className="h-3 w-3" />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-md border border-border bg-surface shadow-lg">
              {COLUMNS.map((col) => (
                <button
                  key={col.key}
                  onClick={() => moveTo(col.key)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-[12px] transition-colors hover:bg-surface-2",
                    lead.status === col.key && "font-semibold text-foreground"
                  )}
                >
                  {col.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Phone className="h-3 w-3 shrink-0" />
          <span className="font-mono text-[11.5px]">{lead.phone}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="text-[11.5px]">{lead.desiredDate}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="text-[11.5px]">
            {lead.desiredStart} – {lead.desiredEnd}
          </span>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
        {lead.reason}
      </p>

      <div className="mt-3 flex items-center gap-1">
        <a
          href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface transition-colors hover:border-primary/40 hover:text-primary"
          title="WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
        <a
          href={`tel:${lead.phone}`}
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface transition-colors hover:text-foreground"
          title="Ligar"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Minimal updateLead — patches store state directly until backend lands
// ---------------------------------------------------------------------------
function patchLead(id: string, status: LeadStatus) {
  const s = store.getSnapshot();
  const leads = s.leads.map((l) => (l.id === id ? { ...l, status } : l));
  // Trick: addLead triggers persist+emit; here we need a direct patch.
  // We delete the lead and re-add with new status to keep the pub/sub working.
  const lead = s.leads.find((l) => l.id === id);
  if (!lead) return;
  // Remove old + add updated (store has no updateLead yet)
  const rest = s.leads.filter((l) => l.id !== id);
  // Directly mutate snapshot via store internals (safe until Supabase swap)
  Object.assign(s, { leads: rest });
  store.addLead({ ...lead, status });
}

// ---------------------------------------------------------------------------
// Pipeline tab
// ---------------------------------------------------------------------------
function PipelineTab() {
  const { leads } = useStore();
  const byStatus = useMemo(
    () =>
      COLUMNS.reduce(
        (acc, col) => ({
          ...acc,
          [col.key]: leads.filter((l) => l.status === col.key),
        }),
        {} as Record<LeadStatus, Lead[]>
      ),
    [leads]
  );

  const isEmpty = leads.length === 0;

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      {COLUMNS.map((col) => (
        <div key={col.key} className="flex w-72 shrink-0 flex-col gap-3">
          <div
            className={cn(
              "flex items-center justify-between rounded-md border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em]",
              col.accent
            )}
          >
            <span>{col.label}</span>
            <span className="tabular-nums">{byStatus[col.key]?.length ?? 0}</span>
          </div>

          <div className="flex flex-col gap-2">
            {byStatus[col.key]?.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
            {byStatus[col.key]?.length === 0 && (
              <p className="py-8 text-center text-[12px] text-muted-foreground">
                Nenhum lead
              </p>
            )}
          </div>
        </div>
      ))}

      {isEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-[13px]">
            Nenhum lead ainda. Leads criados pelo formulário de agendamento
            aparecem aqui.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clientes tab (mirrors clients-view)
// ---------------------------------------------------------------------------
function ClientesTab() {
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
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          {rows.length} cliente{rows.length !== 1 ? "s" : ""}
        </p>
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
                    <p className="truncate font-semibold">{c.band || c.name}</p>
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
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function CrmView() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const { leads, clients } = useStore();

  const stats = [
    { label: "Leads abertos",   value: leads.filter((l) => l.status === "open").length },
    { label: "Convertidos",      value: leads.filter((l) => l.status === "converted").length },
    { label: "Total clientes",   value: clients.length },
    { label: "Taxa conversão",   value: leads.length ? `${Math.round((leads.filter((l) => l.status === "converted").length / leads.length) * 100)}%` : "—" },
  ];

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div>
          <p className="text-caption">Padu OS</p>
          <h1 className="text-[15px] font-semibold tracking-tight">CRM</h1>
        </div>
        <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" />
          Novo lead
        </button>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-px border-b border-border bg-border">
        {stats.map((s) => (
          <div key={s.label} className="bg-background px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border px-6 pt-4">
        {(["pipeline", "clientes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-t-md px-4 py-2 text-[12.5px] font-medium capitalize transition-colors",
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "pipeline" ? "Pipeline" : "Clientes"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {tab === "pipeline" ? <PipelineTab /> : <ClientesTab />}
      </div>
    </>
  );
}
