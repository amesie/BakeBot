// POST /api/orders/feedback (REQ-26): feedback from the status page after
// collection. Token-checked and once per order in submit_feedback().
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";

const rating = z.number().int().min(1).max(5);
const schema = z.object({
  order_number: z.string().trim().max(20),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  rating,
  taste: rating.optional(),
  size: rating.optional(),
  price: rating.optional(),
  comment: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422 });
  const f = parsed.data;
  const { error } = await createAnonClient().rpc("submit_feedback", {
    p_order_number: f.order_number,
    p_token: f.token,
    p_rating: f.rating,
    p_taste: f.taste ?? null,
    p_size: f.size ?? null,
    p_price: f.price ?? null,
    p_comment: f.comment ?? null,
  });
  if (error) {
    const status = error.message === "already_given" ? 409 : error.message === "not_found" ? 404 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
