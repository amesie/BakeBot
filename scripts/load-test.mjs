// Concurrency NFR evidence (spec 10): 20 concurrent BakeBot conversations,
// 60 messages a minute in total, for 10 minutes. Run against a server started
// with BAKEBOT_FAKE_MODEL=1 (Gemini mocked, as the spec allows).
//   node scripts/load-test.mjs http://localhost:3100 600
// Messages contain "[load test]" so the conversations can be deleted after.
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const seconds = Number(process.argv[3] ?? 600);
const USERS = 20;
const PER_USER_INTERVAL_MS = 20_000; // 20 users x 3 per minute = 60 messages/minute
const QUESTIONS = ["How much are the pops?", "Where do I collect?", "Can I pay by EFT?", "Do you deliver?", "What flavours are there?"];

const token = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
const results = []; // { ms, ok, status }
const end = Date.now() + seconds * 1000;

async function send(session, body) {
  const t = performance.now();
  try {
    const r = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...session, language: "en", ...body }),
    });
    const json = await r.json();
    results.push({ ms: performance.now() - t, ok: r.ok && !json.error, status: r.status, fallback: !!json.fallback });
  } catch {
    results.push({ ms: performance.now() - t, ok: false, status: 0, fallback: false });
  }
}

async function user(n) {
  await new Promise((r) => setTimeout(r, (n * PER_USER_INTERVAL_MS) / USERS)); // spread the starts
  let session = { conversation_id: crypto.randomUUID(), token: token() };
  let asked = 0;
  await send(session, { action: "start" });
  while (Date.now() < end) {
    const next = Date.now() + PER_USER_INTERVAL_MS;
    if (asked === 10) {
      // a new visitor every 10 questions (chats are capped at 60 messages)
      session = { conversation_id: crypto.randomUUID(), token: token() };
      asked = 0;
      await send(session, { action: "start" });
    }
    await send(session, { action: "ask", text: `[load test] ${QUESTIONS[(n + asked) % QUESTIONS.length]}` });
    asked++;
    await new Promise((r) => setTimeout(r, Math.max(0, next - Date.now())));
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
const minutes = (Date.now() - started) / 60000;
const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
const errors = results.filter((r) => !r.ok).length;
const errorRate = (errors / results.length) * 100;
const date = new Date().toISOString().slice(0, 10);
const report = [
  `# BakeBot load test (${date})`,
  "",
  `${USERS} concurrent conversations, one message per user every ${PER_USER_INTERVAL_MS / 1000} s (60 messages/minute in total), ${minutes.toFixed(1)} minutes, against \`${base}\`.`,
  "Gemini was replaced by a fake model answering in 300-800 ms (BAKEBOT_FAKE_MODEL=1), as spec section 10 allows, to avoid quota costs. Database calls (FAQ search, conversation logging) were real (Supabase eu-west-1). The server ran on a laptop in South Africa, so network times to the database are higher than on Vercel (dub1).",
  "",
  `| Requests | Rate | Error rate | p50 | p95 | max | Fallbacks |`,
  `|---|---|---|---|---|---|---|`,
  `| ${results.length} | ${(results.length / minutes).toFixed(1)}/min | **${errorRate.toFixed(2)}%** | ${pct(50)} ms | **${pct(95)} ms** | ${Math.round(sorted.at(-1))} ms | ${results.filter((r) => r.fallback).length} |`,
  "",
  `Targets: error rate < 1% (${errorRate < 1 ? "met" : "NOT met"}), p95 < 2,000 ms (${pct(95) < 2000 ? "met" : "NOT met"}).`,
  "",
].join("\n");
writeFileSync(`docs/evidence/load-test-${date}.md`, report);
console.log(report);
