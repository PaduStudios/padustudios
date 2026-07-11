// Mock store — localStorage-backed for now.
// Every write is wrapped in a tiny pub/sub so React components can subscribe
// via useSyncExternalStore. When we plug in the backend, we swap this module
// for a Supabase client without touching the UI.

import type { Appointment, Client, Lead } from "./types";
import { toISODate } from "./time";

// Bump this suffix to force-reset local state for existing users.
const STORAGE_KEY = "padu-os:store:v2";

interface StoreShape {
  clients: Client[];
  appointments: Appointment[];
  leads: Lead[];
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function seed(): StoreShape {
  // Start empty — no demo data.
  return { clients: [], appointments: [], leads: [] };
}

function readState(): StoreShape {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = seed();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as StoreShape;
  } catch {
    return seed();
  }
}

let state: StoreShape = readState();

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
}

const serverSnapshot: StoreShape = seed();

export const store = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot(): StoreShape {
    return state;
  },
  getServerSnapshot(): StoreShape {
    return serverSnapshot;
  },
  reset() {
    state = seed();
    persist();
  },

  // ── Clients ────────────────────────────────────────────────────────────────
  addClient(input: Omit<Client, "id" | "createdAt" | "updatedAt">): Client {
    const now = new Date().toISOString();
    const client: Client = {
      ...input,
      id: `c${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    state = { ...state, clients: [...state.clients, client] };
    persist();
    return client;
  },
  findClientByPhone(phone: string): Client | undefined {
    const norm = phone.replace(/\D/g, "");
    return state.clients.find((c) => c.phone.replace(/\D/g, "") === norm);
  },
  updateClient(id: string, patch: Partial<Omit<Client, "id" | "createdAt">>) {
    const now = new Date().toISOString();
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: now } : c
      ),
    };
    persist();
  },
  deleteClient(id: string) {
    state = {
      ...state,
      clients: state.clients.filter((c) => c.id !== id),
    };
    persist();
  },

  // ── Appointments ───────────────────────────────────────────────────────────
  addAppointment(
    input: Omit<Appointment, "id" | "createdAt">
  ): Appointment {
    const appt: Appointment = {
      ...input,
      id: `a${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    state = { ...state, appointments: [...state.appointments, appt] };
    persist();
    return appt;
  },
  updateAppointment(id: string, patch: Partial<Appointment>) {
    state = {
      ...state,
      appointments: state.appointments.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    };
    persist();
  },
  deleteAppointment(id: string) {
    state = {
      ...state,
      appointments: state.appointments.filter((a) => a.id !== id),
    };
    persist();
  },

  // ── Leads ──────────────────────────────────────────────────────────────────
  addLead(input: Omit<Lead, "id" | "createdAt">): Lead {
    const lead: Lead = {
      ...input,
      id: `l${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    state = { ...state, leads: [...state.leads, lead] };
    persist();
    return lead;
  },
  updateLead(id: string, patch: Partial<Omit<Lead, "id" | "createdAt">>) {
    state = {
      ...state,
      leads: state.leads.map((l) =>
        l.id === id ? { ...l, ...patch } : l
      ),
    };
    persist();
  },
  deleteLead(id: string) {
    state = {
      ...state,
      leads: state.leads.filter((l) => l.id !== id),
    };
    persist();
  },
};

export function todayISO(): string {
  return toISODate(new Date());
}
