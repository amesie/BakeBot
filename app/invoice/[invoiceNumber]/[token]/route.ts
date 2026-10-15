// GET /invoice/:invoiceNumber/:token: private invoice link sent by WhatsApp
// (D-053). The token opens only this invoice PDF (first name only). Not
// cached by the service worker; no referrer is sent onwards.
import { NextResponse } from "next/server";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { whatsAppDisplay } from "@/lib/site";
import { createAnonClient } from "@/lib/supabase/anon";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceNumber: string; token: string }> }) {
  const { invoiceNumber, token } = await params;
  const { data, error } = await createAnonClient().rpc("get_invoice_by_link", {
    p_invoice_number: decodeURIComponent(invoiceNumber),
    p_share_token: token,
  });
  if (error) return new NextResponse("We can't open this invoice right now. Please try again.", { status: 503 });
  if (!data) return new NextResponse("Invoice not found. Please check the link.", { status: 404 });

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
      "Content-Disposition": `inline; filename="KD-Pops-invoice-${data.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
