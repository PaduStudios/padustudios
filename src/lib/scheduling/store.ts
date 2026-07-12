// Store — backed by Lovable Cloud (Supabase) with an in-memory cache and
// pub/sub for useSyncExternalStore. Mutations are optimistic: the local
// cache updates immediately, the network write happens in the background,
// and a failed write reverts the change and surfaces a toast.
//
// Same public API as the previous localStorage store so no UI change is
// required — components keep calling store.addClient(...) etc. synchronously.

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Appointment, Client, FinanceEntry, Lead } from "./types";
import { toISODate } from "./time";

interface StoreShape {
  clients: Client[];
  appointments: Appointment[];
  finance: FinanceEntry[];
  leads: Lead[];
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

const emptyState: StoreShape = { clients: [], appointments: [], finance: [], leads: [] };
let state: StoreShape = emptyState;

function setState(next: StoreShape) {
  state = next;
  emit();
}

// ── Row ↔ domain mapping ─────────────────────────────────────────────────────

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  band: string | null;
  members: number | null;
  origin: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ApptRow = {
  id: string;
  client_id: string;
  date: string;
  start_time: string;
  end_time: string;
  ends_next_day: boolean;
  status: string;
  room: string | null;
  price: number | string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

function rowToClient(r: ClientRow): Client {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? undefined,
    cpf: r.cpf ?? undefined,
    band: r.band ?? undefined,
    members: r.members ?? undefined,
    origin: (r.origin as Client["origin"]) ?? "other",
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToAppt(r: ApptRow): Appointment {
  return {
    id: r.id,
    clientId: r.client_id,
    date: r.date,
    start: r.start_time,
    end: r.end_time,
    status: r.status as Appointment["status"],
    room: r.room ?? undefined,
    price: r.price == null ? undefined : Number(r.price),
    paymentMethod: r.payment_method ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

export function clientToRow(c: Partial<Client>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.id !== undefined) out.id = c.id;
  if (c.name !== undefined) out.name = c.name;
  if (c.phone !== undefined) out.phone = c.phone;
  if (c.email !== undefined) out.email = c.email ?? null;
  if (c.cpf !== undefined) out.cpf = c.cpf ?? null;
  if (c.band !== undefined) out.band = c.band ?? null;
  if (c.members !== undefined) out.members = c.members ?? null;
  if (c.origin !== undefined) out.origin = c.origin;
  if (c.notes !== undefined) out.notes = c.notes ?? null;
  return out;
}

export function apptToRow(a: Partial<Appointment>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.id !== undefined) out.id = a.id;
  if (a.clientId !== undefined) out.client_id = a.clientId;
  if (a.date !== undefined) out.date = a.date;
  if (a.start !== undefined) out.start_time = a.start;
  if (a.end !== undefined) out.end_time = a.end;
  if (a.status !== undefined) out.status = a.status;
  if (a.room !== undefined) out.room = a.room ?? null;
  if (a.price !== undefined) out.price = a.price ?? null;
  if (a.paymentMethod !== undefined) out.payment_method = a.paymentMethod ?? null;
  if (a.notes !== undefined) out.notes = a.notes ?? null;
  return out;
}

type FinanceRow = {
  id: string;
  kind: string;
  category: string;
  amount: number | string;
  date: string;
  description: string | null;
  created_at: string;
};

function rowToFinance(r: FinanceRow): FinanceEntry {
  return {
    id: r.id,
    kind: r.kind as FinanceEntry["kind"],
    category: r.category,
    amount: Number(r.amount),
    date: r.date,
    description: r.description ?? undefined,
    createdAt: r.created_at,
  };
}

export function financeToRow(f: Partial<FinanceEntry>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.id !== undefined) out.id = f.id;
  if (f.kind !== undefined) out.kind = f.kind;
  if (f.category !== undefined) out.category = f.category;
  if (f.amount !== undefined) out.amount = f.amount;
  if (f.date !== undefined) out.date = f.date;
  if (f.description !== undefined) out.description = f.description ?? null;
  return out;
}

// ── Boot / refresh ───────────────────────────────────────────────────────────

let bootPromise: Promise<void> | null = null;

async function boot() {
  const [
    { data: clientRows, error: cErr },
    { data: apptRows, error: aErr },
    { data: finRows, error: fErr },
  ] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("appointments").select("*").order("date", { ascending: false }),
    supabase.from("finance_entries").select("*").order("date", { ascending: false }),
  ]);
  if (cErr) {
    console.error("[store] failed to load clients", cErr);
    toast.error("Não consegui carregar clientes do servidor", {
      description: cErr.message,
    });
  }
  if (aErr) {
    console.error("[store] failed to load appointments", aErr);
    toast.error("Não consegui carregar agendamentos do servidor", {
      description: aErr.message,
    });
  }
  if (fErr) {
    console.error("[store] failed to load finance entries", fErr);
    toast.error("Não consegui carregar lançamentos financeiros", {
      description: fErr.message,
    });
  }
  setState({
    clients: (clientRows ?? []).map((r) => rowToClient(r as ClientRow)),
    appointments: (apptRows ?? []).map((r) => rowToAppt(r as ApptRow)),
    finance: (finRows ?? []).map((r) => rowToFinance(r as FinanceRow)),
    leads: state.leads,
  });
}

function ensureBooted() {
  if (typeof window === "undefined") return;
  if (!bootPromise) bootPromise = boot();
}

// ── Store API ────────────────────────────────────────────────────────────────

function reportError(action: string, error: { message?: string } | null | undefined) {
  console.error(`[store] ${action} failed`, error);
  toast.error(`Falha ao ${action}`, { description: error?.message });
}

export const store = {
  subscribe(fn: () => void) {
    ensureBooted();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot(): StoreShape {
    ensureBooted();
    return state;
  },
  getServerSnapshot(): StoreShape {
    return emptyState;
  },

  /** Refetch everything from the server. Called after bulk imports. */
  async refresh() {
    bootPromise = boot();
    await bootPromise;
  },

  // ── Clients ──────────────────────────────────────────────────────────────
  addClient(input: Omit<Client, "id" | "createdAt" | "updatedAt">): Client {
    const now = new Date().toISOString();
    const client: Client = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setState({ ...state, clients: [client, ...state.clients] });

    void supabase
      .from("clients")
      .insert(clientToRow(client) as never)
      .then(({ error }) => {
        if (error) {
          setState({ ...state, clients: state.clients.filter((c) => c.id !== client.id) });
          reportError("salvar cliente", error);
        }
      });

    return client;
  },
  findClientByPhone(phone: string): Client | undefined {
    const norm = phone.replace(/\D/g, "");
    return state.clients.find((c) => c.phone.replace(/\D/g, "") === norm);
  },
  updateClient(id: string, patch: Partial<Omit<Client, "id" | "createdAt">>) {
    const now = new Date().toISOString();
    const prev = state.clients.find((c) => c.id === id);
    if (!prev) return;
    setState({
      ...state,
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: now } : c
      ),
    });
    void supabase
      .from("clients")
      .update(clientToRow(patch) as never)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          setState({
            ...state,
            clients: state.clients.map((c) => (c.id === id ? prev : c)),
          });
          reportError("atualizar cliente", error);
        }
      });
  },
  deleteClient(id: string) {
    const prev = state.clients.find((c) => c.id === id);
    if (!prev) return;
    setState({ ...state, clients: state.clients.filter((c) => c.id !== id) });
    void supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          setState({ ...state, clients: [prev, ...state.clients] });
          reportError("remover cliente", error);
        }
      });
  },

  // ── Appointments ─────────────────────────────────────────────────────────
  addAppointment(input: Omit<Appointment, "id" | "createdAt">): Appointment {
    const appt: Appointment = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setState({ ...state, appointments: [appt, ...state.appointments] });

    void supabase
      .from("appointments")
      .insert(apptToRow(appt) as never)
      .then(({ error }) => {
        if (error) {
          setState({
            ...state,
            appointments: state.appointments.filter((a) => a.id !== appt.id),
          });
          reportError("salvar agendamento", error);
        }
      });

    return appt;
  },
  updateAppointment(id: string, patch: Partial<Appointment>) {
    const prev = state.appointments.find((a) => a.id === id);
    if (!prev) return;
    setState({
      ...state,
      appointments: state.appointments.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    });
    void supabase
      .from("appointments")
      .update(apptToRow(patch) as never)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          setState({
            ...state,
            appointments: state.appointments.map((a) => (a.id === id ? prev : a)),
          });
          reportError("atualizar agendamento", error);
        }
      });
  },
  deleteAppointment(id: string) {
    const prev = state.appointments.find((a) => a.id === id);
    if (!prev) return;
    setState({
      ...state,
      appointments: state.appointments.filter((a) => a.id !== id),
    });
    void supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          setState({ ...state, appointments: [prev, ...state.appointments] });
          reportError("remover agendamento", error);
        }
      });
  },

  // ── Leads (in-memory only — no table yet) ────────────────────────────────
  addLead(input: Omit<Lead, "id" | "createdAt">): Lead {
    const lead: Lead = {
      ...input,
      id: `l${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setState({ ...state, leads: [...state.leads, lead] });
    return lead;
  },
  updateLead(id: string, patch: Partial<Omit<Lead, "id" | "createdAt">>) {
    setState({
      ...state,
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  },
  deleteLead(id: string) {
    setState({ ...state, leads: state.leads.filter((l) => l.id !== id) });
  },

  reset() {
    setState(emptyState);
  },
};

export function todayISO(): string {
  return toISODate(new Date());
}
