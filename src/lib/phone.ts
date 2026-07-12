// Brazilian phone helpers. Purely presentational — never mutates stored data.
// The stored value can be anything (legacy CSV, freeform). We only reformat
// when the digits look like a real BR phone. Obvious placeholders (00000,
// repeated digits, too short) pass through unchanged so we don't hide bad data.

export function onlyDigits(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\D/g, "");
}

/** True when the digits look like a placeholder / clearly invalid. */
export function isPlaceholderPhone(digits: string): boolean {
  if (!digits) return true;
  if (digits.length < 10) return true;
  if (/^(\d)\1+$/.test(digits)) return true; // all same digit
  return false;
}

/**
 * Format any BR phone as "(11) 98764-1234" or "(11) 3456-7890".
 * Strips leading country code "55" when the remaining part is 10 or 11 digits.
 * Returns the original string untouched when the digits don't fit the BR pattern
 * (so "00000", "N/A", legacy junk stay visible as-is).
 */
export function formatPhoneSmart(raw: string | undefined | null): string {
  if (!raw) return "";
  const digits = onlyDigits(raw);
  if (isPlaceholderPhone(digits)) return raw;

  let local = digits;
  if (local.length > 11 && local.startsWith("55")) local = local.slice(2);
  if (local.length !== 10 && local.length !== 11) return raw;

  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
  const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
  return `(${ddd}) ${mid}-${end}`;
}

/**
 * Progressive mask used inside <input> onChange for BR mobile: "(11) 98764-1234".
 * Accepts any input, keeps only digits, drops leading "55" so users can paste
 * a "+55 …" number, and reveals the mask as the user types.
 */
export function maskBrPhoneInput(raw: string): string {
  let d = onlyDigits(raw);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);

  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
