// POST /api/orders/status: the private status link (gap 4, D-028).
// The token travels in the request body, never in a URL, so it does not end
// up in logs. Returns only what get_order_status() allows: first name,
// masked phone, items, totals, collection and in-app messages.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";
import { logError } from "@/lib/log-error";

const noStore = { "Cache-Control": "no-store" };

const requestSchema = z.object({
  order_number: z.string().trim().max(20),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  }

  const { data, error } = await createAnonClient().rpc("get_order_status", {
    p_order_number: parsed.data.order_number,
    p_token: parsed.data.token,
  });

  if (error) {
    await logError("orders/status", error.message);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  }

  // EFT customers need the bank details once Kaydee has confirmed (REQ-12, REQ-14).
  const bank =
    data.payment_method === "eft" && data.payment_reference ? (process.env.EFT_BANK_DETAILS ?? null) : null;

  // REQ-26: offer the feedback form once the order is collected.
  const feedback =
    data.order_status === "collected"
      ? await createAnonClient().rpc("can_give_feedback", {
          p_order_number: parsed.data.order_number,
          p_token: parsed.data.token,
        })
      : { data: false };

  return NextResponse.json({ ...data, bank_details: bank, can_give_feedback: feedback.data === true }, { headers: noStore });
}
