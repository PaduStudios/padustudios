// SuperSaaS CSV import — parsing + normalization helpers.
// Pure functions. No I/O, no store writes here.

import type { ClientOrigin } from "@/lib/scheduling/types";

export type CsvRow = Record<string, string>;

// ── Column detection ─────────────────────────────────────────────────────────

/** Candidate header names for each logical field, in priority order. */
export const CLIENT_FIELD_HINTS = {
  name: ["nome completo", "full name", "name", "nome", "user", "user name", "customer"],
  phone: ["celular", "phone", "mobile", "telephone", "telefone", "cellphone"],
  email: ["e-mail", "email", "mail"],
  cpf: ["cpf", "documento", "document"],
  band: ["nome da banda", "banda", "band", "company", "organization", "empresa", "grupo"],
  members: ["members", "integrantes", "size", "party size"],
  notes: ["descrição", "descricao", "notes", "note", "comment", "comments", "observação", "observacao", "observações", "observacoes"],
  createdAt: ["criado em", "created", "created at", "sign up", "sign-up", "signup date", "registered", "member since"],
} as const;

export const APPOINTMENT_FIELD_HINTS = {
  userName: ["nome completo", "full name", "name", "user", "user name", "customer", "cliente", "nome"],
  phone: ["celular", "phone", "mobile", "telephone", "telefone"],
  email: ["e-mail", "email", "mail"],
  date: ["date", "day", "data", "start date", "appointment date"],
  start: ["horário de início", "horario de inicio", "start time", "start", "from", "hora início", "hora inicio", "início", "inicio", "time"],
  end: ["horário de fim", "horario de fim", "end time", "end", "to", "hora fim", "fim", "until"],
  duration: ["duration", "length", "duração", "duracao", "minutes"],
  room: ["agenda padu studios", "agenda", "resource", "schedule", "room", "sala", "location", "recurso"],
  price: ["price", "amount", "valor", "preço", "preco", "total"],
  payment: ["payment", "payment method", "pagamento", "método de pagamento", "metodo de pagamento"],
  status: ["estado", "status", "state", "situação", "situacao"],
  notes: ["descrição", "descricao", "notes", "note", "comment", "comments", "description", "observação", "observacao"],
} as const;

export type ClientField = keyof typeof CLIENT_FIELD_HINTS;
export type AppointmentField = keyof typeof APPOINTMENT_FIELD_HINTS;

/** Auto-map SuperSaaS headers to our logical fields by fuzzy matching. */
export function autoMapColumns<T extends string>(
  headers: string[],
  hints: Record<T, readonly string[]>
): Record<T, string | null> {
  const norm = (s: string) => s.toLowerCase().trim();
  const normalizedHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  const result = {} as Record<T, string | null>;

  for (const field of Object.keys(hints) as T[]) {
    const candidates = hints[field];
    let match: string | null = null;
    for (const candidate of candidates) {
      const c = norm(candidate);
      const found = normalizedHeaders.find(
        (h) => h.n === c || h.n.replace(/[_-]/g, " ") === c
      );
      if (found) {
        match = found.raw;
        break;
      }
    }
    // Loose contains-fallback
    if (!match) {
      for (const candidate of candidates) {
        const c = norm(candidate);
        const found = normalizedHeaders.find((h) => h.n.includes(c));
        if (found) {
          match = found.raw;
          break;
        }
      }
    }
    result[field] = match;
  }
  return result;
}

// ── Value normalizers ────────────────────────────────────────────────────────

export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

export function formatPhoneDisplay(digitsOrRaw: string | undefined | null): string {
  const d = normalizePhone(digitsOrRaw);
  if (!d) return "";
  // BR pattern: +55 (11) 91234-5678
  if (d.length >= 12 && d.startsWith("55")) {
    const dd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length === 9) return `+55 ${dd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 ${dd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (d.length === 11) return `${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitsOrRaw ?? "";
}

/**
 * Accepts:
 *   - "yyyy-MM-dd"
 *   - "dd/MM/yyyy" or "dd-MM-yyyy"
 *   - "MM/dd/yyyy" (falls back only when day > 12 elsewhere in the file — caller decides)
 *   - "yyyy/MM/dd"
 * Returns "yyyy-MM-dd" or null.
 */
export function parseDate(
  raw: string | undefined | null,
  locale: "br" | "us" | "iso" = "br"
): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO first
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const slashed = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (slashed) {
    const [, a, b, y] = slashed;
    const year = y.length === 2 ? `20${y}` : y;
    if (locale === "us") return `${year}-${pad2(a)}-${pad2(b)}`;
    return `${year}-${pad2(b)}-${pad2(a)}`;
  }

  // Try Date parse as a last resort
  const t = new Date(s);
  if (!isNaN(t.getTime())) {
    const y = t.getFullYear();
    const m = t.getMonth() + 1;
    const d = t.getDate();
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  return null;
}

/** Accepts "HH:mm", "HH:mm:ss", "H:mm", "h:mm AM/PM". Returns "HH:mm" or null. */
export function parseTime(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // 12h with meridiem
  const m12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
  if (m12) {
    let h = Number(m12[1]);
    const m = Number(m12[2]);
    const mer = m12[3].toLowerCase();
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    return `${pad2(h)}:${pad2(m)}`;
  }

  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    const h = Number(m24[1]);
    const m = Number(m24[2]);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return `${pad2(h)}:${pad2(m)}`;
  }
  return null;
}

/** Parses "60", "1h30", "1:30", "90 min" into minutes; null on failure. */
export function parseDurationMinutes(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  const pure = s.match(/^(\d+)\s*(min|m|minutes|minutos)?$/);
  if (pure) return Number(pure[1]);

  const hcolon = s.match(/^(\d+):(\d+)$/);
  if (hcolon) return Number(hcolon[1]) * 60 + Number(hcolon[2]);

  const hm = s.match(/^(\d+)\s*h(?:oras?)?\s*(\d+)?\s*(?:min|m|minutos?)?$/);
  if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);

  return null;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** Rough parser for prices with BRL/USD notation, dots or commas. */
export function parsePrice(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim().replace(/[^\d,.-]/g, "");
  if (!s) return undefined;
  // "1.234,56" (BR) → "1234.56"
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized = s;
  if (hasComma && hasDot) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma && !hasDot) normalized = s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

export function mapStatus(
  raw: string | undefined | null
): "confirmed" | "pending" | "cancelled" {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return "confirmed";
  if (/cancel|canceled|cancelled|cancelad/.test(s)) return "cancelled";
  if (/pend|hold|wait|aguard/.test(s)) return "pending";
  return "confirmed"; // paid, booked, confirmed, active, done, past — treat as confirmed
}

export function mapOrigin(raw: string | undefined | null): ClientOrigin {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return "other";
  if (s.includes("whats")) return "whatsapp";
  if (s.includes("insta")) return "instagram";
  if (s.includes("site") || s.includes("web")) return "site";
  if (s.includes("phone") || s.includes("call") || s.includes("telefone"))
    return "phone";
  if (s.includes("walk") || s.includes("balcão") || s.includes("balcao"))
    return "walkin";
  return "other";
}

// ── Utils ────────────────────────────────────────────────────────────────────

function pad2(n: number | string): string {
  const s = String(n);
  return s.length < 2 ? `0${s}` : s;
}

export function pickCell(row: CsvRow, col: string | null): string {
  if (!col) return "";
  const v = row[col];
  return (v ?? "").toString().trim();
}
