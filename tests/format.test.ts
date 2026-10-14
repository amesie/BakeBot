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
