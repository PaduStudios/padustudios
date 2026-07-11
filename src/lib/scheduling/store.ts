// Mock store — localStorage-backed for now.
// Every write is wrapped in a tiny pub/sub so React components can subscribe
// via useSyncExternalStore. When we plug in the backend, we swap this module
// for a Supabase client without touching the UI.

import { addDays, format } from "date-fns";
import type { Appointment, Client, Lead } from "./types";
import { toISODate } from "./time";

const STORAGE_KEY = "padu-os:store:v1";

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
  const now = new Date().toISOString();
  const today = new Date();
  const clients: Client[] = [
    {
      id: "c1",
      name: "Sérgio Dias",
      phone: "+55 11 91234-5678",
      email: "sergio@osmutantes.com",
      band: "Os Mutantes",
      members: 4,
      origin: "whatsapp",
      notes: "Preferência por Sala A. Chega 15min antes.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c2",
      name: "Andreas Kisser",
      phone: "+55 11 98888-1122",
      email: "andreas@sepultura.com",
      band: "Sepultura",
      members: 5,
      origin: "instagram",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c3",
      name: "Marina Lima",
      phone: "+55 11 97777-3344",
      band: "Necroshiva",
      members: 3,
      origin: "site",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c4",
      name: "Rafael Torres",
      phone: "+55 11 96666-4455",
      band: "The Void Echoes",
      members: 4,
      origin: "whatsapp",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c5",
      name: "Julia Ferraz",
      phone: "+55 11 95555-6677",
      band: "Black Lullaby",
      members: 4,
      origin: "phone",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const d = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");

  const appointments: Appointment[] = [
    {
      id: "a1",
      clientId: "c1",
      date: d(0),
      start: "10:00",
      end: "12:00",
      status: "confirmed",
      room: "Sala A",
      price: 280,
      notes: "Trazer contrabaixo próprio.",
      createdAt: now,
    },
    {
      id: "a2",
      clientId: "c2",
      date: d(0),
      start: "14:00",
      end: "18:00",
      status: "confirmed",
      room: "Sala Master",
      price: 620,
      createdAt: now,
    },
    {
      id: "a3",
      clientId: "c3",
      date: d(1),
      start: "19:00",
      end: "21:00",
      status: "pending",
      room: "Sala A",
      price: 280,
      createdAt: now,
    },
    {
      id: "a4",
      clientId: "c4",
      date: d(2),
      start: "16:00",
      end: "18:00",
      status: "confirmed",
      room: "Sala B",
      price: 240,
      createdAt: now,
    },
    {
      id: "a5",
      clientId: "c5",
      date: d(3),
      start: "20:00",
      end: "22:00",
      status: "confirmed",
      room: "Sala A",
      price: 280,
      createdAt: now,
    },
    {
      id: "a6",
      clientId: "c1",
      date: d(4),
      start: "09:00",
      end: "11:00",
      status: "pending",
      room: "Sala A",
      price: 280,
      createdAt: now,
    },
    {
      id: "a7",
      clientId: "c4",
      date: d(-1),
      start: "18:00",
      end: "20:00",
      status: "confirmed",
      room: "Sala B",
      price: 240,
      createdAt: now,
    },
  ];

  return { clients, appointments, leads: [] };
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
