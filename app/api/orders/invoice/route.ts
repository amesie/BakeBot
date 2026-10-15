// POST /api/orders/invoice (REQ-14): the customer's invoice PDF. Posted from
// a form on the status page so the token stays in the request body, never in
// a URL. Built on demand from get_invoice() (D-049).
import { NextResponse } from "next/server";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { whatsAppDisplay } from "@/lib/site";
import { createAnonClient } from "@/lib/supabase/anon";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const orderNumber = String(form?.get("order_number") ?? "");
  const token = String(form?.get("token") ?? "");

  const { data, error } = await createAnonClient().rpc("get_invoice", {
    p_order_number: orderNumber,
    p_token: token,
  });
  if (error) return new NextResponse("We can't make your invoice right now. Please try again.", { status: 503 });
  if (!data) return new NextResponse("Invoice not found. It is available once Kaydee has approved your order.", { status: 404 });

  const pdf = await buildInvoicePdf({
    ...data,
    billed_to: data.first_name,
    total_amount: Number(data.total_amount),
    quote_amount: data.quote_amount === null ? null : Number(data.quote_amount),
    bank_details: data.payment_method === "eft" ? (process.env.EFT_BANK_DETAILS ?? null) : null,
    contact: whatsAppDisplay ? `WhatsApp ${whatsAppDisplay}` : null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="KD-Pops-invoice-${data.invoice_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
