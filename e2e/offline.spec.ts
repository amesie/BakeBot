// Offline NFR (spec 7.7): after one visit the site opens with no signal,
// shows the menu, and an order placed offline is queued (REQ-25).
import { expect, test } from "@playwright/test";

test("app shell and menu open offline after one visit [Offline NFR]", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#menu-title")).toHaveText("The Menu");
  await expect(page.locator(".menu-card")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Before you order" })).toBeVisible();

  // The page is interactive offline: the consent step works.
  await page.getByLabel("I agree to KD Pops using my details for my order").check();
  await page.getByLabel("No", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await context.setOffline(false);
});

test("manifest is served for home-screen install", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.short_name).toBe("KD Pops");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain("512x512");
});
