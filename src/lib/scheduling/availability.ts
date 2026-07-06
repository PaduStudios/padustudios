// Smart availability engine — the heart of Padu OS.
// Given a desired slot, it decides:
//   1. Is the slot free right now?
//   2. If not, is there a free slot on the SAME DAY within ±2h?
//   3. If not, is there the SAME time slot on another day of the same week?
//   4. Otherwise → register as "lead sem disponibilidade".
//
// Pure functions — no I/O — so this is trivial to test and to lift to a server.

import { addDays } from "date-fns";
import type { Appointment, SlotSuggestion } from "./types";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  fromISODate,
  timeToMinutes,
  minutesToTime,
  toISODate,
  weekDays,
} from "./time";

const NEARBY_WINDOW_MIN = 120; // ±2h

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isSlotFree(
  appointments: Appointment[],
  date: string,
  start: string,
  end: string
): boolean {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return !appointments.some(
    (a) =>
      a.status !== "cancelled" &&
      a.date === date &&
      overlaps(s, e, timeToMinutes(a.start), timeToMinutes(a.end))
  );
}

interface DesiredSlot {
  date: string;
  start: string;
  end: string;
}

export interface AvailabilityResult {
  requested: DesiredSlot;
  isFree: boolean;
  suggestions: SlotSuggestion[];
}

/**
 * Return up to 4 alternative suggestions:
 *   - same day, offset by ±30/±60/±90/±120 min (whichever is free)
 *   - same time on the 6 nearby days in the same week
 */
export function findAlternatives(
  appointments: Appointment[],
  desired: DesiredSlot
): AvailabilityResult {
  const durationMin = timeToMinutes(desired.end) - timeToMinutes(desired.start);
  const desiredStartMin = timeToMinutes(desired.start);
  const dayStart = DAY_START_HOUR * 60;
  const dayEnd = DAY_END_HOUR * 60;

  const free = isSlotFree(
    appointments,
    desired.date,
    desired.start,
    desired.end
  );

  const suggestions: SlotSuggestion[] = [];

  // 1) same day, within ±2h — try offsets alternating outward
  const offsets: number[] = [];
  for (let step = 30; step <= NEARBY_WINDOW_MIN; step += 30) {
    offsets.push(-step, step);
  }
  for (const offset of offsets) {
    if (suggestions.length >= 2) break;
    const startMin = desiredStartMin + offset;
    const endMin = startMin + durationMin;
    if (startMin < dayStart || endMin > dayEnd) continue;
    const start = minutesToTime(startMin);
    const end = minutesToTime(endMin);
    if (
      isSlotFree(appointments, desired.date, start, end) &&
      !suggestions.some((s) => s.date === desired.date && s.start === start)
    ) {
      suggestions.push({
        date: desired.date,
        start,
        end,
        reason: offset < 0 ? "same-day-earlier" : "same-day-later",
        distanceMinutes: Math.abs(offset),
      });
    }
  }

  // 2) same time on other days of the same week
  const weekAnchor = fromISODate(desired.date);
  for (const day of weekDays(weekAnchor)) {
    if (suggestions.length >= 4) break;
    const iso = toISODate(day);
    if (iso === desired.date) continue;
    if (
      isSlotFree(appointments, iso, desired.start, desired.end)
    ) {
      const dayDelta = Math.abs(
        Math.round((day.getTime() - weekAnchor.getTime()) / 86400000)
      );
      suggestions.push({
        date: iso,
        start: desired.start,
        end: desired.end,
        reason: "same-week-same-time",
        distanceMinutes: dayDelta * 24 * 60,
      });
    }
  }

  // 3) as a last resort, same time next week — kept short, mostly for empty studios
  if (suggestions.length === 0) {
    for (let i = 1; i <= 7 && suggestions.length < 2; i++) {
      const iso = toISODate(addDays(weekAnchor, i + 7));
      if (isSlotFree(appointments, iso, desired.start, desired.end)) {
        suggestions.push({
          date: iso,
          start: desired.start,
          end: desired.end,
          reason: "same-week-same-time",
          distanceMinutes: (i + 7) * 24 * 60,
        });
      }
    }
  }

  return {
    requested: desired,
    isFree: free,
    suggestions: suggestions.sort(
      (a, b) => a.distanceMinutes - b.distanceMinutes
    ),
  };
}
