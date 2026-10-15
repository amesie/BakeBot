// D-069: emailed proofs are matched by the reference in the subject.
import { describe, expect, it } from "vitest";
import { findReference, pickAttachment } from "@/lib/email/proof-email";

describe("findReference", () => {
  it.each([
    ["KDP-0042-7F3K", "KDP-0042-7F3K"],
    ["Re: kdp-0042-7f3k", "KDP-0042-7F3K"],
    ["Fwd: payment for KDP-0042-7F3K thanks", "KDP-0042-7F3K"],
    ["Proof KDP-12345-AB2C", "KDP-12345-AB2C"],
    ["KDP-0042", null], // order number alone is not enough
    ["KDP-0042-7F0K", null], // 0 is never used in references
    ["payment", null],
    ["", null],
  ])("%s -> %s", (subject, expected) => {
    expect(findReference(subject)).toBe(expected);
  });
});

describe("pickAttachment", () => {
  const msg = (...children: object[]) => ({ type: "multipart/mixed", childNodes: [{ part: "1", type: "text/plain", size: 20 }, ...children] });

  it("takes the first image or PDF", () => {
    expect(pickAttachment(msg({ part: "2", type: "image/png", size: 200_000 }, { part: "3", type: "application/pdf", size: 9 }))).toEqual({
      part: "2", type: "image/png", extension: "png", size: 200_000,
    });
  });

  it("finds screenshots nested in multipart/related", () => {
    const nested = { type: "multipart/related", childNodes: [{ part: "1.1", type: "text/html" }, { part: "1.2", type: "image/jpeg", size: 50_000 }] };
    expect(pickAttachment({ type: "multipart/mixed", childNodes: [nested] })).toMatchObject({ part: "1.2", extension: "jpg" });
  });

  it("explains why nothing fits", () => {
    expect(pickAttachment(msg())).toEqual({ reason: "no_attachment" });
    expect(pickAttachment(msg({ part: "2", type: "image/heic", size: 100 }))).toEqual({ reason: "unsupported" });
    expect(pickAttachment(msg({ part: "2", type: "application/pdf", size: 40_000_000 }))).toEqual({ reason: "too_large" });
  });
});
