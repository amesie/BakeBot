import { describe, expect, it } from "vitest";
import { formatRand } from "@/lib/format";
import { visualFor } from "@/lib/catalogue-visuals";

describe("formatRand", () => {
  it("drops cents for whole rands", () => {
    expect(formatRand(15)).toBe("R15");
    expect(formatRand("12.00")).toBe("R12");
  });
  it("keeps cents otherwise", () => {
    expect(formatRand(12.5)).toBe("R12.50");
  });
});

describe("visualFor", () => {
  it("matches the seeded flavours regardless of case", () => {
    expect(visualFor("Top Deck", 0).variant).toBe("swirl");
    expect(visualFor("cookies and cream", 0).variant).toBe("cookies");
  });
  it("falls back for new flavours", () => {
    expect(visualFor("Red Velvet", 1).variant).toBeDefined();
  });
});

import { formatDay, sastDate } from "@/lib/dates";
import { dictionaries } from "@/lib/i18n";

describe("dates", () => {
  it("formats a collection day in each language", () => {
    expect(formatDay("2026-10-19", dictionaries.en)).toBe("Monday 19 October");
    expect(formatDay("2026-10-19", dictionaries.af)).toBe("Maandag 19 Oktober");
  });
  it("uses the SAST calendar date for timestamps", () => {
    expect(sastDate("2026-10-18T22:30:00Z")).toBe("2026-10-19"); // 00:30 SAST
  });
});

import { matchesSearch } from "@/lib/dashboard/types";

describe("dashboard search", () => {
  it("matches any part of the name, ignoring case and accents", () => {
    expect(matchesSearch("Zoë Mokoena", "KDP-0042", "zoe")).toBe(true);
    expect(matchesSearch("Zoë Mokoena", "KDP-0042", "MOKO")).toBe(true);
    expect(matchesSearch("Zoë Mokoena", "KDP-0042", "thandi")).toBe(false);
  });
  it("matches order numbers and treats blank as everything", () => {
    expect(matchesSearch("Thandi", "KDP-0042", "0042")).toBe(true);
    expect(matchesSearch("Thandi", "KDP-0042", "  ")).toBe(true);
  });
});

import { readyWhatsAppLink } from "@/lib/dashboard/whatsapp";
import type { DashboardOrder } from "@/lib/dashboard/types";

describe("one-tap WhatsApp ready message", () => {
  const order = {
    order_number: "KDP-0042",
    collection_date: "2026-10-19",
    revised_collection_date: null,
    collection_slot: "second_break",
    customers: { full_name: "Thandi M", phone_number: "+27821234567", is_minor: false, preferred_language: "af" },
  } as unknown as DashboardOrder;

  it("opens a chat with the customer, message typed in their language", () => {
    const link = readyWhatsAppLink(order, "Mrs Felix's class, R129")!;
    expect(link.startsWith("https://wa.me/27821234567?text=")).toBe(true);
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(text).toBe("KD Pops: Bestelling KDP-0042 is gereed! Haal dit af op Maandag 19 Oktober, 2de pouse · 11:45–12:00, by Mrs Felix's class, R129.");
  });

  it("uses the new date when the batch was delayed", () => {
    const delayed = { ...order, revised_collection_date: "2026-10-26" } as DashboardOrder;
    expect(decodeURIComponent(readyWhatsAppLink(delayed, "R129")!)).toContain("26 Oktober");
  });
});
