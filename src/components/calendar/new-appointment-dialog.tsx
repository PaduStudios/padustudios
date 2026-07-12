import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/hooks/use-store";
import { store } from "@/lib/scheduling/store";
import {
  findAlternatives,
  isSlotFree,
} from "@/lib/scheduling/availability";
import { addMinutesToTime } from "@/lib/scheduling/time";
import { ROOMS, suggestedPrice } from "@/lib/scheduling/pricing";
import type {
  Appointment,
  Client,
  ClientOrigin,
  SlotSuggestion,
} from "@/lib/scheduling/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: { date: string; start: string } | null;
  editing?: Appointment | null;
  onCreated?: (a: Appointment) => void;
  onUpdated?: (a: Appointment) => void;
}

type Step = "when" | "who";

const DURATIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 60);

const ORIGINS: { value: ClientOrigin; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "site", label: "Site" },
  { value: "instagram", label: "Instagram" },
  { value: "phone", label: "Telefone" },
  { value: "walkin", label: "Balcão" },
  { value: "other", label: "Outro" },
];

export function NewAppointmentDialog({
  open,
  onOpenChange,
  seed,
  editing,
  onCreated,
  onUpdated,
}: Props) {
  const { appointments, clients } = useStore();
  const [step, setStep] = useState<Step>("when");
  const [date, setDate] = useState<string>(seed?.date ?? "");
  const [start, setStart] = useState<string>(seed?.start ?? "20:00");
  const [duration, setDuration] = useState<number>(120);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientQuery, setClientQuery] = useState("");
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    band: "",
    members: "",
    origin: "whatsapp" as ClientOrigin,
  });
  const [room, setRoom] = useState<string>("Ensaio");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState<string>("");
  const [priceTouched, setPriceTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("when");
    if (editing) {
      setDate(editing.date);
      setStart(editing.start);
      const dur =
        (toMinutes(editing.end) - toMinutes(editing.start) + 24 * 60) %
          (24 * 60) || 120;
      setDuration(dur);
      setMode("existing");
      setSelectedClientId(editing.clientId);
      setRoom(editing.room ?? "Ensaio");
      setNotes(editing.notes ?? "");
      setPrice(editing.price != null ? String(editing.price) : "");
      setPriceTouched(editing.price != null);
    } else {
      setDate(seed?.date ?? "");
      setStart(seed?.start ?? "20:00");
      setDuration(120);
      setMode("existing");
      setSelectedClientId("");
      setRoom("Ensaio");
      setNotes("");
      setPrice("");
      setPriceTouched(false);
    }
    setClientQuery("");
    setNewClient({
      name: "",
      phone: "",
      email: "",
      band: "",
      members: "",
      origin: "whatsapp",
    });
  }, [open, seed, editing]);

  // Auto-fill the price when the user hasn't manually edited it.
  useEffect(() => {
    if (priceTouched) return;
    const suggested = suggestedPrice(room, duration);
    setPrice(suggested != null ? String(suggested) : "");
  }, [room, duration, priceTouched]);

  const end = useMemo(() => addMinutesToTime(start, duration), [start, duration]);

  // When editing, ignore the row being edited so the same slot doesn't
  // register as "busy against itself".
  const otherAppointments = useMemo(
    () =>
      editing
        ? appointments.filter((a) => a.id !== editing.id)
        : appointments,
    [appointments, editing]
  );

  const availability = useMemo(() => {
    if (!date) return null;
    return findAlternatives(otherAppointments, { date, start, end });
  }, [otherAppointments, date, start, end]);

  const canProceed = date && start && end && availability?.isFree;

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.band ?? "").toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      )
      .slice(0, 8);
  }, [clients, clientQuery]);

  function pickSuggestion(s: SlotSuggestion) {
    setDate(s.date);
    setStart(s.start);
  }

  function submit() {
    if (!date || !start || !end) return;

    let clientId = selectedClientId;
    if (mode === "new") {
      if (!newClient.name.trim() || !newClient.phone.trim()) {
        toast.error("Nome e telefone são obrigatórios");
        return;
      }
      const created = store.addClient({
        name: newClient.name.trim(),
        phone: newClient.phone.trim(),
        email: newClient.email.trim() || undefined,
        band: newClient.band.trim() || undefined,
        members: newClient.members
          ? Number(newClient.members)
          : undefined,
        origin: newClient.origin,
      });
      clientId = created.id;
    }
    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!isSlotFree(otherAppointments, date, start, end)) {
      toast.error("Este horário acabou de ser ocupado");
      return;
    }

    if (editing) {
      store.updateAppointment(editing.id, {
        clientId,
        date,
        start,
        end,
        room,
        notes: notes.trim() || undefined,
      });
      const updated = store.getSnapshot().appointments.find((a) => a.id === editing.id);
      const client = store.getSnapshot().clients.find((c) => c.id === clientId);
      toast.success("Ensaio atualizado", {
        description: `${client?.band || client?.name} · ${formatDatePt(date)} · ${start}–${end}`,
      });
      if (updated) onUpdated?.(updated);
      onOpenChange(false);
      return;
    }

    const created = store.addAppointment({
      clientId,
      date,
      start,
      end,
      status: "confirmed",
      room,
      notes: notes.trim() || undefined,
    });
    const client = store.getSnapshot().clients.find((c) => c.id === clientId);
    toast.success("Ensaio agendado", {
      description: `${client?.band || client?.name} · ${formatDatePt(date)} · ${start}–${end}`,
    });
    onCreated?.(created);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden border-border-strong bg-surface p-0"
        style={{ boxShadow: "0 24px 80px -20px rgba(0,0,0,0.6)" }}
      >
        <DialogTitle className="sr-only">
          {editing ? "Editar agendamento" : "Novo agendamento"}
        </DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg text-primary-foreground"
              style={{ background: "var(--primary)" }}
            >
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Padu OS · {editing ? "Editar ensaio" : "Agendamento"}
              </p>
              <p className="text-[14px] font-semibold">
                {step === "when" ? "Data e horário" : "Quem vai ensaiar?"}
              </p>
            </div>
          </div>
        </div>

        {/* Stepper indicator */}
        <div className="flex gap-1 px-5 pt-4">
          <StepDot active={step === "when"} done={step === "who"} label="1" />
          <StepDot active={step === "who"} label="2" />
        </div>

        <AnimatePresence mode="wait">
          {step === "when" ? (
            <motion.div
              key="when"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="max-h-[65vh] space-y-5 overflow-y-auto p-5"
            >
              <Field label="Data">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium outline-none focus:border-primary/50"
                />
              </Field>

              <Field label="Horário de início">
                <input
                  type="time"
                  value={start}
                  step={1800}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-[13px] font-medium outline-none focus:border-primary/50"
                />
              </Field>

              <Field label="Duração">
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium outline-none focus:border-primary/50"
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d / 60} {d === 60 ? "hora" : "horas"}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Termina às <span className="font-mono">{end}</span>
                </p>
              </Field>

              <Field label="Sala">
                <div className="grid grid-cols-3 gap-1.5">
                  {["Sala A", "Sala B", "Sala Master"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoom(r)}
                      className={cn(
                        "h-9 rounded-md border text-[12px] font-semibold transition-colors",
                        room === r
                          ? "border-primary bg-primary-muted text-primary"
                          : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Availability feedback */}
              {date && availability && (
                <div>
                  {availability.isFree ? (
                    <div className="flex items-center gap-2 rounded-md border border-[color:var(--success)]/25 bg-[color:var(--success)]/10 px-3 py-2.5 text-[12px] font-medium text-[color:var(--success)]">
                      <Check className="h-3.5 w-3.5" />
                      Horário disponível
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-border bg-surface-2/50 p-3">
                      <div className="flex items-center gap-2 text-[12px] font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Ocupado. Sugestões inteligentes:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availability.suggestions.length === 0 ? (
                          <p className="text-[11.5px] text-muted-foreground">
                            Sem alternativas na semana. Salve como lead depois.
                          </p>
                        ) : (
                          availability.suggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => pickSuggestion(s)}
                              className="group flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11.5px] transition-all hover:border-primary/50 hover:bg-primary-muted hover:text-primary"
                            >
                              <span className="font-mono font-semibold">
                                {s.start}
                              </span>
                              <span className="text-muted-foreground group-hover:text-primary/80">
                                · {suggestionLabel(s, date)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="who"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="max-h-[65vh] space-y-5 overflow-y-auto p-5"
            >
              <div className="flex gap-1 rounded-md border border-border bg-surface-2 p-0.5">
                <ToggleTab active={mode === "existing"} onClick={() => setMode("existing")}>
                  Cliente existente
                </ToggleTab>
                <ToggleTab active={mode === "new"} onClick={() => setMode("new")}>
                  Novo cliente
                </ToggleTab>
              </div>

              {mode === "existing" ? (
                <>
                  <Field label="Buscar">
                    <input
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      placeholder="Nome, banda ou telefone"
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
                    />
                  </Field>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {filteredClients.map((c) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        selected={selectedClientId === c.id}
                        onClick={() => setSelectedClientId(c.id)}
                      />
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="py-8 text-center text-[12px] text-muted-foreground">
                        Nenhum cliente encontrado.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome *" className="col-span-2">
                    <input
                      value={newClient.name}
                      onChange={(e) =>
                        setNewClient((s) => ({ ...s, name: e.target.value }))
                      }
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
                    />
                  </Field>
                  <Field label="Telefone *">
                    <input
                      value={newClient.phone}
                      onChange={(e) =>
                        setNewClient((s) => ({ ...s, phone: e.target.value }))
                      }
                      placeholder="+55 11 98888-0000"
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      value={newClient.email}
                      onChange={(e) =>
                        setNewClient((s) => ({ ...s, email: e.target.value }))
                      }
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
                    />
                  </Field>
                  <Field label="Banda">
                    <input
                      value={newClient.band}
                      onChange={(e) =>
                        setNewClient((s) => ({ ...s, band: e.target.value }))
                      }
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
                    />
                  </Field>
                  <Field label="Integrantes">
                    <input
                      value={newClient.members}
                      onChange={(e) =>
                        setNewClient((s) => ({ ...s, members: e.target.value }))
                      }
                      type="number"
                      min={1}
                      className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
                    />
                  </Field>
                  <Field label="Origem" className="col-span-2">
                    <div className="flex flex-wrap gap-1.5">
                      {ORIGINS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() =>
                            setNewClient((s) => ({ ...s, origin: o.value }))
                          }
                          className={cn(
                            "h-8 rounded-md border px-2.5 text-[11.5px] font-semibold transition-colors",
                            newClient.origin === o.value
                              ? "border-primary bg-primary-muted text-primary"
                              : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              <Field label="Observações">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary/50"
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface/60 p-4 backdrop-blur">
          {step === "who" ? (
            <button
              onClick={() => setStep("when")}
              className="h-9 rounded-md px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Voltar
            </button>
          ) : (
            <span className="text-[11.5px] text-muted-foreground">
              {date && (
                <>
                  {formatDatePt(date)} ·{" "}
                  <span className="font-mono">
                    {start} – {end}
                  </span>
                </>
              )}
            </span>
          )}

          {step === "when" ? (
            <button
              disabled={!canProceed}
              onClick={() => setStep("who")}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                boxShadow: canProceed ? "var(--shadow-glow)" : undefined,
              }}
            >
              Continuar
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={mode === "existing" && !selectedClientId}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Check className="h-3.5 w-3.5" />
              {editing ? "Salvar alterações" : "Confirmar agendamento"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active?: boolean;
  done?: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "h-1 flex-1 rounded-full transition-colors",
        active ? "bg-primary" : done ? "bg-primary/50" : "bg-border-strong"
      )}
      aria-label={`Passo ${label}`}
    />
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded px-3 py-1.5 text-[12px] font-semibold transition-colors",
        active
          ? "bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ClientRow({
  client,
  selected,
  onClick,
}: {
  client: Client;
  selected: boolean;
  onClick: () => void;
}) {
  const initials = (client.band || client.name)
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border border-transparent p-2 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary-muted"
          : "hover:bg-surface-2"
      )}
    >
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md text-[11px] font-bold",
          selected ? "bg-primary text-primary-foreground" : "bg-surface-3"
        )}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {client.band || client.name}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {client.band ? `${client.name} · ` : ""}
          {client.phone}
        </p>
      </div>
      {selected && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}

function suggestionLabel(s: SlotSuggestion, requestedDate: string): string {
  if (s.date === requestedDate) {
    return s.reason === "same-day-earlier"
      ? `${s.distanceMinutes}min antes`
      : `${s.distanceMinutes}min depois`;
  }
  const d = parse(s.date, "yyyy-MM-dd", new Date());
  return format(d, "EEE d/MM", { locale: ptBR });
}

function formatDatePt(iso: string): string {
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return format(d, "EEE, d 'de' MMM", { locale: ptBR });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
