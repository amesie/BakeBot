// Customer email and cancelling (D-070, D-071). APIs are faked in the
// browser so no real orders or emails are created (D-034).
import { expect, test, type Page } from "@playwright/test";

const TOKEN = "c".repeat(43);

async function toForm(page: Page) {
  await page.goto("/#order");
  await page.getByLabel("I agree to KD Pops using my details for my order").check();
  await page.getByLabel("No", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill("Thandi Test");
  await page.getByLabel("Cell number").fill("082 123 4567");
}

test("email is optional, checked, and sent with the order", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/orders", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        ok: true, duplicate: false, order_number: "KDP-0050", order_status: "pending", payment_method: "cash",
        payment_status: "unpaid", payment_reference: null, collection_date: "2026-10-26", revised_collection_date: null,
        collection_slot: "second_break", collection_place: null, is_large_order: false, quote_amount: null,
        total_units: 1, total_amount: 15, released: false, created_at: new Date().toISOString(), first_name: "Thandi",
        phone_masked: "******4567", items: [{ flavour: "Belgian Chocolate", quantity: 1, unit_price: 15, line_total: 15 }], messages: [],
      },
    });
  });
  await toForm(page);
  await expect(page.getByText("Optional. We'll email your order details, invoice and updates.")).toBeVisible();

  await page.getByLabel(/^Email/).fill("not-an-email");
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(page.locator(".error-summary[role=alert]")).toContainText("Please check your email address");

  await page.getByLabel(/^Email/).fill("thandi@example.com");
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(page.getByText("thandi@example.com")).toBeVisible(); // shown on the review step
  await page.getByRole("button", { name: "Place Order" }).click();
  await expect(page.locator(".order-number")).toHaveText("KDP-0050");
  expect(sent).toMatchObject({ email: "thandi@example.com" });
});

test("ordering without an email still works", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/orders", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 422, json: { ok: false, errors: { collection_date: "closed" } } });
  });
  await toForm(page);
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: "Place Order" }).click();
  await expect.poll(() => sent).not.toBeNull();
  expect(sent).not.toHaveProperty("email");
});

const confirmedOrder = {
  order_number: "KDP-0050", order_status: "confirmed", payment_method: "cash", payment_status: "unpaid",
  payment_reference: "KDP-0050-AB2C", collection_date: "2026-10-26", revised_collection_date: null,
  collection_slot: "second_break", collection_place: "Mrs Felix's class, R129", is_large_order: false, quote_amount: null,
  total_units: 1, total_amount: 15, released: false, created_at: "2026-10-20T08:00:00Z", first_name: "Thandi",
  phone_masked: "******4567", items: [{ flavour: "Belgian Chocolate", quantity: 1, unit_price: 15, line_total: 15 }],
  messages: [], bank_details: null,
};

test("cancel link from the email asks first, then cancels [D-071]", async ({ page }) => {
  await page.route("**/api/orders/status", (route) => route.fulfill({ json: confirmedOrder }));
  let cancelled = false;
  await page.route("**/api/orders/cancel", async (route) => {
    cancelled = true;
    await route.fulfill({
      json: { ...confirmedOrder, order_status: "cancelled", messages: [{ template: "cancelled_by_customer", params: { order_number: "KDP-0050" }, created_at: new Date().toISOString() }] },
    });
  });
  await page.goto(`/order/KDP-0050?cancel=1#${TOKEN}`);
  await expect(page.getByText("Cancel order KDP-0050? This can't be undone.")).toBeVisible();
  await page.getByRole("button", { name: "Keep my order" }).click();
  expect(cancelled).toBe(false);

  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByText("You cancelled order KDP-0050. Nothing is owed.")).toBeVisible();
  expect(cancelled).toBe(true);
});

test("too late to cancel once baking: told to talk to Kaydee", async ({ page }) => {
  await page.route("**/api/orders/status", (route) => route.fulfill({ json: confirmedOrder }));
  await page.route("**/api/orders/cancel", (route) => route.fulfill({ status: 409, json: { error: "too_late" } }));
  await page.goto(`/order/KDP-0050?cancel=1#${TOKEN}`);
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Baking has started")).toBeVisible();
});

test("no cancel option once paid or baking", async ({ page }) => {
  await page.route("**/api/orders/status", (route) => route.fulfill({ json: { ...confirmedOrder, order_status: "baking" } }));
  await page.goto(`/order/KDP-0050#${TOKEN}`);
  await expect(page.getByText("Hi Thandi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
});
