// REQ-14: invoice PDFs build for every case without crashing.
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildInvoicePdf, type InvoiceData } from "@/lib/invoice-pdf";

const base: InvoiceData = {
  invoice_number: "KDP-0042-7F3K",
  issued_at: "2026-10-16T08:00:00Z",
  order_number: "KDP-0042",
  billed_to: "Thandi",
  items: [
    { flavour: "Belgian Chocolate", quantity: 2, unit_price: 15, line_total: 30 },
    { flavour: "Funfetti", quantity: 3, unit_price: 10, line_total: 30 },
  ],
  total_amount: 60,
  quote_amount: null,
  payment_method: "eft",
  payment_status: "unpaid",
  collection_date: "2026-10-19",
  collection_slot: "second_break",
  collection_place: "Mrs Felix's class, R129",
  bank_details: "Bank: Example\nAccount number: 000",
  contact: "WhatsApp 060 873 3053",
};

describe("invoice PDF [REQ-14]", () => {
  it("is a one-page PDF titled with the invoice number", async () => {
    const bytes = await buildInvoicePdf(base);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("KD Pops invoice KDP-0042-7F3K");
  });

  it("handles cash, paid, quotes and names outside the PDF font", async () => {
    const bytes = await buildInvoicePdf({
      ...base,
      payment_method: "cash",
      payment_status: "paid",
      quote_amount: 450,
      total_amount: 450,
      billed_to: "Zoë Ŋ 李",
      bank_details: null,
    });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
