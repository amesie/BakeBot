// Dashboard data, read as the signed-in staff member. Row level security
// decides what each role sees (owner: everything; helper: orders and
// payments), so these queries never use a secret key.
import { createClient } from "@/lib/supabase/server";
import type { DashboardOrder, FeedbackRow, OwnerUpdate, PaidPayment, StaffRole } from "./types";

export type { DashboardOrder, FeedbackRow, OwnerUpdate, PaidPayment, StaffRole } from "./types";
export { orderTotal } from "./types";

const ORDER_FIELDS = `
  order_id, order_number, order_status, payment_method, payment_reference,
  collection_date, collection_week, collection_slot, revised_collection_date,
  special_notes, total_units, is_large_order, quote_amount, created_at, released_at,
  customers ( full_name, phone_number, is_minor, preferred_language ),
  order_items ( quantity, unit_price_snapshot, products ( flavour ) ),
  payments ( amount, payment_status, paid_at ),
  invoices ( share_token ),
  notifications ( template, created_at )
`;

/** The signed-in user and their staff role, or null if not staff. */
export async function getStaff() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { signedIn: false as const };
  const { data } = await supabase.from("staff_roles").select("role, display_name").eq("user_id", userId).maybeSingle();
  return {
    signedIn: true as const,
    email: (claims?.claims?.email as string | undefined) ?? "",
    role: (data?.role ?? null) as StaffRole | null,
    name: data?.display_name ?? null,
  };
}

export async function getOrders(statuses: DashboardOrder["order_status"][], limit = 200) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_FIELDS)
    .in("order_status", statuses)
    .order("collection_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DashboardOrder[];
}

export async function getRecentlyPaid(limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("amount, paid_at, orders ( order_number, payment_method, customers ( full_name ) )")
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PaidPayment[];
}

export async function getSettings() {
  const supabase = await createClient();
  const [{ data: settings }, { data: caps }, { data: products }] = await Promise.all([
    supabase.from("app_settings").select("*").maybeSingle(),
    supabase.from("weekly_capacity").select("week_start, unit_cap").order("week_start"),
    supabase.from("products").select("product_id, flavour, description, unit_price, is_available, sort_order").order("sort_order"),
  ]);
  return {
    settings: settings as {
      default_weekly_cap: number;
      large_order_threshold: number;
      last_school_day_isodow: number;
      collection_place: string;
    } | null,
    caps: (caps ?? []) as { week_start: string; unit_cap: number }[],
    products: (products ?? []) as {
      product_id: string;
      flavour: string;
      description: string | null;
      unit_price: number;
      is_available: boolean;
    }[],
  };
}

export async function getCollectionPlace() {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("collection_place").maybeSingle();
  return (data?.collection_place as string | undefined) ?? "";
}

export async function getOrdersByIds(ids: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select(ORDER_FIELDS).in("order_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DashboardOrder[];
}

/** BakeBot's messages to Kaydee: daily summary, bake list, release report. */
export async function getOwnerUpdates(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("template, params, created_at")
    .eq("recipient", "owner")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as OwnerUpdate[];
}

export async function getFeedback(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feedback")
    .select("rating, taste_rating, size_rating, price_rating, comment, created_at, orders ( order_number, customers ( full_name ) )")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as FeedbackRow[];
}

export type ChatMessage = { role: "bot" | "customer" | "system"; text: string; at: string };
export type Conversation = {
  conversation_id: string;
  language: "en" | "xh" | "af";
  messages: ChatMessage[];
  unresolved_attempts: number;
  escalated: boolean;
  escalated_at: string | null;
  resolved_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  fallback_count: number;
  created_at: string;
};

const CONVERSATION_FIELDS =
  "conversation_id, language, messages, unresolved_attempts, escalated, escalated_at, resolved_at, contact_name, contact_phone, fallback_count, created_at";

/** REQ-23 handover inbox, plus a sample of the last week's chats for review. */
export async function getInbox() {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [{ data: handovers }, { data: recent }] = await Promise.all([
    supabase.from("conversations").select(CONVERSATION_FIELDS).eq("escalated", true).is("resolved_at", null).order("escalated_at"),
    supabase.from("conversations").select(CONVERSATION_FIELDS).gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(10),
  ]);
  return { handovers: (handovers ?? []) as Conversation[], recent: (recent ?? []) as Conversation[] };
}

export type Faq = {
  faq_id: string;
  question: string;
  approved_answer: string;
  category: "pricing" | "discounts" | "allergens" | "other";
  language: "en" | "xh" | "af";
  is_active: boolean;
  has_embedding: boolean;
};

export async function getFaqs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_knowledge")
    .select("faq_id, question, approved_answer, category, language, is_active, embedding")
    .order("category")
    .order("question");
  return (data ?? []).map(({ embedding, ...faq }) => ({ ...faq, has_embedding: embedding !== null })) as Faq[];
}
