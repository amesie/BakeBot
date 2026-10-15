// BakeBot chat (REQ-21 to REQ-24) with a fake /api/chat, so no Gemini quota
// or live conversations are used. Engine logic: tests/chat-engine.test.ts.
import { expect, test, type Page } from "@playwright/test";

async function fakeChat(page: Page, replies: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const key = body.action === "ask" ? `ask:${body.text}` : body.action;
    await route.fulfill({ json: replies[key] ?? { reply: "ok" } });
  });
  return calls;
}

async function openChat(page: Page, isMobile: boolean) {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Ask BakeBot" }).first().click();
}

test("disclosure first, Talk to Kaydee always visible, answers shown [REQ-21, REQ-22]", async ({ page, isMobile }) => {
  const calls = await fakeChat(page, { "ask:How much?": { reply: "Belgian Chocolate is R15." } });
  await openChat(page, isMobile);
  const chat = page.getByRole("dialog", { name: "BakeBot" });
  await expect(chat.locator(".chat-line").first()).toContainText("I'm BakeBot, KD Pops' automated assistant (not a person)");
  await expect(chat.getByRole("button", { name: "Talk to Kaydee" })).toBeVisible();

  await chat.getByLabel("Type your question").fill("How much?");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("Belgian Chocolate is R15.")).toBeVisible();
  await expect(chat.getByRole("button", { name: "Talk to Kaydee" })).toBeVisible();
  expect(calls.map((c) => c.action)).toEqual(["start", "ask"]);
  expect(calls[0].token).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test("Talk to Kaydee hands over and asks for a number [REQ-23]", async ({ page, isMobile }) => {
  const calls = await fakeChat(page, {
    human: { reply: "I've passed your question to Kaydee.", escalated: true, needs_contact: true },
    contact: { reply: "Thank you! Kaydee will reply on WhatsApp after school." },
  });
  await openChat(page, isMobile);
  const chat = page.getByRole("dialog", { name: "BakeBot" });
  await chat.getByRole("button", { name: "Talk to Kaydee" }).click();
  await expect(chat.getByText("I've passed your question to Kaydee.")).toBeVisible();
  await chat.getByLabel("Your name").fill("Thandi");
  await chat.getByLabel("Cell number").fill("082 123 4567");
  await chat.getByRole("button", { name: "Send to Kaydee" }).click();
  await expect(chat.getByText("Kaydee will reply on WhatsApp after school")).toBeVisible();
  expect(calls.at(-1)).toMatchObject({ action: "contact", name: "Thandi", phone: "082 123 4567" });
});

test("when BakeBot cannot answer in time, the customer is sent to the order form [REQ-24]", async ({ page, isMobile }) => {
  await fakeChat(page, { "ask:Hello?": { reply: "BakeBot can't answer right now, so here's the order form.", fallback: true } });
  await openChat(page, isMobile);
  const chat = page.getByRole("dialog", { name: "BakeBot" });
  await chat.getByLabel("Type your question").fill("Hello?");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("dialog", { name: "BakeBot" })).toHaveCount(0);
  await expect(page.locator(".chat-toast")).toContainText("here's the order form");
  await expect(page.getByRole("heading", { name: "Before you order" })).toBeInViewport();
});

test("chat API refuses malformed requests", async ({ request }) => {
  const response = await request.post("/api/chat", { data: { action: "ask", text: "hi" } });
  expect(response.status()).toBe(422);
});
