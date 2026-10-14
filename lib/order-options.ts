// Collection days and limits for the order form, from get_order_options()
// (the database works out the Thursday 20:00 cut-off in SAST). Cached for a
// minute like the menu; the server re-checks the date when the order arrives.
import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

export type OrderOptions = {
  collection_dates: string[];
  slots: ("second_break" | "after_school")[];
  next_cutoff: string;
  large_order_threshold: number;
  max_per_flavour: number;
};

export const ORDER_OPTIONS_CACHE_TAG = "order-options";

const fallback: OrderOptions = {
  collection_dates: [],
  slots: ["second_break", "after_school"],
  next_cutoff: "",
  large_order_threshold: 30,
  max_per_flavour: 100,
};

export async function getOrderOptions(): Promise<OrderOptions> {
  "use cache";
  cacheTag(ORDER_OPTIONS_CACHE_TAG);
  cacheLife("minutes");

  const { data, error } = await createAnonClient().rpc("get_order_options");
  if (error || !data) {
    console.error("get_order_options failed", error?.message);
    return fallback;
  }
  return { ...fallback, ...data, collection_dates: data.collection_dates ?? [] };
}
