// Dashboard types and helpers safe to use in browser components.

export type StaffRole = "owner" | "helper";

export type DashboardOrder = {
  order_id: string;
  order_number: string;
  order_status: "waitlisted" | "pending" | "confirmed" | "baking" | "ready" | "collected" | "cancelled";
  payment_method: "cash" | "eft";
  payment_reference: string | null;
  collection_date: string;
  collection_week: string;
  collection_slot: "second_break" | "after_school";
  revised_collection_date: string | null;
  special_notes: string | null;
  total_units: number;
  is_large_order: boolean;
  quote_amount: number | null;
  created_at: string;
  released_at: string | null;
  customers: { full_name: string; phone_number: string; is_minor: boolean; preferred_language: "en" | "xh" | "af" } | null;
  order_items: { quantity: number; unit_price_snapshot: number; products: { flavour: string } | null }[];
  payments: { amount: number; payment_status: "unpaid" | "pending_review" | "paid"; paid_at: string | null } | null;
};

export type PaidPayment = {
  amount: number;
  paid_at: string;
  orders: { order_number: string; payment_method: "cash" | "eft"; customers: { full_name: string } | null } | null;
};

export function orderTotal(order: DashboardOrder) {
  if (order.quote_amount !== null) return Number(order.quote_amount);
  if (order.payments) return Number(order.payments.amount);
  return order.order_items.reduce((sum, item) => sum + item.quantity * Number(item.unit_price_snapshot), 0);
}

/** Lower-case and strip accents so "zoe" finds "Zoë". */
function fold(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Dashboard search: matches customer name (any part) or order number. */
export function matchesSearch(name: string | null | undefined, orderNumber: string | null | undefined, query: string) {
  const q = fold(query);
  if (!q) return true;
  return fold(name ?? "").includes(q) || fold(orderNumber ?? "").includes(q);
}
