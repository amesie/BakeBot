// One-tap WhatsApp "ready" message from Kaydee's phone (D-048). Builds a
// wa.me link with the message already typed in the customer's language; she
// taps Send. Free, needs no Meta approval. Automatic WhatsApp comes later.
import { formatDay } from "@/lib/dates";
import { dictionaries, format, isLanguage, type Messages } from "@/lib/i18n";
import type { DashboardOrder } from "./types";

export function readyWhatsAppLink(order: DashboardOrder, place: string): string | null {
  const phone = order.customers?.phone_number?.replace(/\D/g, "");
  if (!phone) return null;
  const language = isLanguage(order.customers?.preferred_language) ? order.customers!.preferred_language : "en";
  const m = dictionaries[language];
  const text =
    "KD Pops: " +
    format(m.templates.ready, {
      order_number: order.order_number,
      date: formatDay(order.revised_collection_date ?? order.collection_date, m),
      slot: m.slots[order.collection_slot as keyof Messages["slots"]],
      place,
    });
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
