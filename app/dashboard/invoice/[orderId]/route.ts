// GET /dashboard/invoice/:orderId: staff download an order's invoice PDF
// (REQ-14), with the customer's full name. RLS limits this to staff.
import { NextResponse } from "next/server";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { whatsAppDisplay } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();
  const [{ data: order }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `order_number, payment_method, collection_date, revised_collection_date, collection_slot, quote_amount,
         customers ( full_name ),
         order_items ( quantity, unit_price_snapshot, products ( flavour, sort_order ) ),
         payments ( payment_status ),
         invoices ( invoice_number, issued_at, total_amount )`,
      )
      .eq("order_id", orderId)
      .maybeSingle(),
    supabase.from("app_settings").select("collection_place").maybeSingle(),
  ]);

  type Row = {
    order_number: string;
    payment_method: "cash" | "eft";
    collection_date: string;
    revised_collection_date: string | null;
    collection_slot: "second_break" | "after_school";
    quote_amount: number | null;
    customers: { full_name: string } | null;
    order_items: { quantity: number; unit_price_snapshot: number; products: { flavour: string; sort_order: number } | null }[];
    payments: { payment_status: "unpaid" | "pending_review" | "paid" } | null;
    invoices: { invoice_number: string; issued_at: string; total_amount: number } | null;
  };
  const row = order as unknown as Row | null;
  if (!row?.invoices) return new NextResponse("No invoice yet: approve the order first.", { status: 404 });

  const pdf = await buildInvoicePdf({
    invoice_number: row.invoices.invoice_number,
    issued_at: row.invoices.issued_at,
    order_number: row.order_number,
    billed_to: row.customers?.full_name ?? "",
    items: [...row.order_items]
      .sort((a, b) => (a.products?.sort_order ?? 0) - (b.products?.sort_order ?? 0))
      .map((i) => ({
        flavour: i.products?.flavour ?? "",
        quantity: i.quantity,
        unit_price: Number(i.unit_price_snapshot),
        line_total: i.quantity * Number(i.unit_price_snapshot),
      })),
    total_amount: Number(row.invoices.total_amount),
    quote_amount: row.quote_amount === null ? null : Number(row.quote_amount),
    payment_method: row.payment_method,
    payment_status: row.payments?.payment_status ?? "unpaid",
    collection_date: row.revised_collection_date ?? row.collection_date,
    collection_slot: row.collection_slot,
    collection_place: settings?.collection_place ?? null,
    bank_details: row.payment_method === "eft" ? (process.env.EFT_BANK_DETAILS ?? null) : null,
    contact: whatsAppDisplay ? `WhatsApp ${whatsAppDisplay}` : null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="KD-Pops-invoice-${row.invoices.invoice_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
