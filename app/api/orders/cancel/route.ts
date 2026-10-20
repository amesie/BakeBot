// POST /api/orders/cancel (D-071): the customer cancels from the status page
// (reached from the "Cancel my order" button in their email). Allowed until
// baking starts and while nothing has been paid; token-checked in the database.
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { sendCancelled } from "@/lib/email/customer-mail";
import { logError } from "@/lib/log-error";
import { createAnonClient } from "@/lib/supabase/anon";

const noStore = { "Cache-Control": "no-store" };
const schema = z.object({
  order_number: z.string().trim().max(20),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });

  const { data, error } = await createAnonClient().rpc("cancel_order", {
    p_order_number: parsed.data.order_number,
    p_token: parsed.data.token,
  });
  if (error) {
    const known = ["not_found", "too_late", "paid_contact_kaydee"];
    if (!known.includes(error.message)) await logError("orders/cancel", error.message);
    const code = known.includes(error.message) ? error.message : "unavailable";
    return NextResponse.json({ error: code }, { status: code === "not_found" ? 404 : code === "unavailable" ? 503 : 409, headers: noStore });
  }

  const { email, language, ...order } = data;
  after(() =>
    sendCancelled(parsed.data.token, email, {
      ...order,
      language,
      total_amount: Number(order.total_amount),
      quote_amount: order.quote_amount === null ? null : Number(order.quote_amount),
    }),
  );
  return NextResponse.json(order, { headers: noStore });
}
