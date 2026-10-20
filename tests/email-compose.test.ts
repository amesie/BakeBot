// D-070: customer emails are in the customer's language, carry the right
// links and never let customer text break the HTML.
import { describe, expect, it } from "vitest";
import { cancelledEmail, invoiceEmail, orderReceivedEmail, readyEmail, type EmailOrder } from "@/lib/email/compose";

const order: EmailOrder = {
  order_number: "KDP-0042",
  first_name: "Thandi",
  language: "en",
  items: [
    { flavour: "Belgian Chocolate", quantity: 2, line_total: 30 },
    { flavour: "Funfetti", quantity: 3, line_total: 30 },
  ],
  total_amount: 60,
  is_large_order: false,
  quote_amount: null,
  collection_date: "2026-10-26",
  collection_slot: "second_break",
  collection_place: "Mrs Felix's class, R129",
  payment_method: "eft",
  payment_reference: "KDP-0042-7F3K",
};
const links = {
  track: "https://bake-bot-phi.vercel.app/order/KDP-0042#" + "t".repeat(43),
  cancel: "https://bake-bot-phi.vercel.app/order/KDP-0042?cancel=1#" + "t".repeat(43),
};

describe("order received email", () => {
  const email = orderReceivedEmail({ ...order, payment_reference: null }, links);

  it("has the order number in the subject and the customer's name", () => {
    expect(email.subject).toBe("KD Pops order KDP-0042 received");
    expect(email.html).toContain("Thanks Thandi! Your order is in.");
  });

  it("lists items, total and collection", () => {
    expect(email.text).toContain("2 x Belgian Chocolate  R30");
    expect(email.text).toContain("Total: R60");
    expect(email.text).toContain("Monday 26 October, 2nd break · 11:45–12:00, Mrs Felix's class, R129");
  });

  it("includes the track and cancel links", () => {
    expect(email.html).toContain(links.track);
    expect(email.html).toContain(links.cancel);
    expect(email.text).toContain(`Cancel my order: ${links.cancel}`);
  });

  it("says a quote is coming for large orders instead of a total", () => {
    const large = orderReceivedEmail({ ...order, is_large_order: true }, links);
    expect(large.text).toContain("Total: Kaydee will send you a quote");
  });

  it("escapes customer text in the HTML", () => {
    const sneaky = orderReceivedEmail({ ...order, first_name: "<script>x</script>" }, links);
    expect(sneaky.html).not.toContain("<script>x</script>");
    expect(sneaky.html).toContain("&lt;script&gt;");
  });
});

describe("other emails", () => {
  it("invoice email: reference, proof instructions and invoice link", () => {
    const email = invoiceEmail(order, "https://bake-bot-phi.vercel.app/invoice/KDP-0042-7F3K/" + "s".repeat(43));
    expect(email.subject).toBe("KD Pops order KDP-0042 confirmed – invoice KDP-0042-7F3K");
    expect(email.text).toContain("Please pay R60 by EFT using reference KDP-0042-7F3K");
    expect(email.text).toContain("thebakebot@gmail.com");
    expect(email.html).toContain("/invoice/KDP-0042-7F3K/");
  });

  it("ready email in Afrikaans", () => {
    const email = readyEmail({ ...order, language: "af" });
    expect(email.subject).toBe("Jou KD Pops-bestelling KDP-0042 is gereed!");
    expect(email.text).toContain("Maandag 26 Oktober");
  });

  it("cancelled email in isiXhosa", () => {
    const email = cancelledEmail({ ...order, language: "xh" });
    expect(email.subject).toBe("I-odolo ye-KD Pops KDP-0042 irhoxisiwe");
  });

  it("unknown language falls back to English", () => {
    expect(readyEmail({ ...order, language: "fr" }).subject).toBe("Your KD Pops order KDP-0042 is ready!");
  });
});

describe("footer", () => {
  it("never shows an empty WhatsApp number", () => {
    const email = readyEmail(order);
    expect(email.text).not.toMatch(/on \.\s*$/m);
    expect(email.text).toContain("Sent by BakeBot");
  });
});
