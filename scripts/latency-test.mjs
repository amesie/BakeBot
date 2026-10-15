// Latency NFR evidence (spec 10): 50 consecutive order submissions to the
// order API; reports p50 / p95 / max. Uses one test customer so the orders
// can be removed afterwards (see docs/TEST_REPORT.md for the cleanup SQL).
//   node scripts/latency-test.mjs https://bake-bot-phi.vercel.app
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "https://bake-bot-phi.vercel.app";
const N = Number(process.argv[3] ?? 50);

const menu = await (await fetch(`${base}/`)).text(); // warm up (and the page cache)
const funfetti = menu.match(/"product_id":"([0-9a-f-]{36})","product_name":"Cake pop","flavour":"Funfetti"/)?.[1];
const options = await (await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_order_options`, {
  method: "POST",
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
  body: "{}",
})).json();
const menuRows = await (await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_menu`, {
  method: "POST",
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
  body: "{}",
})).json();
const productId = funfetti ?? menuRows.find((m) => m.flavour === "Funfetti").product_id;
const date = options.collection_dates.at(-1); // furthest open day: away from real orders

const token = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
const times = [];
const statuses = {};
for (let i = 0; i < N; i++) {
  const body = {
    order_id: crypto.randomUUID(),
    access_token: token(),
    full_name: "Latency Test (delete)",
    phone: "082 000 0999",
    language: "en",
    consent_given: true,
    consent_version: "latency-test",
    is_minor: false,
    items: [{ product_id: productId, quantity: 1 }],
    collection_date: date,
    collection_slot: "after_school",
    payment_method: "cash",
  };
  const t = performance.now();
  const r = await fetch(`${base}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await r.text();
  times.push(performance.now() - t);
  statuses[r.status] = (statuses[r.status] ?? 0) + 1;
}

const sorted = [...times].sort((a, b) => a - b);
const pct = (p) => Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
const date10 = new Date().toISOString().slice(0, 10);
const report = [
  `# Order API latency (${date10})`,
  "",
  `${N} consecutive \`POST ${base}/api/orders\` from a home connection in South Africa. Vercel function region dub1, Supabase eu-west-1.`,
  "",
  `| p50 | p95 | max | min | HTTP statuses |`,
  `|---|---|---|---|---|`,
  `| ${pct(50)} ms | **${pct(95)} ms** | ${Math.round(sorted.at(-1))} ms | ${Math.round(sorted[0])} ms | ${Object.entries(statuses).map(([s, n]) => `${s}: ${n}`).join(", ")} |`,
  "",
  `Target: p95 <= 2,000 ms. ${pct(95) <= 2000 ? "**Met.**" : "**Not met.**"}`,
  "",
  "All times in order: " + times.map((t) => Math.round(t)).join(", "),
  "",
].join("\n");
writeFileSync(`docs/evidence/latency-orders-${date10}.md`, report);
console.log(report);
