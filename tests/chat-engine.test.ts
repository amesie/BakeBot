// REQ-22 to REQ-24 and the AI transparency NFR, with a fake model.
import { describe, expect, it } from "vitest";
import { handleQuestion, onlyKnownAmounts, wantsHuman, type ChatDeps, type ChatModel, type FaqMatch } from "@/lib/chat/engine";

const prices: FaqMatch = { question: "How much?", approved_answer: "Here is the menu: {menu}.", similarity: 0.9 };

function deps(over: Partial<ChatDeps> & { matches?: FaqMatch[]; reply?: { answer: string; resolved: boolean }; delayMs?: number } = {}): ChatDeps {
  const model: ChatModel = {
    embedQuestion: async () => new Array(768).fill(0.1),
    answer: async ({ signal }) => {
      if (over.delayMs) await new Promise((r, reject) => {
        const t = setTimeout(r, over.delayMs);
        signal.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); });
      });
      return over.reply ?? { answer: "Belgian Chocolate is R15 and Funfetti is R10.", resolved: true };
    },
  };
  return {
    model,
    matchFaq: async () => over.matches ?? [prices],
    fill: (a) => a.replace("{menu}", "Belgian Chocolate R15, Funfetti R10"),
    timeoutMs: 200,
    ...over,
  };
}

describe("BakeBot answers only from approved answers [REQ-22]", () => {
  it("answers when an approved answer matches", async () => {
    const out = await handleQuestion("How much is a Belgian pop?", "en", deps());
    expect(out).toEqual({ kind: "answer", text: "Belgian Chocolate is R15 and Funfetti is R10." });
  });

  it("says it will check with Kaydee when nothing approved is close enough", async () => {
    const out = await handleQuestion("Do you deliver to Cape Town?", "en", deps({ matches: [{ ...prices, similarity: 0.4 }] }));
    expect(out.kind).toBe("unresolved");
  });

  it("treats the model's own 'not in context' as unresolved", async () => {
    const out = await handleQuestion("Are they vegan?", "en", deps({ reply: { answer: "", resolved: false } }));
    expect(out.kind).toBe("unresolved");
  });

  it("never passes on a price that is not in the approved context", async () => {
    const out = await handleQuestion("Discount for 50?", "en", deps({ reply: { answer: "You get them for R8 each!", resolved: true } }));
    expect(out.kind).toBe("unresolved");
    expect(onlyKnownAmounts("R15 and R10", ["Belgian Chocolate R15, Funfetti R10"])).toBe(true);
    expect(onlyKnownAmounts("only R8", ["Belgian Chocolate R15"])).toBe(false);
  });
});

describe("handover [REQ-23]", () => {
  it.each(["Can I talk to Kaydee?", "I want a real person", "Kan ek met iemand praat?", "Ndifuna ukuthetha nomntu"])(
    "%s -> human",
    async (q) => {
      expect(wantsHuman(q)).toBe(true);
      expect((await handleQuestion(q, "en", deps())).kind).toBe("human");
    },
  );
});

describe("fallback to the order form [REQ-24]", () => {
  it("falls back when the model is slower than the limit", async () => {
    const started = Date.now();
    const out = await handleQuestion("How much?", "en", deps({ delayMs: 5000 }));
    expect(out).toEqual({ kind: "fallback", reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(1000); // stopped at the 200 ms test limit
  });

  it("falls back on a model error", async () => {
    const broken = deps();
    broken.model!.embedQuestion = async () => { throw new Error("quota"); };
    expect(await handleQuestion("How much?", "en", broken)).toEqual({ kind: "fallback", reason: "error" });
  });

  it("falls back when no API key is configured", async () => {
    expect(await handleQuestion("How much?", "en", deps({ model: null }))).toEqual({ kind: "fallback", reason: "no_model" });
  });

  it("uses 5 seconds by default", async () => {
    const { TIMEOUT_MS } = await import("@/lib/chat/engine");
    expect(TIMEOUT_MS).toBe(5000);
  });
});
