"use server";

// Dashboard actions. Each calls a database function (which checks the
// caller's role) or writes a table that RLS restricts to the owner, then
// refreshes the dashboard. Public pages are refreshed when prices, stock or
// ordering settings change.
import { refresh, updateTag } from "next/cache";
import { MENU_CACHE_TAG } from "@/lib/menu";
import { ORDER_OPTIONS_CACHE_TAG } from "@/lib/order-options";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

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

/** Approve one or more orders (batch approval from the queue, spec 7.2). */
export async function approveOrders(_: ActionState, form: FormData): Promise<ActionState> {
  const ids = form.getAll("order_id").map(String).filter(Boolean);
  if (ids.length === 0) return { ok: false, message: "Tick at least one order." };
  const quoteRaw = String(form.get("quote") ?? "").trim();
  const quote = quoteRaw === "" ? null : Number(quoteRaw.replace(",", "."));
  if (quote !== null && (!Number.isFinite(quote) || quote < 0)) return { ok: false, message: friendly.invalid_quote };

  const supabase = await createClient();
  const failed: string[] = [];
  for (const id of ids) {
    const { error } = await supabase.rpc("approve_order", { p_order_id: id, p_quote: quote });
    if (error) failed.push(explain(error)!);
  }
  if (failed.length === ids.length) return { ok: false, message: failed[0] };
  return done(
    failed.length
      ? `Approved ${ids.length - failed.length}; ${failed.length} could not be approved (${failed[0]})`
      : `Approved ${ids.length} order${ids.length === 1 ? "" : "s"}. Customers have their confirmation.`,
  );
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
  const { data, error } = await supabase.rpc("mark_ready", { p_order_id: String(form.get("order_id")) });
  if (error) return { ok: false, message: explain(error)! };
  return done(`${data.order_number} is ready. Tap its WhatsApp button to send the message.`);
}

export async function advanceWeek(_: ActionState, form: FormData): Promise<ActionState> {
  const to = String(form.get("to"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_week", { p_week: String(form.get("week")), p_to: to });
  if (error) return { ok: false, message: explain(error)! };
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
