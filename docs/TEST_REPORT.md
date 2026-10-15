# Test report: KD Pops BakeBot MVI

**System:** https://bake-bot-phi.vercel.app (Vercel, functions in `dub1`) with Supabase `eu-west-1`.
**Date of this report:** 2026-10-15. Times are SAST. Evidence files are in `docs/evidence/`.

## Summary against SRS section 10

| NFR / REQ | Target | Result | Evidence | Status |
|---|---|---|---|---|
| **Availability** | 99.5% monthly uptime | UptimeRobot monitor on `/api/health` to be set up (M9); 30-day export to be attached | `app/api/health/route.ts`; this report, section 9 | **Pending (needs 30 days of monitoring)** |
| **Latency: order API** | p95 ≤ 2,000 ms | **p95 277 ms**, p50 242 ms, max 770 ms, 50/50 succeeded | `evidence/latency-orders-2026-10-15.md` | **Met** |
| **Latency: Gemini** | ≤ 5,000 ms, fallback after | Slowest live answer **2,146 ms**; forced timeout falls back to the order form (unit + E2E) | `evidence/ai-transparency-2026-10-15.md`, `tests/chat-engine.test.ts`, `e2e/chat.spec.ts` | **Met** |
| **Page weight** | ≤ 500 KB; interactive ≤ 5 s on a slow network | **326 KB** (Lighthouse, home page); **300 KB** for the full journey to the review step; interactive **3.1 s** (mobile, slow 4G, 4× CPU) | `evidence/lighthouse-mobile.report.html` | **Met** |
| **Concurrency** | 20 conversations, 60 msg/min, 10 min; errors < 1%, p95 < 2,000 ms | 660 requests in 10.3 min, **0.00% errors**, **p95 1,738 ms** (Gemini mocked) | `evidence/load-test-2026-10-15.md` | **Met** |
| **Offline** | Draft syncs once, no duplicate | Offline order queued, sent on reconnect, exactly one order; site opens offline after one visit | `e2e/order.spec.ts`, `e2e/offline.spec.ts` | **Met** |
| **Security** | Anon cannot read others' orders; TLS A | Public key denied on all 15 tables over HTTP; 29 RLS checks; **SSL Labs A+ / A**, TLS 1.2-1.3 only; under-18 without guardian blocked before any write; phones masked | `tests/rls-anon.test.ts`, `supabase/tests/02_rls.sql`, `evidence/ssl-labs-2026-10-15.md` | **Met** |
| **Accessibility** | Lighthouse ≥ 90; ≤ 6 steps; 5/5 unaided | Lighthouse **100**; flow is 6 steps; all controls ≥ 44 px (E2E); user test to run | `evidence/lighthouse-mobile.report.html`, `e2e/home.spec.ts`, `USER_TEST_SCRIPT.md` | **Lighthouse met; user test pending** |
| **AI transparency** | 100% disclosure; 10/10 out-of-scope not invented | Disclosure is the first message of every chat; **10/10** out-of-scope questions not invented; 10/10 approved questions answered | `evidence/ai-transparency-2026-10-15.md`, `e2e/chat.spec.ts` | **Met** (audit of 20 real chats pending, section 7) |
| **Idempotency** | Retries never duplicate | Same order id sent 3 times gives one order; offline retry gives one order | `supabase/tests/03_place_order.sql`, `e2e/order.spec.ts` | **Met** |
| **State machine** | Illegal transitions rejected | All 42 order and 6 payment status pairs checked | `supabase/tests/01_state_machine_and_constraints.sql` | **Met** |

## Automated test suites (all passing on 2026-10-15)

| Suite | Command | Checks | Runs against |
|---|---|---|---|
| Database (pgTAP-style SQL, rolled back) | `npm run test:db` | **249** in 9 files | Live Supabase project |
| Unit (Vitest) | `npm test` | **53** | Local |
| Public-key access over HTTP | `npm run test:integration` | **18** | Live Supabase project |
| Browser (Playwright, mobile + desktop) | `npm run build && npm run test:e2e` | **49** | Local production build; order and chat APIs faked in the browser (D-034) |
| Live AI | `GEMINI_API_KEY=… npm run test:ai` | 20 questions | Live Gemini + live FAQ (read only) |
| CI on every push | GitHub Actions | lint, typecheck, unit tests | GitHub |

## 1. Latency: order API

50 consecutive real orders from a home connection in South Africa to the production API. All returned `201 Created`.

| p50 | p95 | max | min |
|---|---|---|---|
| 242 ms | **277 ms** | 770 ms (first, cold start) | 214 ms |

Before this test the functions ran in Washington DC (`iad1`) while the database is in Ireland; moving them to Dublin (`dub1`, D-065) cut the database round trip from about 500 ms to about 40 ms. The 50 test orders used one test customer and were deleted afterwards; the order-number counter was reset so real numbering continues at KDP-0003.

Script: `scripts/latency-test.mjs`.

## 2. AI: Gemini latency, fallback and transparency

Live test with `gemini-3.1-flash-lite` and `gemini-embedding-001` (768) against the live approved answers. Full table: `evidence/ai-transparency-2026-10-15.md`.

- 10/10 out-of-scope questions (allergens, halaal, discounts, credit, delivery, birthday cakes, cupcakes, Kaydee's weekends, general knowledge) were answered "I'll check with Kaydee" or handed over.
- 10/10 approved-topic questions (English, Afrikaans, isiXhosa) were answered from the approved text, with names, prices and places unchanged.
- Slowest reply 2,146 ms. Replies over 5,000 ms switch the customer to the order form (tested with a fake slow model: stops at the limit).

Tuning found during testing (D-064): the first model choice took 3-6 s and caused timeouts; the 0.75 similarity threshold rejected genuine questions. Both were changed and re-measured.

## 3. Page weight and accessibility (Lighthouse)

Lighthouse 13.5, mobile emulation, simulated slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown, production home page:

| Accessibility | Performance | Best practices | Transfer | FCP | LCP | Interactive | CLS |
|---|---|---|---|---|---|---|---|
| **100** | 91 | 100 | **326 KB** | 1.5 s | 2.4 s | **3.1 s** | 0 |

One advisory audit (`label-content-name-mismatch` on the "Add to order" buttons) was fixed after the run (D-066). Full report: `evidence/lighthouse-mobile.report.html`.

## 4. Concurrency (load test)

20 simulated customers chatting at the same time, one message each every 20 s (60 messages a minute), for 10.3 minutes. Gemini was replaced by a fake model that answers in 300-800 ms, as section 10 allows, so no quota was used; FAQ search and conversation logging used the real database.

| Requests | Rate | Error rate | p50 | p95 | max | Fallbacks to order form |
|---|---|---|---|---|---|---|
| 660 | 63.9/min | **0.00%** | 1,232 ms | **1,738 ms** | 20,741 ms | 7 (1.1%) |

Both targets met (errors < 1%, p95 < 2,000 ms). Notes for honesty:

- The test server ran on a laptop in South Africa (`next start`) talking to the database in Ireland, so each database call took longer than from Vercel in Dublin; production should be faster. k6 was not installed, so an equivalent Node script was used (`scripts/load-test.mjs`, D-067).
- One request took 20.7 s (a single outlier, most likely a slow database connection from the laptop) and 7 messages passed the 5-second limit and correctly switched to the order form.
- The 60 test conversations (marked "[load test]") were deleted after the run.

## 5. Offline

- `e2e/order.spec.ts`: phone set offline, order placed → "Saved on your phone"; back online → order sent once; the fake API saw exactly one order id.
- `e2e/offline.spec.ts`: after one visit the service worker serves the home page, menu and order form with no network.
- Retry policy (3 tries at 2, 4, 8 s) unit-tested in `tests/orders.test.ts`.

## 6. Security

- Public (anon) key cannot read any of the 15 tables or insert orders, over HTTP (`tests/rls-anon.test.ts`) and in SQL (`supabase/tests/02_rls.sql`).
- Helper cannot approve, change amounts, read chats or grant roles; non-staff accounts see nothing (`02_rls.sql`, `04_owner_actions.sql`).
- Proof-of-payment storage: uploads only to token-granted paths, staff-only viewing, 15-minute signed links, deletion only of due files (`06_payment_proofs.sql`, `08_scheduled_jobs.sql`); live check: unauthorised upload refused with "new row violates row-level security policy".
- Under-18 without guardian consent is refused before anything is saved (`03_place_order.sql`, `tests/orders.test.ts`, `e2e/order.spec.ts`).
- Phone numbers masked as `******1234` on customer pages and for the helper (`03_place_order.sql`, dashboard D-044).
- TLS: SSL Labs **A+ / A**, TLS 1.2 and 1.3 only, HSTS two years (`evidence/ssl-labs-2026-10-15.md`).
- Scheduled deletion and anonymisation jobs log every run in `job_runs` (`08_scheduled_jobs.sql`); live run of the proof-deletion chain returned `200 {"due":0,"deleted":0}`.

## 7. Still to do (needs people or time)

| Item | How | Who |
|---|---|---|
| 30-day uptime export | UptimeRobot monitor on `https://bake-bot-phi.vercel.app/api/health` every 5 minutes; export after 30 days | Team (M9 instructions) |
| Maintenance-window drill | Sunday 02:00-04:00 SAST: pause the database or set the site to maintenance; record that customers see the fallback notice | Team |
| 5-user usability test | `docs/USER_TEST_SCRIPT.md` | Team |
| Audit of 20 real conversations | Dashboard → Inbox → "This week's chats" once real customers have used BakeBot; record any answer not in the approved text | Team with Kaydee |
| Acceptance test with Kaydee | `docs/ACCEPTANCE_TEST.md` | Team with Kaydee |
