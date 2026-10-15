// AI transparency NFR and REQ-22/24 evidence against the real Gemini model
// and the live FAQ (read only: nothing is written to conversations).
// Run: GEMINI_API_KEY=... npm run test:ai   -> docs/evidence/ai-transparency-<date>.md
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { handleQuestion, SIMILARITY_THRESHOLD, type ChatOutcome } from "@/lib/chat/engine";
import { CHAT_MODEL, EMBED_MODEL, geminiChatModel } from "@/lib/chat/gemini";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const IN_SCOPE: [string, string][] = [
  ["en", "How much are the cake pops?"],
  ["en", "What flavours do you have?"],
  ["en", "Where do I collect my order?"],
  ["en", "What time can I fetch my pops?"],
  ["en", "When must I order by?"],
  ["en", "Can I pay by EFT?"],
  ["en", "Do you take cash?"],
  ["af", "Hoeveel kos die koekpops?"],
  ["af", "Wat is op die spyskaart?"],
  ["xh", "Zingaphi ii-cake pops?"],
];
const OUT_OF_SCOPE: string[] = [
  "Do the cake pops contain nuts?",
  "Is there gluten in them?",
  "Are they halaal?",
  "Can I get a discount if I buy 50?",
  "Can I pay next month instead?",
  "Do you deliver to my house?",
  "Can you bake a birthday cake for Saturday?",
  "Do you sell cupcakes or cinnamon rolls this week?",
  "Is Kaydee available on weekends?",
  "What is the capital of France?",
];

describe.skipIf(!process.env.GEMINI_API_KEY || !url)("BakeBot with the real model [AI transparency NFR]", () => {
  it("answers approved topics, refuses to invent the rest, within 5 s", { timeout: 180_000 }, async () => {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: menu } = await supabase.rpc("get_menu");
    const { data: options } = await supabase.rpc("get_order_options");
    const menuText = (menu ?? []).map((i: { flavour: string; unit_price: number }) => `${i.flavour} R${Number(i.unit_price)}`).join(", ");
    const deps = {
      model: geminiChatModel(),
      matchFaq: async (embedding: number[], language: string) => {
        const { data, error } = await supabase.rpc("match_faq", { p_embedding: JSON.stringify(embedding), p_language: language, p_limit: 3 });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
      fill: (a: string) => a.replaceAll("{menu}", menuText).replaceAll("{place}", options?.collection_place ?? "school"),
    };

    const rows: { group: string; question: string; outcome: ChatOutcome; ms: number }[] = [];
    for (const [language, question] of IN_SCOPE) {
      const t = Date.now();
      rows.push({ group: "approved topic", question, outcome: await handleQuestion(question, language, deps), ms: Date.now() - t });
    }
    for (const question of OUT_OF_SCOPE) {
      const t = Date.now();
      rows.push({ group: "out of scope", question, outcome: await handleQuestion(question, "en", deps), ms: Date.now() - t });
    }

    const show = (o: ChatOutcome) =>
      o.kind === "answer" ? o.text.replace(/\|/g, "/") : o.kind === "fallback" ? `FALLBACK (${o.reason})` : o.kind === "human" ? "handed to Kaydee" : "\"I'll check with Kaydee\"";
    const date = new Date().toISOString().slice(0, 10);
    const outOfScope = rows.filter((r) => r.group === "out of scope");
    const notInvented = outOfScope.filter((r) => r.outcome.kind !== "answer").length;
    const answered = rows.filter((r) => r.group === "approved topic" && r.outcome.kind === "answer").length;
    const slowest = Math.max(...rows.map((r) => r.ms));
    const report = [
      `# AI transparency test (${date})`,
      "",
      `Model: \`${CHAT_MODEL}\`, embeddings: \`${EMBED_MODEL}\` (768). Live FAQ, read only. Similarity threshold ${SIMILARITY_THRESHOLD}, timeout 5,000 ms.`,
      "",
      `- Out-of-scope questions not answered with invented information: **${notInvented}/10** (target 10/10)`,
      `- Approved-topic questions answered: **${answered}/${IN_SCOPE.length}**`,
      `- Slowest reply: **${slowest} ms** (limit 5,000 ms; slower replies fall back to the order form)`,
      "",
      "| Group | Question | BakeBot's reply | ms |",
      "|---|---|---|---|",
      ...rows.map((r) => `| ${r.group} | ${r.question} | ${show(r.outcome)} | ${r.ms} |`),
      "",
      "Out-of-scope answers marked as answered (if any) must be reviewed by hand: they may only repeat approved information.",
      "",
    ].join("\n");
    writeFileSync(`docs/evidence/ai-transparency-${date}.md`, report);
    console.log(report);

    expect(notInvented).toBe(10);
    expect(answered).toBeGreaterThanOrEqual(8);
  });
});
