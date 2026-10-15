// Dashboard data, read as the signed-in staff member. Row level security
// decides what each role sees (owner: everything; helper: orders and
// payments), so these queries never use a secret key.
import { createClient } from "@/lib/supabase/server";
import type { DashboardOrder, PaidPayment, StaffRole } from "./types";

export type { DashboardOrder, PaidPayment, StaffRole } from "./types";
export { orderTotal } from "./types";

const ORDER_FIELDS = `
  order_id, order_number, order_status, payment_method, payment_reference,
  collection_date, collection_week, collection_slot, revised_collection_date,
  special_notes, total_units, is_large_order, quote_amount, created_at, released_at,
  customers ( full_name, phone_number, is_minor ),
  order_items ( quantity, unit_price_snapshot, products ( flavour ) ),
  payments ( amount, payment_status, paid_at )
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
