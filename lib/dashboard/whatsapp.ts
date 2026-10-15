// One-tap WhatsApp "ready" message from Kaydee's phone (D-048). Builds a
// wa.me link with the message already typed in the customer's language; she
// taps Send. Free, needs no Meta approval. Automatic WhatsApp comes later.
import { formatDay } from "@/lib/dates";
import { dictionaries, format, isLanguage, type Messages } from "@/lib/i18n";
import { formatRand } from "@/lib/format";
import { orderTotal, type DashboardOrder } from "./types";

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

/**
 * Confirmation + private invoice link for one-tap WhatsApp after approval
 * (D-053). Signed "BakeBot (KD Pops)" because it is about money (spec 2).
 */
export function invoiceWhatsAppLink(order: DashboardOrder, place: string, origin: string): string | null {
  const phone = order.customers?.phone_number?.replace(/\D/g, "");
  const share = order.invoices?.share_token;
  if (!phone || !share || !order.payment_reference) return null;
  const language = isLanguage(order.customers?.preferred_language) ? order.customers!.preferred_language : "en";
  const m = dictionaries[language];
  const template = order.payment_method === "eft" ? m.templates.confirmation_eft : m.templates.confirmation_cash;
  const url = `${origin}/invoice/${encodeURIComponent(order.payment_reference)}/${share}`;
  const text = [
    `${m.templates.signature}: ` +
      format(template, {
        order_number: order.order_number,
        date: formatDay(order.revised_collection_date ?? order.collection_date, m),
        slot: m.slots[order.collection_slot as keyof Messages["slots"]],
        place,
        amount: formatRand(orderTotal(order)),
        reference: order.payment_reference,
      }),
    format(m.templates.invoice_link, { url }),
  ].join("\n\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** BakeBot payment reminder (REQ-16) to send from Kaydee's phone. */
export function reminderWhatsAppLink(order: DashboardOrder, origin: string): string | null {
  const phone = order.customers?.phone_number?.replace(/\D/g, "");
  if (!phone || !order.payment_reference) return null;
  const language = isLanguage(order.customers?.preferred_language) ? order.customers!.preferred_language : "en";
  const m = dictionaries[language];
  const lines = [
    format(m.templates.payment_reminder, {
      order_number: order.order_number,
      amount: formatRand(orderTotal(order)),
      reference: order.payment_reference,
      date: formatDay(order.revised_collection_date ?? order.collection_date, m),
    }),
  ];
  if (order.invoices?.share_token) {
    lines.push(format(m.templates.invoice_link, {
      url: `${origin}/invoice/${encodeURIComponent(order.payment_reference)}/${order.invoices.share_token}`,
    }));
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n\n"))}`;
}
