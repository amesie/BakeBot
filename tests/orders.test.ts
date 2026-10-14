import { describe, expect, it } from "vitest";
import { maskPhone, normaliseZaPhone } from "@/lib/phone";
import { CONSENT_VERSION, validateOrder } from "@/lib/orders/schema";
import { newOrderIdentity, statusPath } from "@/lib/orders/identity";
import { retryWithBackoff } from "@/lib/orders/retry";

describe("normaliseZaPhone (mirrors the database)", () => {
  it.each([
    ["0821234567", "+27821234567"],
    ["082 123 4567", "+27821234567"],
    ["+27 82 123 4567", "+27821234567"],
    ["27821234567", "+27821234567"],
    ["082123", null],
    ["+44 20 7946 0958", null],
  ])("%s gives %s", (input, expected) => {
    expect(normaliseZaPhone(input)).toBe(expected);
  });

  it("masks to the last 4 digits", () => {
    expect(maskPhone("+27608733053")).toBe("******3053");
  });
});

const valid = () => ({
  ...newOrderIdentity(),
  full_name: "Thandi",
  phone: "082 123 4567",
  language: "en",
  consent_given: true,
  consent_version: CONSENT_VERSION,
  is_minor: false,
  items: [{ product_id: crypto.randomUUID(), quantity: 2 }],
  collection_date: "2026-10-19",
  collection_slot: "second_break",
  payment_method: "cash",
});

describe("validateOrder [REQ-05]", () => {
  it("accepts a complete order", () => {
    expect(validateOrder(valid()).ok).toBe(true);
  });

  it("names every missing required field", () => {
    const result = validateOrder({
      ...newOrderIdentity(),
      consent_given: true,
      consent_version: CONSENT_VERSION,
      is_minor: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toMatchObject({
        full_name: "required",
        phone: "required",
        items: "required",
        payment_method: "required",
        collection_date: "required",
        collection_slot: "required",
      });
    }
  });

  it("rejects a blank name and a bad phone number", () => {
    const result = validateOrder({ ...valid(), full_name: "   ", phone: "12345" });
    expect(result.ok ? null : result.errors).toMatchObject({ full_name: "required", phone: "invalid" });
  });

  it("rejects zero quantity and empty item lists", () => {
    expect(validateOrder({ ...valid(), items: [] }).ok).toBe(false);
    expect(validateOrder({ ...valid(), items: [{ product_id: crypto.randomUUID(), quantity: 0 }] }).ok).toBe(false);
  });

  it("requires consent [REQ-01] and guardian consent for under-18s", () => {
    expect(validateOrder({ ...valid(), consent_given: false }).ok).toBe(false);
    const minor = validateOrder({ ...valid(), is_minor: true });
    expect(minor.ok ? null : minor.errors).toMatchObject({ guardian_consent: "required" });
    expect(validateOrder({ ...valid(), is_minor: true, guardian_consent: true }).ok).toBe(true);
  });

  it("limits notes to 280 characters", () => {
    const result = validateOrder({ ...valid(), special_notes: "x".repeat(281) });
    expect(result.ok ? null : result.errors).toMatchObject({ special_notes: "too_long" });
  });
});

describe("newOrderIdentity [REQ-09]", () => {
  it("makes a UUID and a 43-character URL-safe token", () => {
    const id = newOrderIdentity();
    expect(id.order_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newOrderIdentity().access_token).not.toBe(id.access_token);
  });

  it("keeps the token out of the path (fragment only)", () => {
    expect(statusPath("KDP-0042", "abc")).toBe("/order/KDP-0042#abc");
  });
});

describe("retryWithBackoff [REQ-25]", () => {
  it("tries at most 3 times with 2 s, 4 s, 8 s waits", async () => {
    const waits: number[] = [];
    let calls = 0;
    const result = await retryWithBackoff(
      async () => {
        calls++;
        return { done: false };
      },
      undefined,
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(calls).toBe(3);
    expect(waits).toEqual([2000, 4000, 8000]);
    expect(result.value).toBeNull();
  });

  it("stops as soon as a send succeeds", async () => {
    let calls = 0;
    const result = await retryWithBackoff(
      async (n) => {
        calls++;
        return n === 2 ? { done: true, value: "KDP-0001" } : { done: false };
      },
      undefined,
      async () => {},
    );
    expect(calls).toBe(2);
    expect(result).toEqual({ value: "KDP-0001", attempts: 2 });
  });
});
