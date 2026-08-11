import { useEffect, useMemo, useRef, useState } from "react";
import { addWeeks, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { useStore } from "@/hooks/use-store";
import { store } from "@/lib/scheduling/store";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  formatDayLabel,
  formatMonthYear,
  isToday,
  timeToMinutes,
  toISODate,
  weekDays,
} from "@/lib/scheduling/time";
import { INTERNAL_OWNERS, type InternalEvent } from "@/lib/scheduling/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ROW_HEIGHT = 44;
const HOURS = DAY_END_HOUR - DAY_START_HOUR;

const OWNER_COLOR: Record<string, string> = {
  Padu: "var(--primary)",
  "Flávio": "oklch(0.72 0.15 240)",
  Guma: "oklch(0.74 0.15 150)",
  "Luísa": "oklch(0.78 0.15 80)",
};

function ownerColor(owner: string) {
  return OWNER_COLOR[owner] ?? "var(--muted-foreground)";
}

export function InternalAgendaView() {
  const { internalEvents } = useStore();
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InternalEvent | null>(null);
  const [seed, setSeed] = useState<{ date: string; start: string } | null>(null);

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const rangeLabel = useMemo(() => {
    const first = days[0];
    const last = days[6];
    if (first.getMonth() === last.getMonth()) {
      return `${format(first, "d", { locale: ptBR })} – ${format(last, "d 'de' MMMM", { locale: ptBR })}`;
    }
    return `${format(first, "d 'de' MMM", { locale: ptBR })} – ${format(last, "d 'de' MMM", { locale: ptBR })}`;
  }, [days]);

  const visible = ownerFilter
    ? internalEvents.filter((e) => e.owner === ownerFilter)
    : internalEvents;

  function openNew(date?: string, start?: string) {
    setEditing(null);
    setSeed({ date: date ?? toISODate(new Date()), start: start ?? "10:00" });
    setDialogOpen(true);
  }

  function openEdit(ev: InternalEvent) {
    setSeed(null);
    setEditing(ev);
    setDialogOpen(true);
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Agenda Interna · {formatMonthYear(anchor)}
            </p>
            <h1 className="truncate text-[15px] font-semibold tracking-tight">
              {rangeLabel}
            </h1>
          </div>
          <div className="ml-2 flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
            <button
              onClick={() => setAnchor(addWeeks(anchor, -1))}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              disabled={days.some((d) => isSameDay(d, new Date()))}
              className={cn(
                "h-7 rounded-md px-2.5 text-[12px] font-semibold transition-colors",
                days.some((d) => isSameDay(d, new Date()))
                  ? "text-muted-foreground/60"
                  : "text-foreground hover:bg-surface-2"
              )}
            >
              Hoje
            </button>
            <button
              onClick={() => setAnchor(addWeeks(anchor, 1))}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Próxima semana"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={() => openNew()}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" />
          Nova tarefa
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        {/* Owner filter */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => setOwnerFilter(null)}
            className={cn(
              "rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold transition-colors",
              ownerFilter === null
                ? "bg-primary-muted text-foreground"
                : "bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            Todos
          </button>
          {INTERNAL_OWNERS.map((o) => (
            <button
              key={o}
              onClick={() => setOwnerFilter(ownerFilter === o ? null : o)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold transition-colors",
                ownerFilter === o
                  ? "bg-surface-3 text-foreground"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: ownerColor(o) }}
              />
              {o}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1">
          <InternalWeekGrid
            days={days}
            events={visible}
            onEmptyClick={openNew}
            onSelect={openEdit}
          />
        </div>
      </div>

      <InternalEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        seed={seed}
        editing={editing}
      />
    </>
  );
}

function InternalWeekGrid({
  days,
  events,
  onEmptyClick,
  onSelect,
}: {
  days: Date[];
  events: InternalEvent[];
  onEmptyClick: (date: string, start: string) => void;
  onSelect: (ev: InternalEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cols = `64px repeat(${days.length}, minmax(0, 1fr))`;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = ((9 * 60 - DAY_START_HOUR * 60) / 30) * ROW_HEIGHT;
  }, []);

  return (
    <div className="surface-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className="grid shrink-0 border-b border-border"
        style={{ gridTemplateColumns: cols, paddingRight: 10 }}
      >
        <div />
        {days.map((day) => {
          const { weekday, day: d } = formatDayLabel(day);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5",
                today && "bg-primary-muted"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.14em]",
                  today ? "text-primary" : "text-muted-foreground"
                )}
              >
                {weekday}
              </span>
              <span
                className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  today ? "text-primary" : "text-foreground"
                )}
              >
                {d}
              </span>
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto"
        style={{ contain: "strict", scrollbarGutter: "stable" }}
      >
        <div
          className="relative grid"
          style={{ height: HOURS * 2 * ROW_HEIGHT, gridTemplateColumns: cols }}
        >
          <div className="relative">
            {Array.from({ length: HOURS }).map((_, i) => {
              const hour = DAY_START_HOUR + i;
              return (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 font-mono text-[10px] font-medium text-muted-foreground/70"
                  style={{ top: i * 2 * ROW_HEIGHT }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>

          {days.map((day) => {
            const iso = toISODate(day);
            const dayEvents = events.filter(
              (e) => e.date === iso && e.status !== "cancelled"
            );
            return (
              <div
                key={iso}
                className={cn("relative", isToday(day) && "bg-primary-muted/25")}
                data-slot-target="1"
                onClick={(e) => {
                  if ((e.target as HTMLElement).dataset.slotTarget !== "1") return;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const slotIndex = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                  const minutes = DAY_START_HOUR * 60 + slotIndex * 30;
                  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
                  const mm = String(minutes % 60).padStart(2, "0");
                  onEmptyClick(iso, `${hh}:${mm}`);
                }}
              >
                {Array.from({ length: HOURS * 2 }).map((_, i) => (
                  <div
                    key={i}
                    data-slot-target="1"
                    className={cn(
                      "absolute inset-x-0 h-[44px] transition-colors hover:bg-primary-muted/40",
                      i % 2 === 0
                        ? "border-t border-border"
                        : "border-t border-border/40"
                    )}
                    style={{ top: i * ROW_HEIGHT }}
                  />
                ))}

                {dayEvents.map((ev) => {
                  const startMin = timeToMinutes(ev.start) - DAY_START_HOUR * 60;
                  const endMin = timeToMinutes(ev.end) - DAY_START_HOUR * 60;
                  const top = (startMin / 30) * ROW_HEIGHT;
                  const height = ((endMin - startMin) / 30) * ROW_HEIGHT - 4;
                  const accent = ownerColor(ev.owner);
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(ev);
                      }}
                      className="absolute left-1 right-1 flex flex-col overflow-hidden rounded-md p-2 text-left"
                      style={{
                        top,
                        height: Math.max(28, height),
                        background: `color-mix(in oklch, ${accent} 30%, var(--surface))`,
                        borderLeft: `3px solid ${accent}`,
                      }}
                    >
                      <p
                        className="truncate text-[9px] font-bold uppercase leading-none tracking-[0.14em]"
                        style={{ color: accent }}
                      >
                        {ev.owner}
                      </p>
                      {height >= 34 && (
                        <p className="mt-0.5 truncate text-[12px] font-semibold leading-tight">
                          {ev.title}
                        </p>
                      )}
                      {height >= 52 && (
                        <p className="mt-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {ev.start} – {ev.end}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: cols }}
          >
            <div className="border-r border-border" />
            {days.map((day, i) => (
              <div
                key={day.toISOString()}
                className={cn(i < days.length - 1 && "border-r border-border")}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InternalEventDialog({
  open,
  onOpenChange,
  seed,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: { date: string; start: string } | null;
  editing: InternalEvent | null;
}) {
  const [owner, setOwner] = useState<string>(INTERNAL_OWNERS[0]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setOwner(editing.owner);
      setTitle(editing.title);
      setDate(editing.date);
      setStart(editing.start);
      setEnd(editing.end);
      setNotes(editing.notes ?? "");
    } else {
      const s = seed?.start ?? "10:00";
      const [h, m] = s.split(":").map(Number);
      const endMin = Math.min(h * 60 + m + 60, 23 * 60 + 59);
      setOwner(INTERNAL_OWNERS[0]);
      setTitle("");
      setDate(seed?.date ?? toISODate(new Date()));
      setStart(s);
      setEnd(
        `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`
      );
      setNotes("");
    }
  }, [open, editing, seed]);

  function save() {
    if (!title.trim()) return;
    const payload = {
      owner,
      title: title.trim(),
      date,
      start,
      end,
      status: "confirmed" as const,
      notes: notes.trim() || undefined,
    };
    if (editing) store.updateInternalEvent(editing.id, payload);
    else store.addInternalEvent(payload);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar tarefa interna" : "Nova tarefa interna"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Responsável</Label>
            <div className="flex flex-wrap gap-2">
              {INTERNAL_OWNERS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOwner(o)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                    owner === o
                      ? "border-primary/50 bg-surface-3 text-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: ownerColor(o) }}
                  />
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ie-title">Tarefa</Label>
            <Input
              id="ie-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Manutenção da bateria"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ie-date">Data</Label>
              <Input
                id="ie-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ie-start">Início</Label>
              <Input
                id="ie-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ie-end">Fim</Label>
              <Input
                id="ie-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ie-notes">Observações</Label>
            <Textarea
              id="ie-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editing ? (
            <button
              onClick={() => {
                store.deleteInternalEvent(editing.id);
                onOpenChange(false);
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[12.5px] font-semibold text-primary transition-colors hover:bg-surface-2"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={save}
            disabled={!title.trim()}
            className="rounded-md bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {editing ? "Salvar" : "Criar tarefa"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
