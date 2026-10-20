"use server";

// Dashboard actions. Each calls a database function (which checks the
// caller's role) or writes a table that RLS restricts to the owner, then
// refreshes the dashboard. Public pages are refreshed when prices, stock or
// ordering settings change.
import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { sendInvoiceEmails, sendReadyEmails, withEmail } from "@/lib/email/staff-mail";
import { MENU_CACHE_TAG } from "@/lib/menu";
import { ORDER_OPTIONS_CACHE_TAG } from "@/lib/order-options";
import { headers } from "next/headers";
import { getCollectionPlace, getOrders, getOrdersByIds } from "@/lib/dashboard/data";
import { invoiceWhatsAppLink } from "@/lib/dashboard/whatsapp";
import { createClient } from "@/lib/supabase/server";
import { normaliseZaPhone } from "@/lib/phone";
import { embedFaq } from "@/lib/chat/gemini";

export type ActionState = {
  ok: boolean;
  message: string;
  /** One-tap WhatsApp buttons to show with the result (D-048, D-053). */
  links?: { label: string; href: string }[];
} | null;

const friendly: Record<string, string> = {
  quote_required: "This is a large order: enter a quote before approving.",
  not_pending: "This order has already been dealt with.",
  not_owner: "Only Kaydee can do that.",
  not_staff: "You need a KD Pops staff account to do that.",
  no_unpaid_payment: "That order is already marked as paid.",
  not_ready: "Only orders marked ready can be collected.",
  invalid_date: "Choose a school day from today onwards.",
  invalid_quote: "The quote must be zero or more.",
  order_not_found: "That order no longer exists.",
  not_bakeable: "That order is already ready, collected or cancelled.",
  no_proof: "There is no proof waiting to be checked for that order.",
  has_active_orders: "This customer still has an open order. Cancel or finish it first.",
};

function explain(error: { message: string } | null, fallback = "Something went wrong. Please try again.") {
  if (!error) return null;
  return friendly[error.message] ?? fallback;
}

function done(message: string): ActionState {
  refresh();
  return { ok: true, message };
}

// ------------------------------------------------------------------ orders

/**
 * Approve one or more orders (batch approval from the queue, spec 7.2).
 * Returns a WhatsApp button per approved order with the confirmation and a
 * private invoice link (D-053). A single approval does not refresh the page,
 * so its card can show "Approved" with that button.
 */
export async function approveOrders(_: ActionState, form: FormData): Promise<ActionState> {
  const ids = form.getAll("order_id").map(String).filter(Boolean);
  if (ids.length === 0) return { ok: false, message: "Tick at least one order." };
  const quoteRaw = String(form.get("quote") ?? "").trim();
  const quote = quoteRaw === "" ? null : Number(quoteRaw.replace(",", "."));
  if (quote !== null && (!Number.isFinite(quote) || quote < 0)) return { ok: false, message: friendly.invalid_quote };

  const supabase = await createClient();
  const failed: string[] = [];
  const approved: string[] = [];
  for (const id of ids) {
    const { error } = await supabase.rpc("approve_order", { p_order_id: id, p_quote: quote });
    if (error) failed.push(explain(error)!);
    else approved.push(id);
  }
  if (approved.length === 0) return { ok: false, message: failed[0] };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const [orders, place] = await Promise.all([getOrdersByIds(approved), getCollectionPlace()]);
  const links = orders.flatMap((order) => {
    const href = invoiceWhatsAppLink(order, place, origin);
    const name = order.customers?.full_name.split(" ")[0] ?? order.order_number;
    return href ? [{ label: `WhatsApp ${name}: confirmation + invoice`, href }] : [];
  });

  // D-070: customers who gave an email get the confirmation and invoice PDF.
  const emailed = withEmail(orders);
  after(() => sendInvoiceEmails(supabase, orders, place, origin));

  const emailNote = emailed ? ` ${emailed} also get${emailed === 1 ? "s" : ""} it by email.` : "";
  const message = failed.length
    ? `Approved ${approved.length}; ${failed.length} could not be approved (${failed[0]}).${emailNote}`
    : `Approved ${approved.length} order${approved.length === 1 ? "" : "s"}. Tap to send each confirmation and invoice on WhatsApp.${emailNote}`;
  if (form.get("mode") !== "single") refresh();
  return { ok: true, message, links };
}

export async function declineOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_order", { p_order_id: String(form.get("order_id")) });
  return error ? { ok: false, message: explain(error)! } : done("Declined. The customer has a polite message.");
}

export async function markPaid(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_paid", { p_order_id: String(form.get("order_id")) });
  return error ? { ok: false, message: explain(error)! } : done("Marked as paid.");
}

/** Proof doesn't match: back to unpaid, customer asked to check and resend. */
export async function rejectProof(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_proof", { p_order_id: String(form.get("order_id")) });
  return error ? { ok: false, message: explain(error)! } : done("The customer has been asked to check and upload again.");
}

export async function markCollected(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_collected", { p_order_id: String(form.get("order_id")) });
  return error ? { ok: false, message: explain(error)! } : done("Marked as collected.");
}

// ------------------------------------------------------------------ batch

/** One order is ready: the customer is told to collect it. */
export async function markReady(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const orderId = String(form.get("order_id"));
  const { data, error } = await supabase.rpc("mark_ready", { p_order_id: orderId });
  if (error) return { ok: false, message: explain(error)! };
  const [orders, place] = await Promise.all([getOrdersByIds([orderId]), getCollectionPlace()]);
  after(() => sendReadyEmails(supabase, orders, place));
  const emailNote = withEmail(orders) ? " They also get an email." : "";
  return done(`${data.order_number} is ready. Tap its WhatsApp button to send the message.${emailNote}`);
}

export async function advanceWeek(_: ActionState, form: FormData): Promise<ActionState> {
  const to = String(form.get("to"));
  const week = String(form.get("week"));
  const supabase = await createClient();
  // Orders about to become ready, for the ready emails (D-070).
  const becomingReady =
    to === "ready"
      ? (await getOrders(["confirmed", "baking"])).filter((o) => o.collection_week === week && !o.released_at)
      : [];
  const { data, error } = await supabase.rpc("advance_week", { p_week: week, p_to: to });
  if (error) return { ok: false, message: explain(error)! };
  if (becomingReady.length) {
    const place = await getCollectionPlace();
    after(() => sendReadyEmails(supabase, becomingReady, place));
  }
  return done(
    to === "ready"
      ? `${data} orders ready. Their status pages say so; tap each WhatsApp button below to message them.`
      : `${data} orders moved to baking.`,
  );
}

export async function delayBatch(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delay_batch", {
    p_week: String(form.get("week")),
    p_new_date: String(form.get("new_date")),
  });
  if (error) return { ok: false, message: explain(error)! };
  return done(`${data} customers have their new collection date.`);
}

// ------------------------------------------------------------------ settings (owner; RLS enforces)

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const place = String(form.get("collection_place") ?? "").trim();
  const cap = Number(form.get("default_weekly_cap"));
  const threshold = Number(form.get("large_order_threshold"));
  const lastDay = Number(form.get("last_school_day_isodow"));
  if (!place || !(cap > 0) || !(threshold > 0) || !(lastDay >= 1 && lastDay <= 5)) {
    return { ok: false, message: "Please fill in every setting." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({
      collection_place: place.slice(0, 120),
      default_weekly_cap: cap,
      large_order_threshold: threshold,
      last_school_day_isodow: lastDay,
    })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Only Kaydee can change settings." };
  updateTag(ORDER_OPTIONS_CACHE_TAG);
  return done("Settings saved.");
}

export async function setWeekCap(_: ActionState, form: FormData): Promise<ActionState> {
  const week = String(form.get("week_start"));
  const cap = Number(form.get("unit_cap"));
  const monday = new Date(`${week}T00:00:00Z`).getUTCDay() === 1;
  if (!monday || !(cap > 0)) return { ok: false, message: "Choose a Monday and a cap above 0." };
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_capacity").upsert({ week_start: week, unit_cap: cap });
  if (error) return { ok: false, message: "Only Kaydee can change the weekly cap." };
  return done(`Cap for the week of ${week} set to ${cap}.`);
}

export async function removeWeekCap(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_capacity").delete().eq("week_start", String(form.get("week_start")));
  if (error) return { ok: false, message: "Only Kaydee can change the weekly cap." };
  return done("Back to the default cap for that week.");
}

export async function saveProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const price = Number(String(form.get("unit_price")).replace(",", "."));
  if (!(price > 0)) return { ok: false, message: "Enter a price above R0." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ unit_price: price, is_available: form.get("is_available") === "on" })
    .eq("product_id", String(form.get("product_id")))
    .select("flavour");
  if (error || !data?.length) return { ok: false, message: "Only Kaydee can change the menu." };
  updateTag(MENU_CACHE_TAG);
  return done(`${data[0].flavour} saved. The menu is updated.`);
}

// ------------------------------------------------------------------ POPIA deletion request (spec 7.8)

export async function deleteCustomerData(_: ActionState, form: FormData): Promise<ActionState> {
  const phone = normaliseZaPhone(String(form.get("phone") ?? ""));
  if (!phone) return { ok: false, message: "Enter the customer's cell number, e.g. 082 123 4567." };
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("customer_id, full_name")
    .eq("phone_number", phone)
    .maybeSingle();
  if (!customer) return { ok: false, message: "No customer with that number (or their details were already removed)." };
  const { error } = await supabase.rpc("anonymise_customer_now", { p_customer_id: customer.customer_id });
  if (error) return { ok: false, message: explain(error)! };
  return done(`${customer.full_name}'s details have been removed. Invoice totals are kept for the records.`);
}

// ------------------------------------------------------------------ BakeBot (REQ-22, REQ-23)

export async function resolveConversation(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_conversation", { p_conversation_id: String(form.get("conversation_id")) });
  return error ? { ok: false, message: explain(error)! } : done("Marked as dealt with.");
}

/** Save an approved FAQ answer; it is re-embedded so BakeBot can find it. */
export async function saveFaq(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("faq_id") ?? "");
  const question = String(form.get("question") ?? "").trim();
  const answer = String(form.get("approved_answer") ?? "").trim();
  const category = String(form.get("category") ?? "other");
  const language = String(form.get("language") ?? "en");
  const active = form.get("is_active") === "on";
  if (!question || !answer) return { ok: false, message: "Write both the question and the approved answer." };
  if (active && answer.startsWith("NEEDS KAYDEE")) return { ok: false, message: "Write the real answer before switching it on." };

  let embedding: number[] | null = null;
  let embedNote = "";
  try {
    embedding = await embedFaq(question, answer);
    if (!embedding) embedNote = " BakeBot can use it once the Gemini key is set up.";
  } catch {
    embedNote = " Could not reach Gemini just now; it will be searchable after you save again.";
  }

  const row = {
    question: question.slice(0, 500),
    approved_answer: answer.slice(0, 1500),
    category,
    language,
    is_active: active,
    embedding: embedding ? JSON.stringify(embedding) : null,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("faq_knowledge").update(row).eq("faq_id", id)
    : await supabase.from("faq_knowledge").insert(row);
  if (error) return { ok: false, message: "Only Kaydee can change BakeBot's answers." };
  return done(`Saved.${active ? "" : " It is switched off, so BakeBot will not use it."}${embedNote}`);
}

export async function deleteFaq(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("faq_knowledge").delete().eq("faq_id", String(form.get("faq_id")));
  return error ? { ok: false, message: "Only Kaydee can change BakeBot's answers." } : done("Deleted.");
}

/** Re-embed every answer (after adding the Gemini key or changing the embedding model). */
export async function reembedAllFaqs(): Promise<ActionState> {
  const supabase = await createClient();
  const { data: faqs } = await supabase.from("faq_knowledge").select("faq_id, question, approved_answer");
  let count = 0;
  for (const faq of faqs ?? []) {
    try {
      const embedding = await embedFaq(faq.question, faq.approved_answer);
      if (!embedding) return { ok: false, message: "Set GEMINI_API_KEY in Vercel first." };
      await supabase.from("faq_knowledge").update({ embedding: JSON.stringify(embedding) }).eq("faq_id", faq.faq_id);
      count++;
    } catch {
      return { ok: false, message: `Gemini stopped after ${count} answers. Try again in a minute.` };
    }
  }
  return done(`${count} answers are ready for BakeBot.`);
}
