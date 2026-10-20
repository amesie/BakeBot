// Builds the customer emails (D-070) in the customer's language: order
// received (with track and cancel links), invoice on approval, ready for
// collection, cancelled. HTML plus a plain-text version; no images, so they
// stay small for prepaid data.
import { formatDay } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { dictionaries, format, isLanguage, type Messages } from "@/lib/i18n";
import { proofEmail, whatsAppDisplay } from "@/lib/site";

export type EmailOrder = {
  order_number: string;
  first_name: string;
  language: string;
  items: { flavour: string; quantity: number; line_total: number }[];
  total_amount: number;
  is_large_order: boolean;
  quote_amount: number | null;
  collection_date: string;
  revised_collection_date?: string | null;
  collection_slot: "second_break" | "after_school";
  collection_place?: string | null;
  payment_method: "cash" | "eft";
  payment_reference?: string | null;
};

type Composed = { subject: string; html: string; text: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function dict(language: string): Messages {
  return dictionaries[isLanguage(language) ? language : "en"];
}

function shell(m: Messages, heading: string, bodyHtml: string, bodyText: string): { html: string; text: string } {
  // Without a WhatsApp number, drop the footer's last sentence ("Questions? WhatsApp Kaydee on …").
  const footer = whatsAppDisplay
    ? format(m.email.footer, { phone: whatsAppDisplay })
    : m.email.footer.slice(0, m.email.footer.lastIndexOf(". ") + 1);
  const html = `<!doctype html><html><body style="margin:0;background:#f5ede0;font-family:Arial,Helvetica,sans-serif;color:#3b2a20">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff8ee;border:2px solid #3b2a20;border-radius:18px">
<tr><td style="padding:22px 24px 6px;font-size:26px;font-weight:bold;letter-spacing:-1px">KD <span style="color:#7b4a2e">POPS</span></td></tr>
<tr><td style="padding:6px 24px 0"><h1 style="margin:0 0 12px;font-size:22px">${esc(heading)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:18px 24px 22px;font-size:12px;line-height:1.5;color:#7b4a2e">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
  return { html, text: `KD POPS\n\n${heading}\n\n${bodyText}\n\n--\n${footer}\n` };
}

function button(href: string, label: string, dark = true) {
  const style = dark
    ? "background:#3b2a20;color:#fff8ee;border:2px solid #3b2a20"
    : "background:#fff8ee;color:#3b2a20;border:2px solid #3b2a20";
  return `<a href="${esc(href)}" style="display:inline-block;${style};border-radius:999px;padding:12px 22px;font-weight:bold;text-decoration:none;margin:4px 8px 4px 0">${esc(label)}</a>`;
}

function details(m: Messages, o: EmailOrder) {
  const day = formatDay(o.revised_collection_date ?? o.collection_date, m);
  const slot = m.slots[o.collection_slot];
  const totalText = o.is_large_order && o.quote_amount === null ? m.email.quote : formatRand(o.total_amount);
  const rows = o.items
    .map((i) => `<tr><td style="padding:4px 0">${i.quantity} × ${esc(i.flavour)}</td><td align="right">${formatRand(i.line_total)}</td></tr>`)
    .join("");
  const html = `<table role="presentation" width="100%" style="font-size:15px;border-top:1px solid #cdbcae;border-bottom:1px solid #cdbcae;margin:8px 0 14px;padding:6px 0">${rows}
<tr><td style="padding-top:8px;font-weight:bold">${esc(m.email.total)}</td><td align="right" style="padding-top:8px;font-weight:bold">${esc(totalText)}</td></tr></table>
<p style="margin:0 0 6px;font-size:15px"><b>${esc(m.email.collection)}:</b> ${esc(day)}, ${esc(slot)}${o.collection_place ? `, ${esc(o.collection_place)}` : ""}</p>
<p style="margin:0 0 14px;font-size:15px"><b>${esc(m.email.payment)}:</b> ${esc(m.payment[o.payment_method])}${o.payment_reference ? ` · ${esc(o.payment_reference)}` : ""}</p>`;
  const text = [
    ...o.items.map((i) => `${i.quantity} x ${i.flavour}  ${formatRand(i.line_total)}`),
    `${m.email.total}: ${totalText}`,
    `${m.email.collection}: ${day}, ${slot}${o.collection_place ? `, ${o.collection_place}` : ""}`,
    `${m.email.payment}: ${m.payment[o.payment_method]}${o.payment_reference ? ` (${o.payment_reference})` : ""}`,
  ].join("\n");
  return { html, text };
}

/** Sent when the order is placed: details, track link, cancel link. */
export function orderReceivedEmail(o: EmailOrder, links: { track: string; cancel: string }): Composed {
  const m = dict(o.language);
  const d = details(m, o);
  const body =
    `<p style="margin:0 0 8px;font-size:15px">${esc(m.email.receivedIntro)}</p>${d.html}` +
    `<p style="margin:0 0 6px">${button(links.track, m.email.track)}${button(links.cancel, m.email.cancel, false)}</p>` +
    `<p style="margin:6px 0 0;font-size:13px;color:#7b4a2e">${esc(m.email.cancelNote)} ${esc(m.email.keepLink)}</p>`;
  const text = `${m.email.receivedIntro}\n\n${d.text}\n\n${m.email.track}: ${links.track}\n${m.email.cancel}: ${links.cancel}\n\n${m.email.cancelNote} ${m.email.keepLink}`;
  return {
    subject: format(m.email.receivedSubject, { order_number: o.order_number }),
    ...shell(m, format(m.email.receivedHeading, { name: o.first_name }), body, text),
  };
}

/** Sent when Kaydee approves (REQ-12, REQ-14): confirmation + invoice. */
export function invoiceEmail(o: EmailOrder, invoiceUrl: string): Composed {
  const m = dict(o.language);
  const template = o.payment_method === "eft" ? m.templates.confirmation_eft : m.templates.confirmation_cash;
  const message = format(template, {
    order_number: o.order_number,
    date: formatDay(o.revised_collection_date ?? o.collection_date, m),
    slot: m.slots[o.collection_slot],
    place: o.collection_place ?? "",
    amount: formatRand(o.total_amount),
    reference: o.payment_reference ?? "",
    email: proofEmail,
  });
  const d = details(m, o);
  const body =
    `<p style="margin:0 0 12px;font-size:15px">${esc(message)}</p>${d.html}` +
    `<p style="margin:0 0 6px;font-size:15px">${esc(m.email.invoiceAttached)}</p><p>${button(invoiceUrl, m.email.openInvoice)}</p>`;
  const text = `${message}\n\n${d.text}\n\n${m.email.invoiceAttached} ${invoiceUrl}`;
  return {
    subject: format(m.email.invoiceSubject, { order_number: o.order_number, reference: o.payment_reference ?? "" }),
    ...shell(m, m.email.invoiceHeading, body, text),
  };
}

/** Sent when Kaydee marks the order ready. */
export function readyEmail(o: EmailOrder): Composed {
  const m = dict(o.language);
  const message = format(m.templates.ready, {
    order_number: o.order_number,
    date: formatDay(o.revised_collection_date ?? o.collection_date, m),
    slot: m.slots[o.collection_slot],
    place: o.collection_place ?? "",
  });
  const d = details(m, o);
  return {
    subject: format(m.email.readySubject, { order_number: o.order_number }),
    ...shell(m, m.email.readyHeading, `<p style="margin:0 0 12px;font-size:15px">${esc(message)}</p>${d.html}`, `${message}\n\n${d.text}`),
  };
}

/** Sent when the customer cancels. */
export function cancelledEmail(o: EmailOrder): Composed {
  const m = dict(o.language);
  const message = format(m.templates.cancelled_by_customer, { order_number: o.order_number });
  return {
    subject: format(m.email.cancelledSubject, { order_number: o.order_number }),
    ...shell(m, m.email.cancelledHeading, `<p style="margin:0;font-size:15px">${esc(message)}</p>`, message),
  };
}
