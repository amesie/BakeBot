// GET /dashboard/proof/:orderId: staff open a proof of payment through a
// signed URL that expires after 15 minutes (spec 7.8). Storage policies only
// let staff create it; everyone else gets "not found".
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_SECONDS = 15 * 60;

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("proof_of_payment_path")
    .eq("order_id", orderId)
    .maybeSingle();
  const path = payment?.proof_of_payment_path;
  if (!path) return new NextResponse("No proof of payment for this order.", { status: 404 });

  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) return new NextResponse("No proof of payment for this order.", { status: 404 });

  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
