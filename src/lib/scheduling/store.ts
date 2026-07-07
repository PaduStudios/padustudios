// Padu OS store — mirrors state between an in-memory cache (for React's
// useSyncExternalStore) and Lovable Cloud (Supabase) so the UI stays instant
// while writes are persisted. Reads hydrate on module load.

import type { Appointment, Client, Lead } from "./types";
import { toISODate } from "./time";
import { supabase } from "@/integrations/supabase/client";

interface StoreShape {
  clients: Client[];
  appointments: Appointment[];
  leads: Lead[];
}

const listeners = new Set<() => void>();
let state: StoreShape = { clients: [], appointments: [], leads: [] };
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: StoreShape) {
  state = next;
  emit();
}

// ---------- mapping helpers ----------
function mapClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    email: (row.email as string) || undefined,
    cpf: (row.cpf as string) || undefined,
    band: (row.band as string) || undefined,
    members: (row.members as number) ?? undefined,
    notes: (row.notes as string) || undefined,
    origin: (row.origin as Client["origin"]) || "other",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    date: row.date as string,
    start: row.start_time as string,
    end: row.end_time as string,
    endsNextDay: (row.ends_next_day as boolean) ?? false,
    status: (row.status as Appointment["status"]) || "confirmed",
    room: (row.room as string) || undefined,
    price: (row.price as number) ?? undefined,
    paymentMethod: (row.payment_method as string) || undefined,
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
  };
}

// ---------- hydration ----------
export async function hydrateStore() {
  if (hydrated) return;
  hydrated = true;
  try {
    const [{ data: cRows }, { data: aRows }] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").order("date", { ascending: true }),
    ]);
    setState({
      clients: (cRows ?? []).map(mapClient),
      appointments: (aRows ?? []).map(mapAppointment),
      leads: [],
    });
  } catch (err) {
    console.error("Failed to hydrate from Cloud", err);
  }
}

if (typeof window !== "undefined") {
  void hydrateStore();
  // Realtime — keep all open tabs in sync
  supabase
    .channel("padu-scheduling")
    .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => void refreshClients())
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void refreshAppointments())
    .subscribe();
}

async function refreshClients() {
  const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  setState({ ...state, clients: (data ?? []).map(mapClient) });
}
async function refreshAppointments() {
  const { data } = await supabase.from("appointments").select("*").order("date", { ascending: true });
  setState({ ...state, appointments: (data ?? []).map(mapAppointment) });
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
    return { clients: [], appointments: [], leads: [] };
  },
  async addClient(input: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: input.name,
        phone: input.phone,
        email: input.email,
        cpf: input.cpf,
        band: input.band,
        members: input.members,
        notes: input.notes,
        origin: input.origin,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("insert failed");
    const client = mapClient(data);
    setState({ ...state, clients: [client, ...state.clients] });
    return client;
  },
  findClientByPhone(phone: string): Client | undefined {
    const norm = phone.replace(/\D/g, "");
    return state.clients.find((c) => c.phone.replace(/\D/g, "") === norm);
  },
  async addAppointment(input: Omit<Appointment, "id" | "createdAt">): Promise<Appointment> {
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        client_id: input.clientId,
        date: input.date,
        start_time: input.start,
        end_time: input.end,
        ends_next_day: input.endsNextDay ?? false,
        status: input.status,
        room: input.room,
        price: input.price,
        payment_method: input.paymentMethod,
        notes: input.notes,
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("insert failed");
    const appt = mapAppointment(data);
    setState({ ...state, appointments: [...state.appointments, appt] });
    return appt;
  },
  async updateAppointment(id: string, patch: Partial<Appointment>) {
    const payload: {
      status?: string; date?: string; start_time?: string; end_time?: string;
      ends_next_day?: boolean; room?: string | null; price?: number | null;
      notes?: string | null;
    } = {};
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.date !== undefined) payload.date = patch.date;
    if (patch.start !== undefined) payload.start_time = patch.start;
    if (patch.end !== undefined) payload.end_time = patch.end;
    if (patch.endsNextDay !== undefined) payload.ends_next_day = patch.endsNextDay;
    if (patch.room !== undefined) payload.room = patch.room ?? null;
    if (patch.price !== undefined) payload.price = patch.price ?? null;
    if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
    await supabase.from("appointments").update(payload).eq("id", id);
    setState({
      ...state,
      appointments: state.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  },
  async deleteAppointment(id: string) {
    await supabase.from("appointments").delete().eq("id", id);
    setState({
      ...state,
      appointments: state.appointments.filter((a) => a.id !== id),
    });
  },
  addLead(input: Omit<Lead, "id" | "createdAt">): Lead {
    const lead: Lead = {
      ...input,
      id: `l${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setState({ ...state, leads: [...state.leads, lead] });
    return lead;
  },
};

export function todayISO(): string {
  return toISODate(new Date());
}
