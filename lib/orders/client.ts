// Browser side of ordering: send an order, keep it on the phone until the
// server has it (REQ-25), and remember placed orders for status links.
import { del, entries, set } from "idb-keyval";
import type { FieldErrors, OrderRequest } from "./schema";
import { retryWithBackoff } from "./retry";

export type OrderSummary = {
  ok: true;
  duplicate: boolean;
  order_number: string;
  order_status: "waitlisted" | "pending" | "confirmed" | "baking" | "ready" | "collected" | "cancelled";
  payment_method: "cash" | "eft";
  payment_status: "unpaid" | "pending_review" | "paid";
  payment_reference: string | null;
  collection_date: string;
  revised_collection_date: string | null;
  collection_slot: "second_break" | "after_school";
  collection_place: string | null;
  is_large_order: boolean;
  quote_amount: number | null;
  total_units: number;
  total_amount: number;
  released: boolean;
  created_at: string;
  first_name: string;
  phone_masked: string;
  items: { flavour: string; quantity: number; unit_price: number; line_total: number }[];
  messages: { template: string; params: Record<string, string>; created_at: string }[];
  bank_details?: string | null;
  can_give_feedback?: boolean;
};

export type SendResult =
  | { kind: "placed"; order: OrderSummary }
  | { kind: "invalid"; errors: FieldErrors }
  | { kind: "offline" };

const DRAFT_PREFIX = "draft:";

/** One attempt to send an order. Network or server trouble counts as offline. */
export async function sendOrder(payload: OrderRequest): Promise<SendResult> {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { kind: "placed", order: await response.json() };
    if (response.status === 422 || response.status === 409) {
      const body = await response.json();
      return { kind: "invalid", errors: body.errors ?? {} };
    }
    return { kind: "offline" };
  } catch {
    return { kind: "offline" };
  }
}

// ---------------------------------------------------------------- drafts

export async function saveDraft(payload: OrderRequest) {
  try {
    await set(DRAFT_PREFIX + payload.order_id, { payload, savedAt: Date.now() });
  } catch {
    // IndexedDB unavailable (private mode): the order is still sent normally.
  }
}

export async function removeDraft(orderId: string) {
  try {
    await del(DRAFT_PREFIX + orderId);
  } catch {}
}

export async function listDrafts(): Promise<OrderRequest[]> {
  try {
    return (await entries<string, { payload: OrderRequest }>())
      .filter(([key]) => String(key).startsWith(DRAFT_PREFIX))
      .map(([, value]) => value.payload);
  } catch {
    return [];
  }
}

/**
 * REQ-25: resend every saved draft, each up to 3 times (2 s, 4 s, 8 s). The
 * same order_id is sent every time, so the server never makes a duplicate.
 */
export async function resendDrafts(
  onPlaced: (order: OrderSummary, token: string) => void,
  onRejected?: (errors: FieldErrors) => void,
) {
  for (const draft of await listDrafts()) {
    const { value } = await retryWithBackoff<SendResult>(async () => {
      const result = await sendOrder(draft);
      return result.kind === "offline" ? { done: false } : { done: true, value: result };
    });
    if (value?.kind === "placed") {
      rememberOrder(value.order.order_number, draft.access_token);
      await removeDraft(draft.order_id);
      onPlaced(value.order, draft.access_token);
    } else if (value?.kind === "invalid") {
      // Rejected (for example the week closed while offline): stop retrying.
      await removeDraft(draft.order_id);
      onRejected?.(value.errors);
    }
  }
}

// ---------------------------------------------------------------- placed orders

const ORDERS_KEY = "kdpops-orders";

export type SavedOrder = { order_number: string; token: string; placed_at: number };

export function rememberOrder(orderNumber: string, token: string) {
  try {
    const list = savedOrders().filter((o) => o.order_number !== orderNumber);
    list.unshift({ order_number: orderNumber, token, placed_at: Date.now() });
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

export function savedOrders(): SavedOrder[] {
  try {
    return JSON.parse(window.localStorage.getItem(ORDERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
