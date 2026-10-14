# KD Pops BakeBot MVI — Build Specification for Claude Code

> **Source of truth:** IFS 317 Group Assignment Part 1 SRS (Group 19, UWC, 2026).
> This file turns that SRS into build instructions. Every feature you build must trace back to a
> requirement ID (`REQ-xx`), an NFR, or an OVS step listed here. If something in this file conflicts
> with the SRS, stop and ask — do not silently pick one.

---

## 0. How to work on this project

1. **Read this whole file before writing any code.** Then propose a short plan per milestone (Section 9) and wait for approval before starting each milestone.
2. **Traceability is the marking criterion.** Every commit message, PR, migration and test names the IDs it covers, e.g. `feat(orders): idempotent order insert [REQ-08, REQ-09]`.
3. Keep `docs/TRACEABILITY.md` up to date: one row per REQ/NFR → file(s) → test(s) → status.
4. Record every decision or deviation from the SRS in `docs/DECISIONS.md` (date, what, why, which REQ). Section 8 lists known gaps you must resolve there.
5. Never put secrets in client code or commit `.env*` files. Server-only keys must never be prefixed `NEXT_PUBLIC_`.
6. Work in small vertical slices; each slice ends with passing tests.
7. Use South African English in all UI copy and docs. All times are **Africa/Johannesburg (SAST, UTC+2, no DST)**.

---

## 1. Environment status and first steps

- A GitHub repo exists, connected to **Vercel** and **Supabase**.
- **The Supabase project is paused due to inactivity.** Before anything else:
  1. A team member must restore it from the Supabase dashboard (project page → *Restore project*). Restoring takes a few minutes. If the project can no longer be restored, create a new project in the **closest region to South Africa** and update the Vercel env vars.
  2. After restore, check the Vercel ↔ Supabase integration still has valid env vars (Vercel → Project → Settings → Environment Variables).
  3. **Prevent future pausing:** the free plan pauses inactive projects. Add a lightweight `/api/health` route that runs a trivial DB query, and point the UptimeRobot 5-minute ping (already required by the availability NFR) at it.
- Claude Code: do not attempt to restore the project yourself — ask the user to confirm it is active, then verify by running a connection check.

### First-session checklist for Claude Code
- [ ] Inspect the repo: framework, package manager, existing files. Report what's there.
- [ ] Confirm Supabase is active (`supabase` CLI linked, or a query via the client).
- [ ] Set up the Supabase CLI locally with migrations in `supabase/migrations/` (all schema changes go through migrations — no dashboard edits).
- [ ] Create `.env.example` (Section 6) and `docs/TRACEABILITY.md`, `docs/DECISIONS.md`.

---

## 2. Business context (why this exists)

**KD Pops** is a home-based micro-enterprise run by **Kaydee Felix**, a high school learner, selling cake pops (plus cupcakes and cinnamon rolls on market days) to learners and teachers at her school. ~100–200 units in a normal week, ~300 in a school-market week. Her family bakes on weekends; stock is sold at first and second break from her mother's classroom.

**Current pain:** orders live in a notes app, a diary, a family WhatsApp group and on paper. Orders lost their names on retyping (school-market mix-up), checking who has paid is her most-dreaded task, and admin takes 4–5 hours a week on top of school.

**Root cause (POV insight — the design must serve this):** because every customer is a classmate or teacher, asking for money feels like a threat to the relationship. She won't act "like a debt collector", so she absorbs losses. **The system's core job is to be the neutral voice that asks for payment** (payment references, reminders, release of unpaid stock) **while Kaydee stays the friendly face and keeps the trust decision** (she approves every order).

**Design principles that follow from this:**
- The AI never makes trust, discount or credit decisions. Those stay with Kaydee.
- The AI answers only from owner-approved data; when unsure it hands over to Kaydee.
- Messages about money come from "BakeBot / KD Pops", polite and factual, never from Kaydee personally.
- Low data, unreliable power and Wi-Fi, low-end Android phones, and an owner who is in class all day.

---

## 3. Target architecture (EA summary)

| Layer | Components |
|---|---|
| **Business** | Order intake (OVS 1–7), owner approval (8–9), batch & production (10–11), payment tracking (12), collection & feedback (13–15). Rules: consent before PII · look up phone before insert · reject empty name · weekly cap → waitlist · >30 units → manual quote · 2 failed answers → human · unpaid on last school day → release. |
| **Application** | Customer ordering **PWA** (Next.js on Vercel): consent, order form, BakeBot chat, order status, EN/isiXhosa/AF toggle, offline draft queue. **API routes:** `/api/orders`, `/api/chat`, `/api/payments` (+ cron/admin routes). **Owner dashboard** behind Supabase Auth. **Gemini API** (Flash model, 5 s timeout). **WhatsApp Business Cloud API** templates (ack, confirm, reminder, handover) with in-app status link fallback. |
| **Data** | Supabase PostgreSQL relational schema (Section 5), `faq_knowledge` with pgvector `vector(768)` + HNSW (cosine), private Storage buckets (proof of payment, invoice PDFs, 15-min signed URLs), RLS on every table. |
| **Technology** | Vercel serverless + CDN (TLS 1.2+, HSTS, env secrets); Supabase (Postgres, Auth, Storage, AES-256 at rest, daily backups); **pg_cron** (+ pg_net) scheduler; Google AI, Meta WhatsApp Cloud, UptimeRobot. Clients: low-end Android phones, prepaid data, ≤500 KB per order journey. |

**Data flows (must be visible in code structure):**
1. Customer submits order or chat message (HTTPS, JSON) → API.
2. API looks up customer by phone, then inserts/updates rows.
3. API retrieves top-3 owner-approved FAQ answers (vector search).
4. Prompt + retrieved context → Gemini; answer back in ≤5 s.
5. Acknowledgement, confirmation and reminder messages sent.
6. Pending orders → owner; approve / decline / mark paid back.
- (F) Gemini timeout or error → plain order form.
- Device offline → draft saved on phone and resent up to 3 times.

**Stack:** Next.js (App Router, TypeScript strict), Tailwind CSS (keep bundle small — no heavy component libraries), `@supabase/supabase-js` + `@supabase/ssr`, Google Gen AI SDK (`@google/genai`), Zod for validation, a service worker for offline (e.g. Serwist), IndexedDB for drafts (e.g. `idb-keyval`), Vitest for unit tests, Playwright for E2E, k6 for load tests.
> Check current docs for exact model names and package versions before installing — do not rely on memory.

---

## 4. Functional requirements (build all of these)

Format: *The System shall …* — keep the REQ IDs exactly.

| ID | Module | Requirement | EA layer | OVS |
|---|---|---|---|---|
| REQ-01 | Consent | Store the POPIA consent record and consent-wording version when a customer accepts the consent notice. | Data | 2 |
| REQ-02 | Customer lookup | Retrieve the existing customer record by phone number when a customer submits contact details. | Data | 4 |
| REQ-03 | Customer lookup | Create a new customer record when no existing record matches the phone number. | Data | 4 |
| REQ-04 | Order capture | Capture name, phone, flavours, quantity per flavour, collection week and payment method when a customer submits a pre-order. | Application | 5 |
| REQ-05 | Order validation | Reject the submission when name, phone, item quantity or payment method is empty (show what is missing, save nothing). | Application | 6 |
| REQ-06 | Capacity control | Add the order to the waitlist when it would take the week's total units above the owner's weekly cap. | Business | 6 |
| REQ-07 | Large orders | Route the order to the owner for a manual quote when quantity exceeds 30 units. | Business | 6, 8 |
| REQ-08 | Order capture | Assign a unique order number (e.g. `KDP-0042`) when a pre-order passes validation. | Data | 7 |
| REQ-09 | Reliability | Discard the duplicate submission when a retried request carries an order ID that already exists. | Technology | 7 |
| REQ-10 | Notifications | Send an order acknowledgement to the customer when a pre-order is saved ("received – Kaydee will confirm after school"). | Application | 7 |
| REQ-11 | Notifications | Send a daily order summary to the owner at 15:00 when at least one order is pending. | Application | 7–8 |
| REQ-12 | Order approval | Send a confirmation with collection day, place and amount when the owner approves. | Business | 9 |
| REQ-13 | Order approval | Send a polite decline message when the owner declines (status → cancelled). | Business | 8 |
| REQ-14 | Payment tracking | Generate a unique payment reference and invoice when the owner approves. | Data | 9 |
| REQ-15 | Payment tracking | Store the proof-of-payment file in the private storage bucket when uploaded against an order number. | Data | 12 |
| REQ-16 | Payment tracking | Send a payment reminder when an approved EFT order is still unpaid 3 days before collection. | Application | 12 |
| REQ-17 | Payment tracking | Update payment status to `paid` when the owner or helper marks it received. | Data | 12 |
| REQ-18 | Batch planning | Generate a per-flavour batch summary at the Thursday 20:00 pre-order cut-off. | Business | 10 |
| REQ-19 | Batch planning | Send a revised collection date to affected customers when the owner marks a batch delayed (load shedding). | Business | 11 |
| REQ-20 | Order management | Flag the order for release to general sale when unpaid or uncollected on the last school day of the week; tell the customer. | Business | 14 |
| REQ-21 | AI assistant | Display an automated-assistant disclosure when a customer opens a new chat session. | Application | 2 |
| REQ-22 | AI assistant (FAQ) | Display the owner-approved answer when asked about pricing, discounts or allergens. | Application | 6 |
| REQ-23 | Human handover | Transfer the conversation to the owner when the customer asks for a human or a query is unresolved after 2 attempts. | Application | 6 |
| REQ-24 | Fallback | Switch the customer to the plain order form when Gemini does not respond within 5 s. | Technology | 6 |
| REQ-25 | Offline support | Resubmit the saved order draft up to 3 times when the device reconnects. | Technology | 1, 7 |
| REQ-26 | Feedback | Send a feedback request when order status changes to `collected` (taste, size, price; photos for large orders; the day after collection). | Business | 15 |
| REQ-27 | Data retention | Anonymise the customer's personal information 90 days after their last completed order. | Data | — |

### Order lifecycle (state machine — enforce in DB, not just UI)
- `order_status`: `pending → confirmed → baking → ready → collected`; `pending | confirmed → cancelled`. (See Section 8 for `waitlisted`.)
- `payment_status`: `unpaid → pending_review → paid` (cash: `unpaid → paid` at handover).
- Enforce allowed transitions with a Postgres trigger that raises on an illegal transition. Unit-test every transition.

### Customer flow (max 6 steps on a low-end Android phone)
1. Open link → 2. BakeBot disclosure + POPIA consent + "Are you under 18?" (guardian consent if yes) → 3. Name, phone, language → 4. Choose items, quantities, collection week, cash/EFT → 5. Review & submit → 6. Acknowledgement with order number and status link.
- No consent → store nothing; show Kaydee's WhatsApp number instead.
- Under 18 without guardian consent → block before any personal data is saved.
- "Talk to Kaydee" is visible on every chat screen.

### Owner dashboard (Kaydee + helper)
- Approval queue (approve / decline / enter quote and discount for large orders).
- Paid/unpaid list with proof-of-payment viewer (signed URL, 15 min) and "mark paid".
- Batch summary (per-flavour totals for the week), "mark batch delayed" with new date.
- Weekly cap setting per week (default ~200, market week ~300).
- Product/flavour availability toggles; FAQ answer editor (re-embeds on save).
- Handover inbox (escalated conversations with full history).
- Feedback view and weekly conversation review (sample of AI chats).
- Mother/helper account: read orders, update payments only.

---

## 5. Data schema (implement as migrations)

All tables: RLS enabled. UUID PKs generated server-side (`gen_random_uuid()`), except `orders.order_id`, which is **generated on the client** as the idempotency key and validated as a UUID server-side.

### customers
| Field | Type | PII | Handling |
|---|---|---|---|
| customer_id | uuid PK | No | Never exposed in URLs |
| full_name | text NOT NULL | Yes | Masked on customer screens; anonymised at 90 days |
| phone_number | text UNIQUE NOT NULL (E.164, `+27…`) | Yes | Normalise to +27 before lookup; mask to last 4 digits outside owner dashboard |
| customer_type | enum learner/teacher/other | No | Aggregate planning only |
| preferred_language | enum en/xh/af | No | Drives UI + messages |
| consent_given | boolean NOT NULL | Compliance | Must be TRUE before any PII write (CHECK constraint) |
| consent_timestamp | timestamptz | Compliance | |
| consent_version | text | Compliance | Version of wording shown |
| is_minor | boolean | Yes (children) | If TRUE, guardian_consent must be TRUE (CHECK) |
| guardian_consent | boolean | Compliance | |
| last_order_at | timestamptz | No | Drives 90-day anonymisation |

### products
`product_id` uuid PK · `product_name` text · `flavour` text · `unit_price` numeric(8,2) (server-side source of truth) · `is_available` boolean. Seed with the real KD Pops catalogue — **ask the user for actual products, flavours and prices; use clearly marked placeholders until then.**

### orders
`order_id` uuid PK · `order_number` text UNIQUE (`KDP-0001` from a sequence) · `customer_id` uuid FK · `order_status` enum · `payment_method` enum cash/eft · `payment_reference` text UNIQUE (set on approval) · `collection_date` date · `special_notes` text CHECK ≤280 chars (PII, anonymised) · `created_at` timestamptz · `is_large_order` boolean (TRUE when total qty > 30) · `quote_amount` numeric(8,2) nullable.

### order_items
`item_id` uuid PK · `order_id` FK · `product_id` FK · `quantity` int CHECK > 0 · `unit_price_snapshot` numeric(8,2) (copied from products at insert, server-side).

### payments
`payment_id` uuid PK · `order_id` FK UNIQUE (one per order) · `amount` numeric(8,2) (computed server-side from order_items or quote_amount; never from the browser) · `payment_status` enum · `proof_of_payment_url` text (private bucket path) · `marked_paid_by` text/uuid · `paid_at` timestamptz.

### invoices
`invoice_id` uuid PK · `invoice_number` text UNIQUE (= the order's payment_reference) · `order_id` FK · `issued_at` timestamptz · `total_amount` numeric(8,2) · `pdf_url` text (private bucket; replaced with anonymised copy on anonymisation).

### weekly_capacity
`week_start` date PK (Monday) · `unit_cap` int.

### feedback
`feedback_id` uuid PK · `order_id` FK · `rating` int CHECK 1–5 · `comment` text ≤500 chars (PII, anonymised).

### conversations
`conversation_id` uuid PK · `customer_id` FK nullable · `messages` jsonb · `escalated` boolean · `created_at` timestamptz. Owner-read only. Deleted after 30 days.

### faq_knowledge
`faq_id` uuid PK · `question` text · `approved_answer` text · `category` (pricing/discounts/allergens/other) · `embedding vector(768)` with HNSW index, `vector_cosine_ops`. Contains no customer data.

### Extensions to enable
`pgcrypto` (if needed), `vector`, `pg_cron`, `pg_net`.

---

## 6. Environment variables (`.env.example`)

```
# Public (safe in browser)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_OWNER_WHATSAPP=+27XXXXXXXXX

# Server only — never NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_CHAT_MODEL=        # current Flash model; check Google docs
GEMINI_EMBED_MODEL=       # embedding model; request outputDimensionality=768
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ENABLED=false    # true only after Meta business verification
CRON_SECRET=              # shared secret for pg_net → /api/cron/* calls
EFT_BANK_DETAILS=         # shown on confirmations for EFT orders
```

---

## 7. Detailed behaviour by area

### 7.1 Orders API (`POST /api/orders`) — REQ-02 to REQ-10
1. Zod-validate body; reject with field-level errors if name, phone, ≥1 item with qty, or payment method missing (REQ-05). Nothing is written on rejection.
2. Check consent fields present and valid (REQ-01; under-18 rule).
3. Normalise phone to E.164 `+27`. Look up customer by phone (REQ-02); create if absent (REQ-03); update `last_order_at`.
4. Re-price every item from `products` (ignore any client price); reject unavailable flavours.
5. Sum this week's units (pending + confirmed + later states, excluding cancelled) + new units vs `weekly_capacity.unit_cap` → waitlist if over (REQ-06).
6. Total qty > 30 → `is_large_order = true`, routed to owner for quote (REQ-07).
7. Insert order with the **client-supplied `order_id`** using `ON CONFLICT (order_id) DO NOTHING`; if it already existed, return the existing order's number unchanged (REQ-09). Do steps 3–7 in **one transaction** (use a Postgres function called via RPC).
8. Assign `order_number` (REQ-08), respond with order number and status link; queue the acknowledgement (REQ-10).
9. **Target: p95 ≤ 2,000 ms.**

### 7.2 Owner approval — REQ-12 to REQ-14
- Approve → status `confirmed`, generate unique `payment_reference` (e.g. `KDP-0042-7F3K`), create `payments` (unpaid) and `invoices` row + PDF, send confirmation with collection day, place, amount; for EFT include bank details and reference.
- Decline → `cancelled`, send polite decline.
- Large order → owner enters `quote_amount` (with discount) before approving.
- Approval actions available in batches; UI optimised for a phone at break time.

### 7.3 Payments — REQ-15 to REQ-17
- `POST /api/payments/proof`: customer uploads image/PDF (limit ~5 MB; compress images client-side) against order number + access token. Check reference matches an approved, unpaid order; else flag to Kaydee. Store in private bucket; set `pending_review`.
- Owner/helper "mark paid" → `paid`, `paid_at`, `marked_paid_by`.
- Cash orders marked paid at handover.

### 7.4 AI assistant (`POST /api/chat`) — REQ-21 to REQ-24
- First message always: BakeBot disclosure ("I'm BakeBot, KD Pops' automated assistant…") in the chosen language (REQ-21).
- Embed the question → top-3 `faq_knowledge` by cosine similarity. If best similarity < threshold (tune, start ~0.75) → reply "I'll check with Kaydee" and count an unresolved attempt.
- Prompt Gemini with **only** the retrieved approved answers and product/price data; instruct it to answer from that context or say it will check with Kaydee. Never invent prices, discounts or allergen info (REQ-22).
- When Gemini returns structured order data, request JSON output and **validate against the products table** before use — the LLM is never the source of truth for an order.
- 2 unresolved attempts, or customer asks for a person / taps "Talk to Kaydee" → `escalated = true`, appears in handover inbox with history, customer told when to expect a reply (REQ-23).
- Wrap the Gemini call in an `AbortController` with a **5,000 ms** timeout; on timeout or error, return a `fallback` flag and the client switches to the plain order form (REQ-24).
- Log 100% of conversations (for weekly owner review).
- Stream nothing large; keep responses short to save data.

### 7.5 Notifications service
- Single `notify(customerId, template, params)` function with providers: `whatsapp` (Cloud API templates, enabled only when `WHATSAPP_ENABLED=true`) and `in_app` (status page message, always on).
- **WhatsApp approval from Meta is still pending**, so the in-app status link is the working channel for the MVI. Code the WhatsApp provider fully, behind the flag.
- Templates: acknowledgement, confirmation, decline, payment reminder, delay notice, release notice, feedback request, owner daily summary, owner batch summary. All in en / xh / af.
- Every send logged with status; failed sends retried up to 3 times with exponential back-off.
- Owner gets **one batched daily summary**, not a notification per message.

### 7.6 Scheduled jobs (pg_cron, UTC times = SAST − 2 h)
| Job | SAST | Cron (UTC) | Action | REQ |
|---|---|---|---|---|
| Daily owner summary | 15:00 daily | `0 13 * * *` | If ≥1 pending order, send summary | REQ-11 |
| Pre-order cut-off + batch plan | Thu 20:00 | `0 18 * * 4` | Per-flavour totals to Kaydee + family | REQ-18 |
| Payment reminders | 07:00 daily | `0 5 * * *` | Approved EFT orders unpaid, collection in 3 days | REQ-16 |
| Last-day release | Fri 14:00 (configurable) | `0 12 * * 5` | Flag unpaid/uncollected, notify customer | REQ-20 |
| Feedback requests | 16:00 daily | `0 14 * * *` | Orders collected yesterday | REQ-26 |
| Proof-of-payment deletion | 02:00 daily | `0 0 * * *` | Delete proofs 30 days after paid_at | NFR Security |
| PII anonymisation | 02:15 daily | `15 0 * * *` | 90 days since last completed order | REQ-27 |
| Conversation deletion | 02:30 daily | `30 0 * * *` | Conversations older than 30 days | 3.4 |

- Jobs that send messages or touch Storage call a Vercel route via `pg_net` (`POST /api/cron/<job>` with `CRON_SECRET` header). Pure SQL jobs (anonymisation of table fields, conversation deletion) run in SQL.
- Storage files are deleted through the Storage API, not by deleting rows from `storage.objects`.
- Every job writes a row to a job log table (needed as NFR evidence).

### 7.7 Offline / low data — REQ-25, NFR offline
- Service worker caches the app shell and menu; whole order journey **≤ 500 KB** transferred.
- Order drafts stored in IndexedDB with a client-generated UUID `order_id`.
- On `online` event: resubmit up to 3 times with back-off (e.g. 2 s, 4 s, 8 s); same `order_id` every time so the server de-duplicates.
- Owner order list cached for offline viewing on her phone.

### 7.8 Security & POPIA
- **RLS on every table.** Recommended model: `anon` has **no direct table access**; all customer reads/writes go through API routes or `SECURITY DEFINER` RPC functions that check a per-order **access token** (from the status link; store only its hash). Owner role: all tables, update order/payment status. Helper role: read orders, update payments only. Roles via a `staff_roles` table keyed by `auth.uid()`.
- Required test: using the public anon key, reading another customer's order **must fail**.
- Mask phone numbers to `******1234` everywhere except the owner dashboard.
- HTTPS only, HSTS header (`next.config` headers), TLS 1.2+.
- Proofs and invoices in **private** buckets; signed URLs expire after 15 minutes.
- Collect the minimum: name, phone, language. No ID numbers, addresses or marketing profiles. Learner data never used for marketing.
- Anonymisation routine replaces `full_name`, `phone_number`, `special_notes`, feedback `comment` with tokens, regenerates anonymised invoice PDF, keeps invoice totals (financial records, 5 years). Same routine runs immediately on a deletion request (owner-triggered button).
- Breach-response steps go in `docs/SECURITY.md` (rotate keys, revoke tokens, assess via logs, notify Information Regulator and affected customers, incident register).

### 7.9 Accessibility & language
- WCAG 2.1 AA contrast, touch targets ≥ 44 px, Lighthouse accessibility ≥ 90.
- All UI strings in a dictionary (`/messages/en.json`, `xh.json`, `af.json`). **Do not ship machine-generated isiXhosa or Afrikaans as final** — generate drafts, mark them `NEEDS_REVIEW`, and list them for the team to have a fluent speaker check.

---

## 8. Known gaps in the SRS — resolve and record in `docs/DECISIONS.md`

These are not fully specified in Part 1. Implement the suggested resolution unless the user says otherwise, and log each one so the group can update the SRS.

1. **Waitlist status** — REQ-06 needs it, but the `order_status` enum has no `waitlisted`. → Add `waitlisted` (transitions: `waitlisted → pending | cancelled`).
2. **Release-to-sale flag** (REQ-20) has no field. → Add `orders.released_at timestamptz`.
3. **Delayed batch** (REQ-19) has no field. → Add `orders.revised_collection_date date` (and/or a `batches` table).
4. **Customer access token** ("single-use link token" in 3.4) has no field. → Add `orders.access_token_hash text`.
5. **Notification and error logs** are referenced but not in the dictionary. → Add `notifications` (no message body PII beyond what's needed; included in retention sweep) and `job_runs` / `error_log` tables.
6. **Staff roles** (owner vs helper) not modelled. → Add `staff_roles(user_id, role)`.
7. **"Last school day"** assumed to be Friday; make it configurable for public holidays.
8. **SRS 3.4 says customers insert via the anon key**; this spec recommends API-only access for the anon role (simpler, safer, still passes the RLS test). Record which you implement so the group can align the SRS wording.

---

## 9. Milestones (maps to DVS D1–D9)

Each milestone ends with: tests passing, `TRACEABILITY.md` updated, a short summary to the user.

| # | DVS | Deliverable | Covers |
|---|---|---|---|
| M0 | D1 | Repo audit, Supabase reconnected, CLI + migrations set up, docs skeleton, CI (lint, typecheck, tests on push) | — |
| M1 | D2 | Full schema migration, enums + transition trigger, RLS policies, seed data, RLS test with anon key | REQ-01–03, 08, 09, 27 (schema), Security NFR |
| M2 | D3 | Customer PWA: consent + under-18 gate, order form, language toggle, status page, offline drafts + retry | REQ-04, 05, 21, 25; Usability, Offline NFRs |
| M3 | D3/D4 | `/api/orders` transactional RPC: lookup, validation, cap, large orders, idempotency | REQ-02–09 |
| M4 | D4 | `/api/chat`: FAQ embeddings, vector search, Gemini with 5 s fallback, handover | REQ-21–24; AI Transparency NFR |
| M5 | D6 | Owner + helper dashboard behind Supabase Auth | REQ-07, 12–15, 17, 19, 23 |
| M6 | D5 | Notification service (in-app + WhatsApp behind flag), pg_cron + pg_net jobs | REQ-10, 11, 16, 18, 20, 26, 27 |
| M7 | D7 | Test suite + evidence (Section 10) → `docs/TEST_REPORT.md` | All NFRs |
| M8 | D8 | Production deploy flow (Vercel preview → prod; migrations to staging first), one-page user guide for Kaydee and her mother (`docs/USER_GUIDE.md`) | All |
| M9 | D9 | UptimeRobot on `/api/health`, error log view, weekly conversation review screen | Availability NFR |

---

## 10. Verification — tests that produce marking evidence

Write results to `docs/TEST_REPORT.md` with dates, numbers and screenshots/exports.

| NFR / REQ | Target | Test |
|---|---|---|
| Availability | 99.5% monthly uptime | UptimeRobot 5-min pings on `/api/health`, 30-day export; monthly maintenance-window drill (Sun 02:00–04:00 SAST) showing fallback notice |
| Latency | Order API p95 ≤ 2,000 ms; Gemini ≤ 5,000 ms | Script: 50 consecutive submissions, log p50/p95; forced Gemini timeout in staging → fallback fires |
| Page weight | ≤ 500 KB, interactive ≤ 5 s on slow network | Lighthouse mobile (throttled) + Network panel bytes for a full order journey |
| Concurrency | 20 concurrent conversations, 60 msg/min, 10 min | k6 against staging: error rate < 1%, p95 < 2,000 ms (mock Gemini to avoid quota costs, and say so in the report) |
| Offline | Draft syncs once, no duplicate | Playwright offline mode: submit offline, reconnect, assert exactly one order |
| Security | Anon can't read others' orders; TLS A grade | RLS test with anon key; SSL Labs scan; pg_cron logs for deletion/anonymisation; under-18 without guardian consent blocked before any write; phone masking check |
| Accessibility | Lighthouse ≥ 90; 6 steps; 5/5 users unaided | Lighthouse; task test with 5 users (team runs this, Claude Code prepares the script/checklist) |
| AI transparency | 100% disclosure; 10/10 out-of-scope questions not invented | Scripted test of 10 out-of-FAQ questions; audit 20 logged conversations |
| Idempotency | Retries never duplicate | Unit/integration test sending the same `order_id` 3 times |
| State machine | Illegal transitions rejected | Unit test every allowed and disallowed transition |

Acceptance test with Kaydee (she agreed to a test session) — prepare a scripted checklist in `docs/ACCEPTANCE_TEST.md`.

---

## 11. Out of scope for the MVI
- Card payments / payment gateway (EFT + cash only).
- Automated trust, credit or discount decisions (always Kaydee).
- Marketing messages of any kind.
- Native mobile apps (PWA only).
