import type { Messages } from "@/lib/i18n";

/**
 * "Monday 19 October" from an ISO date (YYYY-MM-DD), using the dictionary's
 * day and month names so isiXhosa and Afrikaans work on any phone. Dates are
 * calendar dates in SAST; no time zone conversion is involved.
 */
export function formatDay(iso: string, m: Pick<Messages, "days" | "months">): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const isoWeekday = ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
  const dayName = m.days[String(isoWeekday) as keyof Messages["days"]];
  const monthName = m.months[String(month) as keyof Messages["months"]];
  return `${dayName} ${day} ${monthName}`;
}

/** Calendar date in SAST (YYYY-MM-DD) for a timestamp such as created_at. */
export function sastDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date(timestamp));
}
