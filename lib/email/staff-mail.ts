// Emails triggered by Kaydee's dashboard actions (D-070): the invoice when
// she approves (REQ-12, REQ-14) and "ready" when she marks orders ready.
// Only customers who gave an email address get these. Sent after the action
// answers; each send is logged in email_log (owner access through RLS).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { orderTotal, type DashboardOrder } from "@/lib/dashboard/types";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { logError } from "@/lib/log-error";
import { whatsAppDisplay } from "@/lib/site";
import { invoiceEmail, readyEmail, type EmailOrder } from "./compose";
import { emailConfigured, sendEmail, type SendResult } from "./send";

function toEmailOrder(order: DashboardOrder, place: string): EmailOrder {
  return {
    order_number: order.order_number,
    first_name: order.customers?.full_name.split(" ")[0] ?? "",
    language: order.customers?.preferred_language ?? "en",
    items: order.order_items.map((i) => ({
      flavour: i.products?.flavour ?? "",
      quantity: i.quantity,
      line_total: i.quantity * Number(i.unit_price_snapshot),
    })),
    total_amount: orderTotal(order),
    is_large_order: order.is_large_order,
    quote_amount: order.quote_amount === null ? null : Number(order.quote_amount),
    collection_date: order.collection_date,
    revised_collection_date: order.revised_collection_date,
    collection_slot: order.collection_slot,
    collection_place: place,
    payment_method: order.payment_method,
    payment_reference: order.payment_reference,
  };
}

async function log(supabase: SupabaseClient, order: DashboardOrder, template: string, result: SendResult) {
  await supabase.from("email_log").insert({
    order_id: order.order_id,
    template,
    status: result.status,
    attempts: Math.max(1, result.attempts),
    error: result.error ?? null,
  });
  if (result.status !== "sent") await logError("email", `${template} ${order.order_number}: ${result.error ?? "failed"}`);
}

/** How many of these orders will also be told by email. */
export function withEmail(orders: DashboardOrder[]) {
  return emailConfigured() ? orders.filter((o) => o.customers?.email).length : 0;
}

export async function sendInvoiceEmails(supabase: SupabaseClient, orders: DashboardOrder[], place: string, origin: string) {
  if (!emailConfigured()) return;
  for (const order of orders) {
    const to = order.customers?.email;
    if (!to || !order.payment_reference || !order.invoices) continue;
    const invoiceUrl = `${origin}/invoice/${encodeURIComponent(order.payment_reference)}/${order.invoices.share_token}`;
    const pdf = await buildInvoicePdf({
      invoice_number: order.payment_reference,
      issued_at: order.invoices.issued_at,
      order_number: order.order_number,
      billed_to: order.customers?.full_name ?? "",
      items: order.order_items.map((i) => ({
        flavour: i.products?.flavour ?? "",
        quantity: i.quantity,
        unit_price: Number(i.unit_price_snapshot),
        line_total: i.quantity * Number(i.unit_price_snapshot),
      })),
      total_amount: Number(order.invoices.total_amount),
      quote_amount: order.quote_amount === null ? null : Number(order.quote_amount),
      payment_method: order.payment_method,
      payment_status: order.payments?.payment_status ?? "unpaid",
      collection_date: order.revised_collection_date ?? order.collection_date,
      collection_slot: order.collection_slot,
      collection_place: place,
      bank_details: order.payment_method === "eft" ? (process.env.EFT_BANK_DETAILS ?? null) : null,
      contact: whatsAppDisplay ? `WhatsApp ${whatsAppDisplay}` : null,
    });
    const composed = invoiceEmail(toEmailOrder(order, place), invoiceUrl);
    const result = await sendEmail({
      to,
      ...composed,
      attachments: [
        {
          filename: `KD-Pops-invoice-${order.payment_reference}.pdf`,
          content: Buffer.from(pdf),
          contentType: "application/pdf",
        },
      ],
    });
    await log(supabase, order, "invoice", result);
  }
}

export async function sendReadyEmails(supabase: SupabaseClient, orders: DashboardOrder[], place: string) {
  if (!emailConfigured()) return;
  for (const order of orders) {
    const to = order.customers?.email;
    if (!to) continue;
    await log(supabase, order, "ready", await sendEmail({ to, ...readyEmail(toEmailOrder(order, place)) }));
  }
}
