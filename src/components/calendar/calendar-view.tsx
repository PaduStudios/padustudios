import { useEffect, useMemo, useState } from "react";
import { addWeeks, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Command,
  TrendingUp,
  Clock,
  CalendarCheck,
} from "lucide-react";

import { useStore } from "@/hooks/use-store";
import { useAdmin } from "@/hooks/use-admin";
import { toISODate, weekDays, formatMonthYear } from "@/lib/scheduling/time";
import { isSlotFree } from "@/lib/scheduling/availability";
import type { Appointment } from "@/lib/scheduling/types";
import { WeekGrid } from "./week-grid";
import { DetailsPanel } from "./details-panel";
import { NewAppointmentDialog } from "./new-appointment-dialog";
import { cn } from "@/lib/utils";

export function CalendarView() {
  const { appointments, clients } = useStore();
  const { isAdmin } = useAdmin();
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSeed, setDialogSeed] = useState<{
    date: string;
    start: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const rangeLabel = useMemo(() => {
    const first = days[0];
    const last = days[6];
    if (first.getMonth() === last.getMonth()) {
      return `${format(first, "d", { locale: ptBR })} – ${format(last, "d 'de' MMMM", { locale: ptBR })}`;
    }
    return `${format(first, "d 'de' MMM", { locale: ptBR })} – ${format(last, "d 'de' MMM", { locale: ptBR })}`;
  }, [days]);

  const selected = selectedId
    ? appointments.find((a) => a.id === selectedId) ?? null
    : null;
  const selectedClient = selected
    ? clients.find((c) => c.id === selected.clientId) ?? null
    : null;

  // Metrics
  const todayISO = toISODate(new Date());
  const todayAppointments = appointments.filter(
    (a) => a.date === todayISO && a.status !== "cancelled"
  );
  const weekAppointments = appointments.filter((a) =>
    days.some((d) => toISODate(d) === a.date && a.status !== "cancelled")
  );
  const occupancy = Math.round(
    (weekAppointments.reduce(
      (sum, a) => sum + (toMinutes(a.end) - toMinutes(a.start)),
      0
    ) /
      (7 * 16 * 60)) *
      100
  );
  const nextFree = findNextFreeSlot(appointments);

  function openNew(date?: string, start?: string) {
    setEditingId(null);
    setDialogSeed(
      date && start
        ? { date, start }
        : { date: todayISO, start: nextFree?.start ?? "20:00" }
    );
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogSeed(null);
    setDialogOpen(true);
  }

  const editing = editingId
    ? appointments.find((a) => a.id === editingId) ?? null
    : null;

  return (
    <>
      <Header
        rangeLabel={rangeLabel}
        monthLabel={formatMonthYear(anchor)}
        onPrev={() => setAnchor(addWeeks(anchor, -1))}
        onNext={() => setAnchor(addWeeks(anchor, 1))}
        onToday={() => setAnchor(new Date())}
        isToday={days.some((d) => isSameDay(d, new Date()))}
        onNew={() => openNew()}
        showNew={isAdmin}
      />

      <div className="flex flex-1 gap-6 overflow-hidden p-6">
        {/* LEFT: metrics + grid */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-hidden">
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-3 gap-4"
            >
              <MetricCard
                icon={CalendarCheck}
                label="Ensaios hoje"
                value={String(todayAppointments.length)}
                hint={
                  todayAppointments.length === 0
                    ? "Nenhum ensaio agendado"
                    : `${todayAppointments.filter((a) => a.status === "confirmed").length} confirmados`
                }
              />
              <MetricCard
                icon={TrendingUp}
                label="Ocupação da semana"
                value={`${occupancy}%`}
                hint={`${weekAppointments.length} ensaios · ${days[0].getDate()}–${days[6].getDate()}`}
                progress={occupancy}
              />
              <MetricCard
                icon={Clock}
                label="Próximo horário livre"
                value={mounted && nextFree ? nextFree.start : "—"}
                hint={mounted ? (nextFree ? nextFree.dayLabel : "Sem janelas nesta semana") : " "}
                accent
              />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-0 flex-1"
          >
            <WeekGrid
              days={days}
              appointments={appointments}
              clients={clients}
              selectedId={selectedId}
              onSelect={isAdmin ? setSelectedId : () => {}}
              onEmptyClick={(date, start) => isAdmin && openNew(date, start)}
              readOnly={!isAdmin}
            />
          </motion.div>
        </div>

        {/* RIGHT: details panel (desktop) — admin only */}
        {isAdmin && (
          <aside className="hidden w-[340px] shrink-0 xl:block">
            <DetailsPanel
              appointment={selected}
              client={selectedClient}
              onClose={() => setSelectedId(null)}
              onNew={() => openNew()}
              onEdit={openEdit}
              todayAppointments={todayAppointments
                .slice()
                .sort((a, b) => a.start.localeCompare(b.start))}
              clientsById={Object.fromEntries(clients.map((c) => [c.id, c]))}
              onSelectAppointment={setSelectedId}
            />
          </aside>
        )}

        {/* Mobile / tablet: details as overlay when an appointment is selected */}
        {isAdmin && selected && (
          <div className="fixed inset-0 z-40 xl:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedId(null)}
            />
            <div className="absolute inset-x-0 bottom-0 top-16 overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-2xl sm:inset-4 sm:top-auto sm:h-[85vh] sm:max-w-md sm:mx-auto sm:rounded-2xl sm:border">
              <DetailsPanel
                appointment={selected}
                client={selectedClient}
                onClose={() => setSelectedId(null)}
                onNew={() => openNew()}
                onEdit={openEdit}
                todayAppointments={todayAppointments
                  .slice()
                  .sort((a, b) => a.start.localeCompare(b.start))}
                clientsById={Object.fromEntries(clients.map((c) => [c.id, c]))}
                onSelectAppointment={setSelectedId}
              />
            </div>
          </div>
        )}
      </div>

      <NewAppointmentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingId(null);
        }}
        seed={dialogSeed}
        editing={editing}
        onCreated={(a) => setSelectedId(a.id)}
        onUpdated={(a) => setSelectedId(a.id)}
      />
    </>
  );
}

function Header({
  rangeLabel,
  monthLabel,
  onPrev,
  onNext,
  onToday,
  isToday,
  onNew,
  showNew = true,
}: {
  rangeLabel: string;
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isToday: boolean;
  onNew: () => void;
  showNew?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {monthLabel}
          </p>
          <h1 className="truncate text-[15px] font-semibold tracking-tight">
            {rangeLabel}
          </h1>
        </div>

        <div className="ml-2 flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={onPrev}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onToday}
            disabled={isToday}
            className={cn(
              "h-7 rounded-md px-2.5 text-[12px] font-semibold transition-colors",
              isToday
                ? "text-muted-foreground/60"
                : "text-foreground hover:bg-surface-2"
            )}
          >
            Hoje
          </button>
          <button
            onClick={onNext}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showNew && (
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar banda, telefone, dia…"
              className="h-9 w-72 rounded-md border border-border bg-surface pl-8 pr-14 text-[12.5px] outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 flex h-5 -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-surface-2 px-1 text-[10px] font-mono text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        )}

        {showNew && (
          <button
            onClick={onNew}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Plus className="h-4 w-4" />
            Novo agendamento
          </button>
        )}
      </div>
    </header>
  );
}


function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  progress,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  progress?: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden p-4 transition-colors",
        accent && "border-primary/25"
      )}
      style={
        accent
          ? {
              background:
                "linear-gradient(180deg, color-mix(in oklch, var(--primary) 6%, var(--surface)) 0%, var(--surface) 100%)",
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            accent ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <p className="mt-3 font-sans text-[28px] font-bold tracking-tight tabular-nums leading-none">
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">{hint}</p>
      )}
      {typeof progress === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, progress)}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="h-full bg-primary"
          />
        </div>
      )}
    </div>
  );
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function findNextFreeSlot(
  appointments: Appointment[]
): { start: string; dayLabel: string } | null {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const roundedMin = Math.ceil(nowMin / 30) * 30;
  // Try today first, then next 6 days
  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const iso = toISODate(day);
    const startMin = d === 0 ? Math.max(8 * 60, roundedMin) : 8 * 60;
    for (let m = startMin; m + 60 <= 24 * 60; m += 30) {
      const start = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const endMin = m + 60;
      const end = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      if (isSlotFree(appointments, iso, start, end)) {
        const dayLabel =
          d === 0
            ? "Hoje · Ensaio"
            : d === 1
              ? "Amanhã · Ensaio"
              : `${format(day, "EEE d", { locale: ptBR })} · Ensaio`;
        return { start, dayLabel };
      }
    }
  }
  return null;
}
