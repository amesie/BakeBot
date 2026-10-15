// Staff sign-in paths (Phase 4). Real staff logins are tested by hand with
// Kaydee's account; these cover the routing that protects the dashboard.
import { expect, test } from "@playwright/test";

test("dashboard sends signed-out visitors to the login page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test("invite links that land on the home page are finished at /auth/callback", async ({ page }) => {
  // Shape of the first invites Supabase sent (tokens in the fragment).
  await page.goto("/#access_token=not-a-real-token&refresh_token=nope&type=invite");
  await expect(page).toHaveURL(/\/auth\/callback$/);
  await expect(page.getByText("That link didn't work")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get a new link" })).toHaveAttribute("href", "/auth/forgot-password");
});

test("expired links explain how to get a new one", async ({ page }) => {
  await page.goto("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page).toHaveURL(/\/auth\/callback$/);
  await expect(page.getByText("Email link is invalid or has expired")).toBeVisible();
});

test("confirm route never redirects to another site", async ({ request }) => {
  const response = await request.get("/auth/confirm?token_hash=x&type=email&next=//evil.example", { maxRedirects: 0 });
  expect(response.headers()["location"] ?? "").not.toContain("evil.example");
});

test("order status links (token after #) are not mistaken for sign-in links", async ({ page }) => {
  await page.goto("/order/KDP-0001#" + "a".repeat(43));
  await expect(page).toHaveURL(/\/order\/KDP-0001/);
});
