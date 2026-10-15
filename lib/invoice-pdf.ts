// Invoice PDF (REQ-14), built on demand from the database (D-049): nothing
// is stored, so an anonymised customer's invoice is anonymised too, while the
// invoice number and total stay in the invoices table for the records.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatDay, sastDate } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { dictionaries } from "@/lib/i18n";
import { proofEmail } from "@/lib/site";

export type InvoiceData = {
  invoice_number: string;
  issued_at: string;
  order_number: string;
  billed_to: string;
  items: { flavour: string; quantity: number; unit_price: number; line_total: number }[];
  total_amount: number;
  quote_amount: number | null;
  payment_method: "cash" | "eft";
  payment_status: "unpaid" | "pending_review" | "paid";
  collection_date: string;
  collection_slot: "second_break" | "after_school";
  collection_place: string | null;
  bank_details?: string | null;
  contact?: string | null;
};

const brown = rgb(0x3b / 255, 0x2a / 255, 0x20 / 255);
const milk = rgb(0x7b / 255, 0x4a / 255, 0x2e / 255);
const cream = rgb(0xf5 / 255, 0xed / 255, 0xe0 / 255);
const en = dictionaries.en;

/** Standard PDF fonts only cover Western European characters; never crash on others. */
function safe(font: PDFFont, text: string): string {
  const clean = text.normalize("NFC").replace(/[\r\n\t]+/g, " ");
  try {
    font.widthOfTextAtSize(clean, 10);
    return clean;
  } catch {
    return [...clean]
      .map((ch) => {
        try {
          font.widthOfTextAtSize(ch, 10);
          return ch;
        } catch {
          return "?";
        }
      })
      .join("");
  }
}

export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`KD Pops invoice ${data.invoice_number}`);
  pdf.setAuthor("KD Pops");
  const page = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const left = 56;
  const right = 595.28 - 56;
  let y = 841.89 - 64;

  const text = (value: string, x: number, size = 10, font = regular, color = brown) =>
    page.drawText(safe(font, value), { x, y, size, font, color });
  const textRight = (value: string, x: number, size = 10, font = regular) => {
    const v = safe(font, value);
    page.drawText(v, { x: x - font.widthOfTextAtSize(v, size), y, size, font, color: brown });
  };

  // Header band
  page.drawRectangle({ x: 0, y: y - 30, width: 595.28, height: 94, color: cream });
  text("KD POPS", left, 30, bold);
  textRight("INVOICE", right, 18, bold);
  y -= 20;
  text("Handmade cake pops", left, 10, regular, milk);
  y -= 50;

  // Details
  const details: [string, string][] = [
    ["Invoice number", data.invoice_number],
    ["Date", `${formatDay(sastDate(data.issued_at), en)} ${sastDate(data.issued_at).slice(0, 4)}`],
    ["Order", data.order_number],
    ["Billed to", data.billed_to],
  ];
  for (const [label, value] of details) {
    text(label, left, 10, regular, milk);
    text(value, left + 110, 10, bold);
    y -= 16;
  }
  y -= 18;

  // Items
  text("Item", left, 10, bold);
  textRight("Qty", right - 170, 10, bold);
  textRight("Each", right - 90, 10, bold);
  textRight("Amount", right, 10, bold);
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: brown });
  y -= 16;
  for (const item of data.items) {
    text(`Cake pop: ${item.flavour}`, left);
    textRight(String(item.quantity), right - 170);
    textRight(formatRand(item.unit_price), right - 90);
    textRight(formatRand(item.line_total), right);
    y -= 18;
  }
  if (data.quote_amount !== null) {
    text("Quoted price for this large order (replaces the item amounts)", left, 10, regular, milk);
    y -= 18;
  }
  page.drawLine({ start: { x: left, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.5, color: milk });
  y -= 14;
  text("Total", right - 170, 14, bold);
  textRight(formatRand(data.total_amount), right, 14, bold);
  y -= 34;

  // Payment and collection
  const status = data.payment_status === "paid" ? "Paid - thank you!" : en.status.paymentLabel[data.payment_status];
  const lines: [string, string][] = [
    ["Payment", `${en.payment[data.payment_method]} (${status})`],
    ...(data.payment_method === "eft" ? ([["EFT reference", data.invoice_number]] as [string, string][]) : []),
    ...(data.payment_method === "eft" && data.payment_status !== "paid"
      ? ([["Proof of payment", `Email ${proofEmail}, subject: ${data.invoice_number}`]] as [string, string][])
      : []),
    ["Collection", `${formatDay(data.collection_date, en)}, ${en.slots[data.collection_slot]}`],
    ...(data.collection_place ? ([["Where", data.collection_place]] as [string, string][]) : []),
  ];
  for (const [label, value] of lines) {
    text(label, left, 10, regular, milk);
    text(value, left + 110, 10);
    y -= 16;
  }
  if (data.payment_method === "eft" && data.bank_details && data.payment_status !== "paid") {
    y -= 8;
    text("Bank details", left, 10, regular, milk);
    for (const line of data.bank_details.split(/\r?\n/).filter(Boolean)) {
      text(line, left + 110, 10);
      y -= 14;
    }
  }

  // Footer
  y = 64;
  page.drawLine({ start: { x: left, y: y + 18 }, end: { x: right, y: y + 18 }, thickness: 0.5, color: milk });
  text("Thank you for supporting KD Pops!", left, 10, bold);
  if (data.contact) textRight(data.contact, right, 10);

  return pdf.save();
}
