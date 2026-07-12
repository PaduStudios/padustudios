// Orchestrator: reads mapped CSV rows and applies them to the current store,
// deduping clients by normalized phone. Bulk-writes to Lovable Cloud on
// commit, then refreshes the local snapshot so the UI reflects the new
// server truth.

import { supabase } from "@/integrations/supabase/client";
import { store, clientToRow, apptToRow } from "@/lib/scheduling/store";
import type { Appointment, Client, ClientOrigin } from "@/lib/scheduling/types";
import {
  addMinutes,
  mapOrigin,

  mapStatus,
  normalizeCpf,
  normalizePhone,
  parseCombinedDateTime,
  parseDate,
  parseDurationMinutes,
  parsePrice,
  parseTime,
  pickCell,
  type AppointmentField,
  type ClientField,
  type CsvRow,
} from "./supersaas-csv";

export interface ClientMapping extends Record<ClientField, string | null> {}
export interface AppointmentMapping
  extends Record<AppointmentField, string | null> {}

export interface ImportOptions {
  dateLocale: "br" | "us" | "iso";
  defaultOrigin: ClientOrigin;
  /** When true, `start` / `end` cells contain a combined "DD/MM/YYYY HH:MM" value. */
  combinedDateTime?: boolean;
}

export interface ClientImportPlan {
  toCreate: Array<Omit<Client, "id" | "createdAt" | "updatedAt">>;
  toMerge: Array<{ existingId: string; patch: Partial<Client> }>;
  skipped: Array<{ row: number; reason: string }>;
}

export interface AppointmentImportPlan {
  toCreate: Array<
    Omit<Appointment, "id" | "createdAt"> & { _clientKey: string }
  >;
  skipped: Array<{ row: number; reason: string }>;
}

// A phone is considered a real, mergeable identifier only when it has at
// least 8 digits and isn't just repeated zeros/nines/etc. Everything else
// (empty, "0", "00000", "999") is a placeholder — each occurrence becomes
// its own client so distinct people don't collapse into one.
function isPlaceholderPhone(digits: string): boolean {
  if (!digits) return true;
  if (digits.length < 8) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  return false;
}

function normName(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Client key rules:
 *   - valid phone → `v:<digits>|<name>`  (merge only when phone AND name match)
 *   - placeholder → `p:<rowNum>|<name>`  (always unique per CSV row)
 */
function clientKeyForRow(
  rowNum: number,
  name: string,
  phoneDigits: string
): string {
  if (isPlaceholderPhone(phoneDigits)) return `p:${rowNum}|${normName(name)}`;
  return `v:${phoneDigits}|${normName(name)}`;
}

export function buildClientPlan(
  rows: CsvRow[],
  mapping: ClientMapping,
  options: ImportOptions
): ClientImportPlan {
  const existing = store.getSnapshot().clients;
  // Index existing clients by the same compound key so re-imports don't duplicate them.
  const byKey = new Map<string, Client>();
  existing.forEach((c) => {
    const digits = normalizePhone(c.phone);
    if (isPlaceholderPhone(digits)) return; // placeholders never merge across imports
    byKey.set(`v:${digits}|${normName(c.name)}`, c);
  });
  const seenInBatch = new Set<string>();

  const toCreate: ClientImportPlan["toCreate"] = [];
  const toMerge: ClientImportPlan["toMerge"] = [];
  const skipped: ClientImportPlan["skipped"] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // account for header
    const name = pickCell(row, mapping.name);
    const phoneRaw = pickCell(row, mapping.phone);
    const phone = normalizePhone(phoneRaw);
    if (!name && !phone) {
      skipped.push({ row: rowNum, reason: "Linha sem nome e sem telefone" });
      return;
    }

    const key = clientKeyForRow(rowNum, name, phone);
    // For valid phones, dedupe repeats inside the same batch (combined mode
    // has one row per appointment, but the same client can appear many times).
    if (!isPlaceholderPhone(phone)) {
      if (seenInBatch.has(key)) return;
      seenInBatch.add(key);
    }

    const email = pickCell(row, mapping.email) || undefined;
    const cpf = normalizeCpf(pickCell(row, mapping.cpf)) || undefined;
    const band = pickCell(row, mapping.band) || undefined;
    const membersRaw = pickCell(row, mapping.members);
    const members = membersRaw ? Number(membersRaw) || undefined : undefined;
    const notes = pickCell(row, mapping.notes) || undefined;

    const existingClient = byKey.get(key);
    if (existingClient) {
      const patch: Partial<Client> = {};
      if (!existingClient.email && email) patch.email = email;
      if (!existingClient.cpf && cpf) patch.cpf = cpf;
      if (!existingClient.band && band) patch.band = band;
      if (!existingClient.members && members) patch.members = members;
      if (!existingClient.notes && notes) patch.notes = notes;
      if (Object.keys(patch).length > 0) {
        toMerge.push({ existingId: existingClient.id, patch });
      }
      return;
    }

    toCreate.push({
      name: name || phoneRaw || phone || "Sem nome",
      phone: phoneRaw || phone,
      email,
      cpf,
      band,
      members,
      origin: options.defaultOrigin,
      notes,
    });
  });

  return { toCreate, toMerge, skipped };
}

// ── Appointment plan ─────────────────────────────────────────────────────────

/** Build a lookup that includes both existing clients AND any planned new clients. */
function buildClientKeyIndex(
  plannedNewClients: ClientImportPlan["toCreate"]
): {
  byCompound: Map<string, string>; // v:<digits>|<name> → client key
  byName: Map<string, string>; // lower(name) → client key (fallback only)
} {
  const existing = store.getSnapshot().clients;
  const byCompound = new Map<string, string>();
  const byName = new Map<string, string>();

  existing.forEach((c) => {
    const digits = normalizePhone(c.phone);
    if (!isPlaceholderPhone(digits)) {
      byCompound.set(`v:${digits}|${normName(c.name)}`, `existing:${c.id}`);
    }
    if (c.name) byName.set(normName(c.name), `existing:${c.id}`);
  });
  plannedNewClients.forEach((c, i) => {
    const digits = normalizePhone(c.phone);
    const key = `new:${i}`;
    if (!isPlaceholderPhone(digits)) {
      byCompound.set(`v:${digits}|${normName(c.name)}`, key);
    }
    if (c.name) byName.set(normName(c.name), key);
  });
  return { byCompound, byName };
}


export function buildAppointmentPlan(
  rows: CsvRow[],
  mapping: AppointmentMapping,
  options: ImportOptions,
  plannedNewClients: ClientImportPlan["toCreate"]
): AppointmentImportPlan {
  const index = buildClientKeyIndex(plannedNewClients);
  const toCreate: AppointmentImportPlan["toCreate"] = [];
  const skipped: AppointmentImportPlan["skipped"] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;

    let date: string | null = null;
    let start: string | null = null;
    let end: string | null = null;
    let crossedMidnight = false;

    if (options.combinedDateTime) {
      const startRaw = pickCell(row, mapping.start);
      const parsedStart = parseCombinedDateTime(startRaw, options.dateLocale);
      if (!parsedStart) {
        skipped.push({ row: rowNum, reason: `Início inválido: "${startRaw}"` });
        return;
      }
      date = parsedStart.date;
      start = parsedStart.time;

      const endRaw = pickCell(row, mapping.end);
      const parsedEnd = parseCombinedDateTime(endRaw, options.dateLocale);
      if (parsedEnd) {
        if (parsedEnd.date !== date) {
          // Cross-midnight — cap at end of day and flag in notes below.
          end = "23:59";
          crossedMidnight = true;
        } else {
          end = parsedEnd.time;
        }
      }
    } else {
      const dateRaw = pickCell(row, mapping.date);
      date = parseDate(dateRaw, options.dateLocale);
      if (!date) {
        skipped.push({ row: rowNum, reason: `Data inválida: "${dateRaw}"` });
        return;
      }
      const startRaw = pickCell(row, mapping.start);
      start = parseTime(startRaw);
      if (!start) {
        skipped.push({ row: rowNum, reason: `Horário inválido: "${startRaw}"` });
        return;
      }
      end = parseTime(pickCell(row, mapping.end));
    }

    if (!start) {
      skipped.push({ row: rowNum, reason: `Sem horário de início` });
      return;
    }
    if (!end) {
      const dur = parseDurationMinutes(pickCell(row, mapping.duration));
      if (dur) end = addMinutes(start, dur);
    }
    if (!end) {
      skipped.push({
        row: rowNum,
        reason: `Sem horário de fim nem duração`,
      });
      return;
    }

    // Locate client — try the compound (phone+name) key first, then fall back to name.
    // For placeholder phones, we key by row so each appointment matches its own client
    // (created in the same order in buildClientPlan).
    const phone = normalizePhone(pickCell(row, mapping.phone));
    const userName = pickCell(row, mapping.userName);
    let clientKey: string | undefined;
    if (!isPlaceholderPhone(phone)) {
      clientKey = index.byCompound.get(`v:${phone}|${normName(userName)}`);
    } else {
      // Placeholder phone: match the new client created for this same row.
      // buildClientPlan preserves row order, so `new:<idx>` aligns with rowNum-2.
      clientKey = `new:${idx}`;
    }
    if (!clientKey && userName) clientKey = index.byName.get(normName(userName));
    if (!clientKey) {
      skipped.push({
        row: rowNum,
        reason: `Cliente não encontrado ("${userName || phone}")`,
      });
      return;
    }


    const baseNotes = pickCell(row, mapping.notes) || "";
    const notes =
      (crossedMidnight
        ? (baseNotes ? baseNotes + " • " : "") + "(passou da meia-noite — fim ajustado para 23:59)"
        : baseNotes) || undefined;

    toCreate.push({
      _clientKey: clientKey,
      clientId: "", // resolved at commit
      date,
      start,
      end,
      status: mapStatus(pickCell(row, mapping.status)),
      room: pickCell(row, mapping.room) || undefined,
      price: parsePrice(pickCell(row, mapping.price)),
      paymentMethod: pickCell(row, mapping.payment) || undefined,
      notes,
    });
  });

  return { toCreate, skipped };
}

// ── Commit ───────────────────────────────────────────────────────────────────

export interface CommitResult {
  clientsCreated: number;
  clientsMerged: number;
  appointmentsCreated: number;
}

export async function commit(
  clientPlan: ClientImportPlan,
  appointmentPlan: AppointmentImportPlan
): Promise<CommitResult> {
  // Pre-assign UUIDs so appointments can reference new clients in the same batch.
  const newClientIds: string[] = clientPlan.toCreate.map(() => crypto.randomUUID());

  if (clientPlan.toCreate.length > 0) {
    const rows = clientPlan.toCreate.map((c, i) =>
      clientToRow({ ...c, id: newClientIds[i] } as Partial<Client>)
    );
    const { error } = await supabase
      .from("clients")
      .insert(rows as never);
    if (error) throw new Error(`Falha ao inserir clientes: ${error.message}`);
  }

  if (clientPlan.toMerge.length > 0) {
    const results = await Promise.all(
      clientPlan.toMerge.map(({ existingId, patch }) =>
        supabase
          .from("clients")
          .update(clientToRow(patch) as never)
          .eq("id", existingId)
      )
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw new Error(`Falha ao atualizar clientes: ${firstErr.message}`);
  }

  let appointmentsCreated = 0;
  if (appointmentPlan.toCreate.length > 0) {
    const apptRows: Record<string, unknown>[] = [];
    appointmentPlan.toCreate.forEach((appt) => {
      let clientId: string | undefined;
      if (appt._clientKey.startsWith("existing:")) {
        clientId = appt._clientKey.slice("existing:".length);
      } else if (appt._clientKey.startsWith("new:")) {
        const idx = Number(appt._clientKey.slice("new:".length));
        clientId = newClientIds[idx];
      }
      if (!clientId) return;
      const { _clientKey, ...rest } = appt;
      void _clientKey;
      apptRows.push(
        apptToRow({ ...rest, clientId, id: crypto.randomUUID() } as Partial<Appointment>)
      );
    });

    // Chunk to keep payloads sane and avoid timeouts on very large imports.
    const CHUNK = 200;
    for (let i = 0; i < apptRows.length; i += CHUNK) {
      const slice = apptRows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("appointments")
        .insert(slice as never);
      if (error) throw new Error(`Falha ao inserir agendamentos: ${error.message}`);
      appointmentsCreated += slice.length;
    }
  }

  // Pull the fresh server truth into the local snapshot.
  await store.refresh();

  return {
    clientsCreated: clientPlan.toCreate.length,
    clientsMerged: clientPlan.toMerge.length,
    appointmentsCreated,
  };
}

