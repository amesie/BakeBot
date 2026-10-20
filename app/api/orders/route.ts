// POST /api/orders: place a pre-order (spec 7.1, REQ-01 to REQ-10).
//
// 1. Validate with the shared Zod schema (REQ-05) for quick field errors.
// 2. Call place_order(), which repeats every check and does the lookup,
//    pricing, capacity, large-order and idempotency logic in one transaction.
//
// Responses: 201 new order, 200 duplicate retry (REQ-09), 422 field errors,
// 409 order id reused with another token, 503 database unreachable (the
// browser keeps the draft and retries, REQ-25).
import { after, NextResponse } from "next/server";
import { validateOrder } from "@/lib/orders/schema";
import { createAnonClient } from "@/lib/supabase/anon";
import { logError } from "@/lib/log-error";
import { sendOrderReceived } from "@/lib/email/customer-mail";

const noStore = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 16_000;

export async function POST(request: Request) {
  const started = performance.now();

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413, headers: noStore });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const checked = validateOrder(body);
  if (!checked.ok) {
    return NextResponse.json({ ok: false, errors: checked.errors }, { status: 422, headers: noStore });
  }

  const { data, error } = await createAnonClient().rpc("place_order", { p: checked.data });
  const elapsed = Math.round(performance.now() - started);
  const headers = { ...noStore, "Server-Timing": `order;dur=${elapsed}` };

  if (error || !data) {
    await logError("orders", error?.message ?? "place_order returned nothing", { ms: elapsed });
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }

  if (!data.ok) {
    const status = data.errors?.order_id === "conflict" ? 409 : 422;
    return NextResponse.json({ ok: false, errors: data.errors }, { status, headers });
  }

  // D-070: order-received email (details, track and cancel links) after the
  // response, so it never slows the order down. Not repeated for retries.
  const email = checked.data.email?.trim();
  if (email && !data.duplicate) {
    const origin = new URL(request.url).origin;
    after(() =>
      sendOrderReceived(origin, checked.data.access_token, email, {
        ...data,
        language: checked.data.language,
        total_amount: Number(data.total_amount),
        quote_amount: data.quote_amount === null ? null : Number(data.quote_amount),
      }),
    );
  }

  return NextResponse.json(data, { status: data.duplicate ? 200 : 201, headers });
}
