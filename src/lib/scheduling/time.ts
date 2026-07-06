// Time helpers shared by calendar UI and the smart-availability engine.
// Kept dependency-light so this file is easy to move to a server package later.

import {
  addDays,
  addMinutes,
  format,
  parse,
  startOfWeek,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 24; // exclusive — the last visible row is 23:00
export const SLOT_MINUTES = 30;

/** Convert "HH:mm" into minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Convert minutes since midnight back into "HH:mm". */
export function minutesToTime(mins: number): string {
  const total = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromISODate(iso: string): Date {
  return parse(iso, "yyyy-MM-dd", new Date());
}

export function weekDays(anchor: Date): Date[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDayLabel(date: Date): { weekday: string; day: string } {
  return {
    weekday: format(date, "EEE", { locale: ptBR }).replace(".", ""),
    day: format(date, "dd"),
  };
}

export function formatMonthYear(date: Date): string {
  const raw = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function addMinutesToTime(hhmm: string, minutes: number): string {
  const base = parse(hhmm, "HH:mm", new Date());
  return format(addMinutes(base, minutes), "HH:mm");
}

/** Rows to render for the day column (one per SLOT_MINUTES). */
export function daySlots(): string[] {
  const slots: string[] = [];
  const start = DAY_START_HOUR * 60;
  const end = DAY_END_HOUR * 60;
  for (let m = start; m < end; m += SLOT_MINUTES) slots.push(minutesToTime(m));
  return slots;
}
