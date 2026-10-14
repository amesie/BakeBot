// Phase 2 smoke test: the public page renders the live menu, the language
// toggle switches copy, and every control meets the 44px touch-target rule.
import { expect, test } from "@playwright/test";

test("shows the menu from the database with prices", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".menu-card");
  await expect(cards).toHaveCount(4);
  await expect(page.locator(".menu-card h3")).toContainText(["Belgian Chocolate", "Cookies and Cream", "Top Deck", "Funfetti"]);
  await expect(cards.first()).toContainText("R15");
});

test("language toggle switches copy and html lang [spec 7.9]", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "AF", exact: true }).click();
  await expect(page.locator("#menu-title")).toHaveText("Die Spyskaart");
  await expect(page.locator("html")).toHaveAttribute("lang", "af");

  await page.reload(); // choice persists
  await expect(page.locator("#menu-title")).toHaveText("Die Spyskaart");
});

test("interactive controls are at least 44px tall [Accessibility NFR]", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  const small = await page.locator("a:visible, button:visible").evaluateAll((els) =>
    els
      .filter((el) => !el.classList.contains("skip-link") && !el.classList.contains("wordmark"))
      .map((el) => ({ text: el.textContent?.trim(), h: el.getBoundingClientRect().height }))
      .filter((r) => r.h > 0 && r.h < 40),
  );
  expect(small).toEqual([]);
});
