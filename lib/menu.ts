// Menu data for the public site (REQ-04). Read through get_menu(), the only
// product access the public key has (D-009). Cached for a few minutes and
// tagged so the owner dashboard can refresh it when prices or stock change.
import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

export type MenuItem = {
  product_id: string;
  product_name: string;
  flavour: string;
  description: string | null;
  unit_price: number;
};

export const MENU_CACHE_TAG = "menu";

export async function getMenu(): Promise<MenuItem[]> {
  "use cache";
  cacheTag(MENU_CACHE_TAG);
  cacheLife("minutes");

  const { data, error } = await createAnonClient().rpc("get_menu");
  if (error) {
    console.error("get_menu failed", error.message);
    return [];
  }
  return (data ?? []).map((item: MenuItem) => ({ ...item, unit_price: Number(item.unit_price) }));
}
