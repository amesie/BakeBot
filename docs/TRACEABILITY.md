# Traceability matrix

One row per requirement. Status: `todo`, `in progress`, `done`, `verified` (tested with evidence in `docs/TEST_REPORT.md`).

## Functional requirements

| ID | Requirement (short) | Milestone | Files | Tests | Status |
|---|---|---|---|---|---|
| REQ-01 | Store POPIA consent + wording version | M1, M2 | `supabase/migrations/20261015090000_order_capture.sql`, `components/order/order-section.tsx` (consent card) | `supabase/tests/03_place_order.sql`, `tests/orders.test.ts`, `e2e/order.spec.ts` | done |
| REQ-02 | Look up customer by phone | M1, M3 | `supabase/migrations/20261015090000_order_capture.sql` (upsert on phone), `lib/phone.ts` | `supabase/tests/03_place_order.sql`, `tests/orders.test.ts` | done |
| REQ-03 | Create customer if no match | M1, M3 | `supabase/migrations/20261015090000_order_capture.sql` | `supabase/tests/03_place_order.sql` | done |
| REQ-04 | Capture order details | M2, M3 | `components/order/order-section.tsx`, `app/api/orders/route.ts`, `supabase/migrations/20261015090000_order_capture.sql` | `supabase/tests/03_place_order.sql`, `e2e/order.spec.ts` | done |
| REQ-05 | Reject incomplete submissions | M2, M3 | `lib/orders/schema.ts`, `app/api/orders/route.ts`, `place_order()` | `supabase/tests/03_place_order.sql`, `tests/orders.test.ts`, `e2e/order.spec.ts` | done |
| REQ-06 | Waitlist above weekly cap | M3 | `supabase/migrations/20261015090000_order_capture.sql` (cap + advisory lock) | `supabase/tests/03_place_order.sql` | done |
| REQ-07 | >30 units to owner for quote | M3, M5 | `supabase/migrations/20261015120000_owner_actions.sql` (`approve_order` needs a quote), `components/dashboard/panels.tsx` | `03_place_order.sql`, `supabase/tests/04_owner_actions.sql` | done |
| REQ-08 | Unique order number | M1, M3 | order number trigger, returned by `place_order()` | `01_...sql`, `supabase/tests/03_place_order.sql` | done |
| REQ-09 | Discard duplicate order ID | M1, M3 | client order id + token (`lib/orders/identity.ts`), `place_order()` duplicate path | `supabase/tests/03_place_order.sql` (3 sends, 1 order), `e2e/order.spec.ts` (offline) | done |
| REQ-10 | Order acknowledgement | M6 | `place_order()` in-app notification, done card, status page | `supabase/tests/03_place_order.sql`, `e2e/order.spec.ts` | done (WhatsApp in M6) |
| REQ-11 | 15:00 owner summary | M6 | | | todo |
| REQ-12 | Confirmation on approval | M5 | `supabase/migrations/20261015120000_owner_actions.sql` (`approve_order`, confirmation_cash/eft), status page | `supabase/tests/04_owner_actions.sql` | done (WhatsApp in M6) |
| REQ-13 | Decline message | M5 | `supabase/migrations/20261015120000_owner_actions.sql` (`decline_order`) | `supabase/tests/04_owner_actions.sql` | done |
| REQ-14 | Payment reference + invoice | M5 | reference + invoice row (`20261015120000_owner_actions.sql`), `lib/invoice-pdf.ts`, `app/api/orders/invoice`, `app/dashboard/invoice/[orderId]`, `get_invoice()` in `supabase/migrations/20261016090000_payment_proofs.sql` | `04_owner_actions.sql`, `supabase/tests/06_payment_proofs.sql`, `tests/invoice-pdf.test.ts`, `e2e/payments.spec.ts` | done |
| REQ-15 | Proof of payment to private bucket | M5 | `supabase/migrations/20261016090000_payment_proofs.sql`, `app/api/payments/proof/route.ts`, status page upload, `app/dashboard/proof/[orderId]` | `supabase/tests/06_payment_proofs.sql`, `e2e/payments.spec.ts` | done (deletion after 30 days in M6) |
| REQ-16 | EFT payment reminder | M6 | | | todo |
| REQ-17 | Mark paid | M5 | `supabase/migrations/20261015120000_owner_actions.sql` (`mark_paid`), Payments tab | `supabase/tests/04_owner_actions.sql`, `02_rls.sql` | done |
| REQ-18 | Thursday batch summary | M6 | | | todo |
| REQ-19 | Revised date on delayed batch | M5 | `supabase/migrations/20261015120000_owner_actions.sql` (`delay_batch`), Batch tab | `supabase/tests/04_owner_actions.sql` | done |
| REQ-20 | Release unpaid/uncollected | M6 | `orders.released_at`, `ready -> cancelled` rule, `school_day_overrides` | `01_...sql` | schema done |
| REQ-21 | AI disclosure | M2, M4 | | | todo |
| REQ-22 | Owner-approved FAQ answers | M4 | | | todo |
| REQ-23 | Human handover | M4, M5 | | | todo |
| REQ-24 | Gemini 5 s fallback | M4 | | | todo |
| REQ-25 | Offline draft resubmit x3 | M2 | `lib/orders/client.ts`, `lib/orders/retry.ts`, `components/order/order-section.tsx` | `tests/orders.test.ts` (3 tries, 2/4/8 s), `e2e/order.spec.ts` (offline, exactly one order) | done |
| REQ-26 | Feedback request | M6 | | | todo |
| REQ-27 | Anonymise after 90 days | M1, M6 | `customers.anonymised_at`, `last_order_at` |  | schema done |

## Non-functional requirements

| NFR | Target | Milestone | Files | Tests | Status |
|---|---|---|---|---|---|
| Availability | 99.5% monthly, `/api/health` + UptimeRobot | M1, M9 | `app/api/health/route.ts`, `public.health_check()` | `tests/rls-anon.test.ts` (health_check responds) | in progress (UptimeRobot in M9) |
| Latency | Order API p95 <= 2,000 ms; Gemini <= 5,000 ms | M3, M4 | `app/api/orders/route.ts` (Server-Timing header) | 50-submission script in M7 | in progress |
| Page weight | <= 500 KB per order journey | M2 | self-hosted fonts, inline SVG art | 300 KB transferred for home page to review step (2026-10-15, local build); re-measure on Vercel with Lighthouse in M7 | in progress |
| Concurrency | 20 conversations, 60 msg/min | M7 | | | todo |
| Offline | Draft syncs once, no duplicate; app opens offline | M2 | `public/sw.js`, `components/service-worker.tsx`, `lib/orders/client.ts` | `e2e/offline.spec.ts` (opens offline), `e2e/order.spec.ts` (offline order, exactly one) | done |
| Security | RLS, HSTS, private buckets, masking | M0, M1 | `next.config.ts` (HSTS), `proxy.ts`, `supabase/migrations/*_rls.sql`, `*_public_api.sql` | `tests/security-headers.test.ts`, `supabase/tests/02_rls.sql`, `tests/rls-anon.test.ts` | in progress (buckets, masking later) |
| Accessibility | Lighthouse >= 90, 44 px targets | M2 | `app/globals.css` (D-021) | `e2e/home.spec.ts` (44 px check, mobile + desktop) | in progress (Lighthouse in M7) |
| AI transparency | 100% disclosure; no invented answers | M4 | | | todo |

## Design system and language (Phase 2)

| Item | Files | Tests | Status |
|---|---|---|---|
| Figma design ported (D-004, D-021) | `app/globals.css`, `components/kd/*`, `components/site/*` | `e2e/home.spec.ts` | done |
| Live menu from products table (REQ-04, D-022) | `lib/menu.ts`, `components/site/menu-grid.tsx` | `e2e/home.spec.ts` (4 cards, prices) | done |
| EN / XH / AF dictionaries + toggle (spec 7.9) | `messages/*.json`, `lib/i18n`, `components/i18n-provider.tsx` | `tests/i18n.test.ts`, `e2e/home.spec.ts` | done (XH/AF need review) |

## Engineering (M0 / D1)

| Item | Files | Status |
|---|---|---|
| CI: lint, typecheck, tests | `.github/workflows/ci.yml` | done |
| Supabase CLI + migrations folder | `supabase/config.toml`, `supabase/migrations/` | done (remote link pending) |
| Env template | `.env.example` | done |

## State machines (spec section 4)

| Rule | Files | Tests | Status |
|---|---|---|---|
| Order status transitions enforced in DB | `supabase/migrations/*_order_rules.sql` | `supabase/tests/01_state_machine_and_constraints.sql` (all 42 pairs + release case) | done |
| Payment status transitions enforced in DB | `supabase/migrations/*_order_rules.sql` | same file (all 6 pairs) | verified 2026-10-14 |

## How to run the tests

- `npm test`: unit tests (CI runs these).
- `npm run test:db`: database tests against the linked Supabase project (rolled back).
- `npm run test:integration`: HTTP check with the real publishable key (needs `.env.local`).
- `npm run build && npm run test:e2e`: browser tests (Playwright) on mobile and desktop. Order tests use a fake API (D-034).
