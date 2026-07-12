// Pricing rules for Padu Studios.
//
//  - Ensaio:              R$ 80 / hora
//  - Gravação ao Vivo:    (R$ 80 ensaio + R$ 80 gravação) × horas + R$ 160
//                         (montagem e desmontagem da sala)
//  - Gravação por Canal:  orçado à parte — sem valor sugerido.

export const ROOMS = ["Ensaio", "Gravação ao Vivo", "Gravação por Canal"] as const;
export type Room = (typeof ROOMS)[number];

export const HOURLY_REHEARSAL = 80;
export const HOURLY_LIVE_RECORDING = 160;
export const LIVE_RECORDING_SETUP = 160;

/**
 * Suggested price for a room + duration in minutes.
 * Returns `undefined` when the room has no default (Gravação por Canal).
 */
export function suggestedPrice(
  room: string,
  durationMinutes: number
): number | undefined {
  const hours = durationMinutes / 60;
  if (room === "Ensaio") return round2(HOURLY_REHEARSAL * hours);
  if (room === "Gravação ao Vivo")
    return round2(HOURLY_LIVE_RECORDING * hours + LIVE_RECORDING_SETUP);
  return undefined;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
