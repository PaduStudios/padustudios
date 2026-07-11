import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  MessageCircle,
  Pencil,
  Trash2,
  MapPin,
  Clock,
  Phone,
  Mail,
  User,
  Users,
  StickyNote,
  Plus,
  CalendarDays,
} from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import type { Appointment, Client } from "@/lib/scheduling/types";
import { store } from "@/lib/scheduling/store";
import { cn } from "@/lib/utils";

interface Props {
  appointment: Appointment | null;
  client: Client | null;
  todayAppointments: Appointment[];
  clientsById: Record<string, Client>;
  onClose: () => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onSelectAppointment: (id: string) => void;
}

const statusMeta = {
  confirmed: { label: "Confirmado", tone: "bg-primary/15 text-primary" },
  pending: {
    label: "Pendente",
    tone: "bg-[color:var(--status-pending)]/15 text-[color:var(--status-pending)]",
  },
  blocked: { label: "Bloqueado", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", tone: "bg-muted text-muted-foreground" },
} as const;

export function DetailsPanel({
  appointment,
  client,
  todayAppointments,
  clientsById,
  onClose,
  onNew,
  onEdit,
  onSelectAppointment,
}: Props) {
  return (
    <div className="surface-panel flex h-full flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {appointment && client ? (
          <SelectedView
            key={appointment.id}
            appointment={appointment}
            client={client}
            onClose={onClose}
            onEdit={() => onEdit(appointment.id)}
          />
        ) : (
          <EmptyView
            key="empty"
            todayAppointments={todayAppointments}
            clientsById={clientsById}
            onSelect={onSelectAppointment}
            onNew={onNew}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectedView({
  appointment,
  client,
  onClose,
  onEdit,
}: {
  appointment: Appointment;
  client: Client;
  onClose: () => void;
  onEdit: () => void;
}) {
  const status = statusMeta[appointment.status];
  const initials = (client.band || client.name)
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const dayDate = parse(appointment.date, "yyyy-MM-dd", new Date());
  const fullDate = format(dayDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const durationMin = toMin(appointment.end) - toMin(appointment.start);
  const durationLabel =
    durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}min` : ""}`
      : `${durationMin}min`;

  const whatsappUrl = `https://wa.me/${client.phone.replace(/\D/g, "")}`;

  function remove() {
    if (!window.confirm(`Excluir o ensaio de ${client.band || client.name} em ${appointment.start}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    store.deleteAppointment(appointment.id);
    toast.success("Ensaio excluído", {
      description: `${client.band || client.name} · ${appointment.start}`,
    });
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="text-caption">Detalhes do ensaio</p>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="px-5 pt-5">
          <div className="flex items-start gap-3">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-primary-foreground"
              style={{
                background: "var(--primary)",
                boxShadow:
                  "inset 0 1px 0 color-mix(in oklch, white 25%, transparent), 0 8px 24px -8px color-mix(in oklch, var(--primary) 60%, transparent)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-bold tracking-tight leading-tight">
                {client.band || client.name}
              </h2>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {client.band ? client.name : "Cliente"}
                {client.members ? ` · ${client.members} integrantes` : ""}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                status.tone
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: `var(--status-${appointment.status})`,
                }}
              />
              {status.label}
            </span>
            {appointment.price && (
              <span className="inline-flex rounded-full border border-border px-2 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                R$ {appointment.price.toFixed(0)}
              </span>
            )}
          </div>
        </div>

        {/* Info blocks */}
        <div className="mt-5 border-t border-border px-5 py-4">
          <SectionTitle>Ensaio</SectionTitle>
          <div className="mt-3 space-y-3">
            <Row icon={CalendarDays} label="Data">
              <span className="capitalize">{fullDate}</span>
            </Row>
            <Row icon={Clock} label="Horário">
              <span className="font-mono tabular-nums">
                {appointment.start} – {appointment.end}
              </span>
              <span className="ml-2 text-muted-foreground">
                · {durationLabel}
              </span>
            </Row>
            {appointment.room && (
              <Row icon={MapPin} label="Sala">
                {appointment.room}
              </Row>
            )}
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <SectionTitle>Contato</SectionTitle>
          <div className="mt-3 space-y-3">
            <Row icon={User} label="Nome">
              {client.name}
            </Row>
            <Row icon={Phone} label="Telefone">
              <a
                href={`tel:${client.phone}`}
                className="hover:text-primary transition-colors"
              >
                {client.phone}
              </a>
            </Row>
            {client.email && (
              <Row icon={Mail} label="Email">
                <a
                  href={`mailto:${client.email}`}
                  className="truncate hover:text-primary transition-colors"
                >
                  {client.email}
                </a>
              </Row>
            )}
            {client.members && (
              <Row icon={Users} label="Integrantes">
                {client.members}
              </Row>
            )}
          </div>
        </div>

        {(appointment.notes || client.notes) && (
          <div className="border-t border-border px-5 py-4">
            <SectionTitle>Observações</SectionTitle>
            <div className="mt-3 flex gap-2 rounded-lg border border-border bg-surface-2/50 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p>{appointment.notes || client.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer actions */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-surface/60 p-3 backdrop-blur">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary text-[12.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <button
            onClick={onEdit}
            className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface transition-colors hover:bg-surface-2"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          onClick={remove}
          className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 text-[12.5px] font-semibold text-destructive transition-colors hover:bg-destructive/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir ensaio
        </button>
      </div>
    </motion.div>
  );
}

function EmptyView({
  todayAppointments,
  clientsById,
  onSelect,
  onNew,
}: {
  todayAppointments: Appointment[];
  clientsById: Record<string, Client>;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-caption">Sua agenda</p>
          <p className="mt-1 text-[14px] font-semibold">Hoje</p>
        </div>
        <button
          onClick={onNew}
          className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface transition-colors hover:bg-surface-2"
          title="Novo agendamento"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {todayAppointments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-[13px] font-semibold">Nada agendado hoje</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Clique em qualquer horário livre no calendário para criar um novo
              ensaio.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {todayAppointments.map((a) => {
              const c = clientsById[a.clientId];
              return (
                <li key={a.id}>
                  <button
                    onClick={() => onSelect(a.id)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-border bg-surface-2/30 p-3 text-left transition-all hover:border-border-strong hover:bg-surface-2"
                  >
                    <div className="w-10 shrink-0 border-r border-border pr-3 text-right">
                      <p className="font-mono text-[11px] font-bold tabular-nums">
                        {a.start}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                        {a.end}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        {c?.band || c?.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {a.room || "Sala não definida"}
                      </p>
                    </div>
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        background: `var(--status-${a.status})`,
                      }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-caption">{children}</p>;
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[16px_72px_minmax(0,1fr)] items-center gap-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-[13px] font-medium">{children}</span>
    </div>
  );
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
