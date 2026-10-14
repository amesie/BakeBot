// South African cell numbers to E.164 (+27...). Mirrors
// private.normalise_za_phone() in the database so the form can warn early.
export function normaliseZaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0[1-9]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^27[1-9]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

/** ******4567: phone numbers are masked everywhere except the owner dashboard. */
export function maskPhone(phone: string): string {
  return `******${phone.slice(-4)}`;
}
