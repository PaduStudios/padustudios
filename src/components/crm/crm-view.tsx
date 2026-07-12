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
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { store } from "@/lib/scheduling/store";
import { cn } from "@/lib/utils";
import { formatPhoneSmart, onlyDigits } from "@/lib/phone";
import type { Lead } from "@/lib/scheduling/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Tab = "pipeline" | "clientes" | "churn";
type LeadStatus = Lead["status"];

/** Churn rule: ≥3 confirmed appointments and no visit in the last N days. */
const CHURN_MIN_APPTS = 3;
const CHURN_DAYS_INACTIVE = 30;

const COLUMNS: { key: LeadStatus; label: string; accent: string }[] = [
  { key: "open",      label: "Abertos",     accent: "text-primary border-primary/30" },
  { key: "converted", label: "Convertidos",  accent: "text-green-500 border-green-500/30" },
  { key: "lost",      label: "Perdidos",     accent: "text-destructive border-destructive/30" },
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  open: "Aberto",
  converted: "Convertido",
  lost: "Perdido",
};

// ── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({ lead }: { lead: Lead }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function moveTo(status: LeadStatus) {
    store.updateLead(lead.id, { status });
    setMenuOpen(false);
  }

  function handleDelete() {
    if (confirm(`Excluir o lead "${lead.name}"? Esta ação não pode ser desfeita.`)) {
      store.deleteLead(lead.id);
    }
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
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            {STATUS_LABELS[lead.status]}
            <ChevronDown className="h-3 w-3" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[130px] overflow-hidden rounded-md border border-border bg-surface shadow-lg">
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
        <button
          onClick={handleDelete}
          className="ml-auto grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          title="Excluir lead"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Pipeline Tab ─────────────────────────────────────────────────────────────
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

      {leads.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[13px] text-muted-foreground">
            Nenhum lead ainda. Leads do formulário de agendamento aparecem aqui automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Clientes Tab ─────────────────────────────────────────────────────────────
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

  function handleDeleteClient(id: string, name: string) {
    if (confirm(`Excluir o cliente "${name}"? Esta ação não pode ser desfeita.`)) {
      store.deleteClient(id);
    }
  }

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
                <span className="truncate font-mono text-[12px]">{formatPhoneSmart(c.phone)}</span>
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
                  <button
                    onClick={() => handleDeleteClient(c.id, c.band || c.name)}
                    className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                    title="Excluir cliente"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
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

// ── Churn Tab ────────────────────────────────────────────────────────────────
function ChurnTab() {
  const { clients, appointments } = useStore();

  const churned = useMemo(() => {
    const now = Date.now();
    const cutoffMs = now - CHURN_DAYS_INACTIVE * 24 * 60 * 60 * 1000;
    const byClient = new Map<string, { count: number; lastMs: number; lastDate: string }>();
    for (const a of appointments) {
      if (a.status === "cancelled" || a.status === "blocked") continue;
      const t = Date.parse(a.date);
      if (isNaN(t)) continue;
      const cur = byClient.get(a.clientId);
      if (!cur) {
        byClient.set(a.clientId, { count: 1, lastMs: t, lastDate: a.date });
      } else {
        cur.count += 1;
        if (t > cur.lastMs) {
          cur.lastMs = t;
          cur.lastDate = a.date;
        }
      }
    }
    const rows = clients
      .map((c) => ({
        client: c,
        stats: byClient.get(c.id),
      }))
      .filter(
        (r): r is { client: typeof r.client; stats: NonNullable<typeof r.stats> } =>
          !!r.stats &&
          r.stats.count >= CHURN_MIN_APPTS &&
          r.stats.lastMs < cutoffMs
      )
      .map((r) => ({
        client: r.client,
        count: r.stats.count,
        lastDate: r.stats.lastDate,
        daysSince: Math.floor((now - r.stats.lastMs) / (24 * 60 * 60 * 1000)),
      }));
    rows.sort((a, b) => b.daysSince - a.daysSince);
    return rows;
  }, [clients, appointments]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex items-start gap-3 rounded-md border border-[color:var(--status-pending)]/25 bg-[color:var(--status-pending)]/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--status-pending)]" />
        <div>
          <p className="text-[13px] font-semibold">
            Clientes que ensaiavam bastante e sumiram
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Regra: pelo menos {CHURN_MIN_APPTS} ensaios no histórico e sem
            aparecer nos últimos {CHURN_DAYS_INACTIVE} dias. Um toque no WhatsApp
            costuma trazer de volta.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="surface-panel overflow-hidden"
      >
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px_100px_120px] border-b border-border px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Banda / Cliente</span>
          <span>Telefone</span>
          <span className="text-right">Ensaios</span>
          <span className="text-right">Última visita</span>
          <span className="text-right">Reengajar</span>
        </div>
        <ul>
          {churned.map(({ client: c, count, lastDate, daysSince }, i) => (
            <li
              key={c.id}
              className={cn(
                "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px_100px_120px] items-center gap-2 border-b border-border px-5 py-3.5 text-[13px] last:border-b-0",
                i % 2 === 1 && "bg-surface-2/20"
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.band || c.name}</p>
                {c.band && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.name}
                  </p>
                )}
              </div>
              <span className="truncate font-mono text-[12px]">{c.phone}</span>
              <span className="flex items-center justify-end gap-1 tabular-nums">
                <Users className="h-3 w-3 text-muted-foreground" />
                {count}
              </span>
              <div className="text-right">
                <p className="text-[12px] tabular-nums">{formatShortDate(lastDate)}</p>
                <p className="text-[10.5px] text-[color:var(--status-pending)]">
                  há {daysSince}d
                </p>
              </div>
              <div className="flex items-center justify-end gap-1">
                <a
                  href={`https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Oi ${c.name.split(" ")[0]}, saudade de ver vocês por aqui! Bora marcar um ensaio?`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface transition-colors hover:border-primary/40 hover:text-primary"
                  title="Reengajar via WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
                <a
                  href={`tel:${c.phone}`}
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface transition-colors hover:text-foreground"
                  title="Ligar"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              </div>
            </li>
          ))}
          {churned.length === 0 && (
            <li className="px-5 py-12 text-center text-[13px] text-muted-foreground">
              Ninguém sumiu ainda. Boa retenção. 🎸
            </li>
          )}
        </ul>
      </motion.div>
    </div>
  );
}

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ── Root ─────────────────────────────────────────────────────────────────────
export function CrmView() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const { leads, clients, appointments } = useStore();

  const churnCount = useMemo(() => {
    const now = Date.now();
    const cutoffMs = now - CHURN_DAYS_INACTIVE * 24 * 60 * 60 * 1000;
    const by = new Map<string, { count: number; lastMs: number }>();
    for (const a of appointments) {
      if (a.status === "cancelled" || a.status === "blocked") continue;
      const t = Date.parse(a.date);
      if (isNaN(t)) continue;
      const cur = by.get(a.clientId);
      if (!cur) by.set(a.clientId, { count: 1, lastMs: t });
      else {
        cur.count++;
        if (t > cur.lastMs) cur.lastMs = t;
      }
    }
    let n = 0;
    for (const [, v] of by) {
      if (v.count >= CHURN_MIN_APPTS && v.lastMs < cutoffMs) n++;
    }
    return n;
  }, [appointments]);

  const stats = [
    {
      label: "Leads abertos",
      value: leads.filter((l) => l.status === "open").length,
    },
    {
      label: "Total clientes",
      value: clients.length,
    },
    {
      label: "Clientes sumidos",
      value: churnCount,
    },
    {
      label: "Taxa conversão",
      value: leads.length
        ? `${Math.round(
            (leads.filter((l) => l.status === "converted").length /
              leads.length) *
              100
          )}%`
        : "—",
    },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "pipeline", label: "Pipeline" },
    { key: "clientes", label: "Clientes" },
    { key: "churn", label: `Sumidos${churnCount ? ` · ${churnCount}` : ""}` },
  ];

  const [leadOpen, setLeadOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div>
          <p className="text-caption">Padu Studios</p>
          <h1 className="text-[15px] font-semibold tracking-tight">CRM</h1>
        </div>
        <button
          onClick={() => setLeadOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo lead
        </button>
      </header>
      <NewLeadDialog open={leadOpen} onOpenChange={setLeadOpen} />

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

      <div className="flex gap-1 border-b border-border px-6 pt-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-t-md px-4 py-2 text-[12.5px] font-medium transition-colors",
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {tab === "pipeline" && <PipelineTab />}
        {tab === "clientes" && <ClientesTab />}
        {tab === "churn" && <ChurnTab />}
      </div>
    </>
  );
}

function NewLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredDate, setDesiredDate] = useState("");
  const [desiredStart, setDesiredStart] = useState("20:00");
  const [desiredEnd, setDesiredEnd] = useState("22:00");
  const [reason, setReason] = useState("");

  function reset() {
    setName("");
    setPhone("");
    setDesiredDate("");
    setDesiredStart("20:00");
    setDesiredEnd("22:00");
    setReason("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    store.addLead({
      name: name.trim(),
      phone: phone.trim(),
      desiredDate: desiredDate || new Date().toISOString().slice(0, 10),
      desiredStart,
      desiredEnd,
      reason: reason.trim() || "Contato manual",
      status: "open",
    });
    toast.success("Lead adicionado");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md border-border-strong bg-surface p-0">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[14px] font-semibold">Novo lead</DialogTitle>
          <DialogDescription className="text-[11.5px] text-muted-foreground">
            Registre um contato interessado para acompanhar no pipeline.
          </DialogDescription>
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nome *
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Telefone *
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-3 block sm:col-span-1">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Data desejada
              </span>
              <input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-2 text-[13px] outline-none focus:border-primary/50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Início
              </span>
              <input
                type="time"
                value={desiredStart}
                onChange={(e) => setDesiredStart(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[13px] outline-none focus:border-primary/50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fim
              </span>
              <input
                type="time"
                value={desiredEnd}
                onChange={(e) => setDesiredEnd(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[13px] outline-none focus:border-primary/50"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Observações
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-md border border-border px-3 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Salvar lead
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


