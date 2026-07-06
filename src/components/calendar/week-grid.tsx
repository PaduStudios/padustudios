import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  formatDayLabel,
  isToday,
  timeToMinutes,
  toISODate,
} from "@/lib/scheduling/time";
import type { Appointment, Client } from "@/lib/scheduling/types";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 44; // px per 30-min slot
const HOURS = DAY_END_HOUR - DAY_START_HOUR;

interface Props {
  days: Date[];
  appointments: Appointment[];
  clients: Client[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEmptyClick: (date: string, start: string) => void;
}

export function WeekGrid({
  days,
  appointments,
  clients,
  selectedId,
  onSelect,
  onEmptyClick,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const clientMap = new Map(clients.map((c) => [c.id, c] as const));

  // On mount, scroll to a bit before current time (or 09:00)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    const anchorMin =
      now.getHours() >= DAY_START_HOUR && now.getHours() < DAY_END_HOUR
        ? now.getHours() * 60 + now.getMinutes() - 60
        : 9 * 60;
    const y =
      ((Math.max(anchorMin - DAY_START_HOUR * 60, 0)) / 30) * ROW_HEIGHT;
    el.scrollTop = y;
  }, []);

  return (
    <div className="surface-panel flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header row */}
      <div className="grid shrink-0 grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border">
        <div className="border-r border-border" />
        {days.map((day) => {
          const { weekday, day: d } = formatDayLabel(day);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 border-r border-border py-2.5 last:border-r-0 transition-colors",
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

      {/* Body */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto"
        style={{ contain: "strict" }}
      >
        <div
          className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
          style={{ height: HOURS * 2 * ROW_HEIGHT }}
        >
          {/* Hour column */}
          <div className="relative border-r border-border">
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

          {/* Day columns */}
          {days.map((day) => {
            const iso = toISODate(day);
            const dayAppts = appointments.filter(
              (a) => a.date === iso && a.status !== "cancelled"
            );
            return (
              <DayColumn
                key={iso}
                iso={iso}
                today={isToday(day)}
                appointments={dayAppts}
                clientMap={clientMap}
                selectedId={selectedId}
                onSelect={onSelect}
                onEmptyClick={onEmptyClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  iso,
  today,
  appointments,
  clientMap,
  selectedId,
  onSelect,
  onEmptyClick,
}: {
  iso: string;
  today: boolean;
  appointments: Appointment[];
  clientMap: Map<string, Client>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEmptyClick: (date: string, start: string) => void;
}) {
  const now = new Date();
  const currentIso = toISODate(now);
  const currentMinFromStart =
    now.getHours() * 60 + now.getMinutes() - DAY_START_HOUR * 60;
  const showNowLine =
    iso === currentIso &&
    currentMinFromStart >= 0 &&
    currentMinFromStart <= HOURS * 60;

  return (
    <div
      className={cn(
        "relative border-r border-border last:border-r-0",
        today && "bg-primary-muted/25"
      )}
      onClick={(e) => {
        // Clicking empty area — compute slot from Y
        if ((e.target as HTMLElement).dataset.slotTarget !== "1") return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const slotIndex = Math.floor(y / ROW_HEIGHT);
        const minutes = DAY_START_HOUR * 60 + slotIndex * 30;
        const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
        const mm = String(minutes % 60).padStart(2, "0");
        onEmptyClick(iso, `${hh}:${mm}`);
      }}
      data-slot-target="1"
    >
      {/* Hairline grid */}
      {Array.from({ length: HOURS * 2 }).map((_, i) => (
        <div
          key={i}
          data-slot-target="1"
          className={cn(
            "absolute inset-x-0 h-[44px] transition-colors hover:bg-primary-muted/40",
            i % 2 === 0 ? "border-t border-border" : "border-t border-border/40"
          )}
          style={{ top: i * ROW_HEIGHT }}
        />
      ))}

      {/* Current-time indicator */}
      {showNowLine && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: (currentMinFromStart / 30) * ROW_HEIGHT }}
        >
          <div className="relative">
            <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            <div className="h-px bg-primary" />
          </div>
        </div>
      )}

      {/* Appointments */}
      {appointments.map((appt) => {
        const client = clientMap.get(appt.clientId);
        const startMin =
          timeToMinutes(appt.start) - DAY_START_HOUR * 60;
        const endMin = timeToMinutes(appt.end) - DAY_START_HOUR * 60;
        const top = (startMin / 30) * ROW_HEIGHT;
        const height = ((endMin - startMin) / 30) * ROW_HEIGHT - 4;
        return (
          <AppointmentBlock
            key={appt.id}
            appt={appt}
            client={client}
            top={top}
            height={height}
            selected={selectedId === appt.id}
            onSelect={() => onSelect(appt.id)}
          />
        );
      })}
    </div>
  );
}

function AppointmentBlock({
  appt,
  client,
  top,
  height,
  selected,
  onSelect,
}: {
  appt: Appointment;
  client?: Client;
  top: number;
  height: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const statusColor = {
    confirmed: "var(--status-confirmed)",
    pending: "var(--status-pending)",
    blocked: "var(--status-blocked)",
    cancelled: "var(--muted-foreground)",
  }[appt.status];

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.005 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "group absolute left-1 right-1 flex flex-col overflow-hidden rounded-md p-2 text-left transition-all",
        selected && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
      )}
      style={{
        top,
        height: Math.max(28, height),
        background: `color-mix(in oklch, ${statusColor} 18%, var(--surface))`,
        borderLeft: `3px solid ${statusColor}`,
        boxShadow:
          "inset 0 1px 0 color-mix(in oklch, white 5%, transparent), 0 1px 2px color-mix(in oklch, black 40%, transparent)",
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="truncate text-[12px] font-semibold leading-tight">
          {client?.band || client?.name || "Sem título"}
        </p>
      </div>
      {height >= 40 && (
        <p className="mt-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          {appt.start} – {appt.end}
          {appt.room ? ` · ${appt.room}` : ""}
        </p>
      )}
    </motion.button>
  );
}
