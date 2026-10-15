# KD Pops BakeBot

Online ordering, payment tracking and an AI assistant for **KD Pops**, a home-based cake pop business run by a high school learner. Built for IFS 317 (Group 19, UWC, 2026) from the SRS in `CLAUDE.md`.

**Live:** https://bake-bot-phi.vercel.app · **Dashboard:** `/dashboard`

## What it does

- **Customers** (phone-first, English, isiXhosa, Afrikaans): menu, POPIA consent and under-18 check, order form with live total, private status page, proof-of-payment upload, invoice PDF, feedback, works offline (orders wait on the phone and are sent once back online).
- **BakeBot**: answers only from answers Kaydee approved; hands over to Kaydee; falls back to the order form if slow.
- **Kaydee's dashboard**: approve or decline (quotes for big orders), payments, bake list, ready and delay messages, one-tap WhatsApp messages, inbox, FAQ editor, feedback, settings, system status. Her mother has a helper account for payments and collection.
- **Automatic jobs**: daily summary, Thursday bake list, payment reminders, Friday release of unpaid orders, feedback requests, deletion and anonymisation for POPIA.

## Stack

Next.js 16 (App Router, TypeScript strict) on Vercel · Tailwind CSS · Supabase (Postgres with RLS, Auth, Storage, pg_cron, pg_net, pgvector) · Google Gemini (`gemini-3.1-flash-lite`, `gemini-embedding-001`) · Zod · Vitest · Playwright.

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm test` | Static checks and unit tests (also run by CI) |
| `npm run test:db` | Database tests against the linked Supabase project (rolled back) |
| `npm run test:integration` | Public-key access checks over HTTP |
| `npm run build && npm run test:e2e` | Browser tests (Playwright, mobile and desktop) |
| `GEMINI_API_KEY=… npm run test:ai` | Live AI transparency test (read only) |
| `npm run test:latency` / `npm run test:load` | Latency and load tests (see `docs/TEST_REPORT.md`) |

## Documents

| File | For |
|---|---|
| `CLAUDE.md` | Build specification (from the SRS) |
| `docs/TRACEABILITY.md` | Every REQ and NFR → files → tests → status |
| `docs/DECISIONS.md` | Every decision and deviation from the SRS |
| `docs/TEST_REPORT.md` | Test results and evidence (`docs/evidence/`) |
| `docs/USER_GUIDE.md` | One-page guide for Kaydee and her helper |
| `docs/DEPLOYMENT.md` | Releasing, rolling back, secrets |
| `docs/MONITORING.md` | UptimeRobot, drills, System tab |
| `docs/SECURITY.md` | POPIA data map, controls, breach response |
| `docs/TRANSLATIONS.md` | isiXhosa and Afrikaans strings awaiting review |
| `docs/USER_TEST_SCRIPT.md`, `docs/ACCEPTANCE_TEST.md` | Usability test and acceptance session |
