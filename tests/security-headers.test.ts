// Security NFR: every route is served with HSTS and basic hardening headers.
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("security headers [Security NFR]", () => {
  it("applies HSTS with a long max-age to every route", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*");
    const hsts = all?.headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toMatch(/max-age=(\d+)/);
    expect(Number(hsts!.value.match(/max-age=(\d+)/)![1])).toBeGreaterThanOrEqual(31536000);
  });

  it("blocks framing and MIME sniffing", async () => {
    const rules = await nextConfig.headers!();
    const keys = rules[0].headers.map((h) => h.key);
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
  });
});
