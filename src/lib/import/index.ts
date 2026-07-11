// Orchestrator: reads mapped CSV rows and applies them to the current store,
// deduping clients by normalized phone. Pure of I/O — takes rows in, calls
// store methods out. Same interface will work later against a Supabase-backed
// store without changing the wizard UI.

import { store } from "@/lib/scheduling/store";
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

// ── Client plan ──────────────────────────────────────────────────────────────

export function buildClientPlan(
  rows: CsvRow[],
  mapping: ClientMapping,
  options: ImportOptions
): ClientImportPlan {
  const existing = store.getSnapshot().clients;
  const byPhone = new Map(
    existing.map((c) => [normalizePhone(c.phone), c] as const)
  );
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
    if (!phone) {
      skipped.push({ row: rowNum, reason: `"${name}" sem telefone` });
      return;
    }
    // In combined mode the same phone appears on every row of that client — silently skip dupes.
    if (seenInBatch.has(phone)) return;
    seenInBatch.add(phone);

    const email = pickCell(row, mapping.email) || undefined;
    const cpf = normalizeCpf(pickCell(row, mapping.cpf)) || undefined;
    const band = pickCell(row, mapping.band) || undefined;
    const membersRaw = pickCell(row, mapping.members);
    const members = membersRaw ? Number(membersRaw) || undefined : undefined;
    const notes = pickCell(row, mapping.notes) || undefined;

    const existingClient = byPhone.get(phone);
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
      name: name || phoneRaw || phone,
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
  byPhone: Map<string, string>; // phone → client key
  byName: Map<string, string>; // lower(name) → client key
} {
  const existing = store.getSnapshot().clients;
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string>();

  existing.forEach((c) => {
    const p = normalizePhone(c.phone);
    if (p) byPhone.set(p, `existing:${c.id}`);
    if (c.name) byName.set(c.name.toLowerCase().trim(), `existing:${c.id}`);
    if (c.band) byName.set(c.band.toLowerCase().trim(), `existing:${c.id}`);
  });
  plannedNewClients.forEach((c, i) => {
    const p = normalizePhone(c.phone);
    const key = `new:${i}`;
    if (p) byPhone.set(p, key);
    if (c.name) byName.set(c.name.toLowerCase().trim(), key);
    if (c.band) byName.set(c.band.toLowerCase().trim(), key);
  });
  return { byPhone, byName };
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

    // Locate client
    const phone = normalizePhone(pickCell(row, mapping.phone));
    const userName = pickCell(row, mapping.userName);
    let clientKey: string | undefined;
    if (phone) clientKey = index.byPhone.get(phone);
    if (!clientKey && userName)
      clientKey = index.byName.get(userName.toLowerCase().trim());
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

export function commit(
  clientPlan: ClientImportPlan,
  appointmentPlan: AppointmentImportPlan
): CommitResult {
  const newClientIds: string[] = [];
  clientPlan.toCreate.forEach((c) => {
    const created = store.addClient(c);
    newClientIds.push(created.id);
  });
  clientPlan.toMerge.forEach(({ existingId, patch }) => {
    store.updateClient(existingId, patch);
  });

  let appointmentsCreated = 0;
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
    store.addAppointment({ ...rest, clientId });
    appointmentsCreated += 1;
  });

  return {
    clientsCreated: clientPlan.toCreate.length,
    clientsMerged: clientPlan.toMerge.length,
    appointmentsCreated,
  };
}
