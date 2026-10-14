// Security NFR (spec section 10): using the public key over HTTP, reading
// customer data must fail. Runs against the linked Supabase project, so it is
// skipped when the Supabase env vars are not set (e.g. in CI).
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const tables = [
  "customers", "orders", "order_items", "payments", "invoices", "feedback",
  "conversations", "notifications", "staff_roles", "products", "faq_knowledge",
  "weekly_capacity", "app_settings", "job_runs", "error_log",
];

describe.skipIf(!url || !key)("public key cannot reach customer data [Security NFR]", () => {
  // Created lazily: the describe body still runs when the suite is skipped.
  const client = () => createClient(url!, key!, { auth: { persistSession: false } });

  it.each(tables)("cannot read %s", async (table) => {
    const { data, error } = await client().from(table).select("*").limit(1);
    expect(data).toBeNull();
    expect(error?.code).toBe("42501"); // permission denied
  });

  it("cannot insert an order", async () => {
    const { error } = await client().from("orders").insert({ payment_method: "cash" });
    expect(error?.code).toBe("42501");
  });

  it("can read the menu through get_menu()", async () => {
    const { data, error } = await client().rpc("get_menu");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(Object.keys(data![0])).not.toContain("is_available");
  });

  it("health_check() responds", async () => {
    const { data, error } = await client().rpc("health_check");
    expect(error).toBeNull();
    expect(data.status).toBe("ok");
  });
});
