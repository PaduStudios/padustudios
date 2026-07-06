// Padu OS — Scheduling domain types.
// Shared between the mock store, the smart-availability engine, and UI.

export type AppointmentStatus = "confirmed" | "pending" | "blocked" | "cancelled";

export type ClientOrigin = "whatsapp" | "site" | "instagram" | "phone" | "walkin" | "other";

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  band?: string;
  members?: number;
  notes?: string;
  origin: ClientOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  /** ISO date (yyyy-MM-dd) for the day this appointment sits on. */
  date: string;
  /** 24h "HH:mm". */
  start: string;
  /** 24h "HH:mm". End is exclusive. */
  end: string;
  status: AppointmentStatus;
  room?: string;
  price?: number;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  desiredDate: string;
  desiredStart: string;
  desiredEnd: string;
  reason: string;
  status: "open" | "converted" | "lost";
  createdAt: string;
}

/** A single slot suggestion produced by the smart availability engine. */
export interface SlotSuggestion {
  date: string;
  start: string;
  end: string;
  /** Why this slot was suggested — used to render human-readable copy. */
  reason:
    | "requested"
    | "same-day-earlier"
    | "same-day-later"
    | "same-week-same-time";
  /** Distance from the original request, useful for ranking. */
  distanceMinutes: number;
}
