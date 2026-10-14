// Order flow E2E (spec section 4 customer flow, REQ-01, REQ-05, REQ-10, REQ-25).
// /api/orders is replaced by an in-browser fake so the tests never write to
// the live database; database behaviour is covered by supabase/tests/03_place_order.sql.
import { expect, test, type Page } from "@playwright/test";

type Body = Record<string, unknown> & { order_id: string; items: { product_id: string; quantity: number }[] };

/** Fake API that behaves like place_order(): one order per order_id. */
async function fakeOrdersApi(page: Page) {
  const received: string[] = [];
  const created = new Map<string, string>();
  await page.route("**/api/orders", async (route) => {
    const body = route.request().postDataJSON() as Body;
    received.push(body.order_id);
    const duplicate = created.has(body.order_id);
    if (!duplicate) created.set(body.order_id, `KDP-${String(42 + created.size).padStart(4, "0")}`);
    const units = body.items.reduce((sum, item) => sum + item.quantity, 0);
    await route.fulfill({
      status: duplicate ? 200 : 201,
      json: {
        ok: true,
        duplicate,
        order_number: created.get(body.order_id),
        order_status: "pending",
        payment_method: body.payment_method,
        payment_status: "unpaid",
        payment_reference: null,
        collection_date: body.collection_date,
        revised_collection_date: null,
        collection_slot: body.collection_slot,
        collection_place: null,
        is_large_order: units > 30,
        quote_amount: null,
        total_units: units,
        total_amount: units * 15,
        released: false,
        created_at: new Date().toISOString(),
        first_name: String(body.full_name).split(" ")[0],
        phone_masked: "******4567",
        items: [{ flavour: "Belgian Chocolate", quantity: units, unit_price: 15, line_total: units * 15 }],
        messages: [],
      },
    });
  });
  return { received, created };
}

async function openOrder(page: Page) {
  await page.goto("/#order");
  await expect(page.getByRole("heading", { name: "Before you order" })).toBeVisible();
}

async function giveConsent(page: Page) {
  await page.getByLabel("I agree to KD Pops using my details for my order").check();
  await page.getByLabel("No", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillDetails(page: Page) {
  await page.getByLabel("Full name").fill("Thandi Test");
  await page.getByLabel("Cell number").fill("082 123 4567");
}

test("consent gate: nothing proceeds without consent; under-18 needs a guardian [REQ-01]", async ({ page }) => {
  await openOrder(page);
  const proceed = page.getByRole("button", { name: "Continue" });
  await expect(proceed).toBeDisabled();

  await page.getByLabel("I agree to KD Pops using my details for my order").check();
  await expect(proceed).toBeDisabled(); // age not answered yet

  await page.getByLabel("Yes", { exact: true }).check();
  await expect(proceed).toBeDisabled(); // under 18, no guardian consent
  await page.getByLabel("My parent or guardian says it's OK for me to order").check();
  await expect(proceed).toBeEnabled();

  await page.getByRole("button", { name: "I don't agree" }).click();
  await expect(page.getByText("Nothing has been saved")).toBeVisible();
});

test("missing details are listed and nothing is sent [REQ-05]", async ({ page }) => {
  const api = await fakeOrdersApi(page);
  await openOrder(page);
  await giveConsent(page);
  await page.getByRole("button", { name: "Review order" }).click();

  const summary = page.locator(".error-summary[role=alert]");
  await expect(summary).toContainText("Full name: Required");
  await expect(summary).toContainText("Cell number: Required");

  await page.getByLabel("Full name").fill("Thandi");
  await page.getByLabel("Cell number").fill("12345");
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(page.locator(".error-summary[role=alert]")).toContainText("South African cell number");
  expect(api.received).toHaveLength(0);
});

test("happy path: menu button, review, order number and status link [REQ-04, REQ-10]", async ({ page }) => {
  const api = await fakeOrdersApi(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Add Funfetti to your order" }).click();
  await giveConsent(page);

  await expect(page.locator(".flavour-row select").first()).toHaveValue(/.+/);
  await expect(page.locator(".summary-card")).toContainText("Funfetti");
  await fillDetails(page);
  await page.getByRole("button", { name: "Review order" }).click();

  await expect(page.getByRole("heading", { name: "Check your order" })).toBeVisible();
  await page.getByRole("button", { name: "Place Order" }).click();

  await expect(page.getByRole("heading", { name: "Thank you! Your order is in." })).toBeVisible();
  await expect(page.locator(".order-number")).toHaveText("KDP-0042");
  await expect(page.getByText("Kaydee will confirm after school")).toBeVisible();
  const link = page.getByRole("link", { name: "View order status" });
  await expect(link).toHaveAttribute("href", /^\/order\/KDP-0042#[A-Za-z0-9_-]{43}$/);
  expect(api.received).toHaveLength(1);
});

test("offline: draft is kept, sent on reconnect, exactly one order [REQ-25, REQ-09]", async ({ page, context }) => {
  test.slow(); // the first retry waits 2 seconds
  const api = await fakeOrdersApi(page);
  await openOrder(page);
  await giveConsent(page);
  await fillDetails(page);
  await page.getByRole("button", { name: "Review order" }).click();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Place Order" }).click();
  await expect(page.getByRole("heading", { name: "Saved on your phone" })).toBeVisible();
  expect(api.received).toHaveLength(0);

  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "Thank you! Your order is in." })).toBeVisible({ timeout: 20_000 });

  expect(new Set(api.received).size).toBe(1); // one order id, never a second order
  expect(api.created.size).toBe(1);
});

test("status page without the token shows not found", async ({ page }) => {
  await page.goto("/order/KDP-0001");
  await expect(page.getByText("We couldn't find that order")).toBeVisible();
});

test("floating Order Now bar never covers the order form", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await expect(page.locator(".mobile-order-bar")).toBeVisible();
  await page.locator("#order").scrollIntoViewIfNeeded();
  await expect(page.locator(".mobile-order-bar")).toHaveCount(0);
});
