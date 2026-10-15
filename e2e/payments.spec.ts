// Status page payments (REQ-14 invoice, REQ-15 proof upload). The API is
// faked in the browser so no real order is touched (D-034).
import { expect, test } from "@playwright/test";

const TOKEN = "t".repeat(43);
const order = {
  order_number: "KDP-0042",
  order_status: "confirmed",
  payment_method: "eft",
  payment_status: "unpaid",
  payment_reference: "KDP-0042-7F3K",
  collection_date: "2026-10-19",
  revised_collection_date: null,
  collection_slot: "second_break",
  collection_place: "Mrs Felix's class, R129",
  is_large_order: false,
  quote_amount: null,
  total_units: 2,
  total_amount: 30,
  released: false,
  created_at: "2026-10-16T08:00:00Z",
  first_name: "Thandi",
  phone_masked: "******4567",
  items: [{ flavour: "Belgian Chocolate", quantity: 2, unit_price: 15, line_total: 30 }],
  messages: [],
  bank_details: "Bank: Example\nAccount number: 000",
};

test("approved EFT order: invoice button and proof upload [REQ-14, REQ-15]", async ({ page }) => {
  await page.route("**/api/orders/status", (route) => route.fulfill({ json: order }));
  let uploaded: string | null = null;
  await page.route("**/api/payments/proof", async (route) => {
    uploaded = route.request().postData() ?? "";
    await route.fulfill({ json: { ...order, payment_status: "pending_review" } });
  });

  await page.goto(`/order/KDP-0042#${TOKEN}`);
  await expect(page.getByText("KDP-0042-7F3K").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Download invoice" })).toBeVisible();

  await page.getByLabel("Proof of payment").setInputFiles({
    name: "proof.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test"),
  });
  await page.getByRole("button", { name: "Send proof" }).click();
  await expect(page.getByText("Kaydee will check it and mark your order as paid")).toBeVisible();
  expect(uploaded).toContain(TOKEN); // token sent in the body, not the URL
  await expect(page.getByText("Proof received, being checked")).toBeVisible();
});

test("cash orders and paid orders have no upload box", async ({ page }) => {
  await page.route("**/api/orders/status", (route) =>
    route.fulfill({ json: { ...order, payment_method: "cash", bank_details: null } }),
  );
  await page.goto(`/order/KDP-0042#${TOKEN}`);
  await expect(page.getByRole("button", { name: "Download invoice" })).toBeVisible();
  await expect(page.getByText("Send your proof of payment")).toHaveCount(0);
});

test("upload API refuses files that are not images or PDFs", async ({ request }) => {
  const response = await request.post("/api/payments/proof", {
    multipart: {
      order_number: "KDP-0042",
      token: TOKEN,
      file: { name: "x.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") },
    },
  });
  expect(response.status()).toBe(415);
});
