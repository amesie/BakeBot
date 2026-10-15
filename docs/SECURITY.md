# Security and POPIA (spec 7.8)

## What personal information KD Pops holds, and where

| Data | Where | Who can see it | Kept for |
|---|---|---|---|
| Name, cell number, language, consent record, under-18 flag | `customers` | Kaydee (full); helper (name, masked number) | Until 90 days after the last finished order, then anonymised (REQ-27) |
| Orders, items, totals | `orders`, `order_items`, `payments`, `invoices` | Kaydee; helper (read) | Order notes removed on anonymisation; totals kept 5 years (financial records) |
| Proof-of-payment files | Private bucket `payment-proofs` | Kaydee and helper, via 15-minute links | Deleted 30 days after payment |
| Emailed proofs (sender address, message) | Gmail inbox thebakebot@gmail.com | Whoever holds the Gmail login | Matched emails moved to Bin (emptied after 30 days); unmatched ones kept under "BakeBot/Unmatched" until Kaydee deletes them. Sender addresses are not copied into the database |
| BakeBot chats (and any number left for a reply) | `conversations` | Kaydee | Deleted after 30 days |
| Messages to customers | `notifications` (template names and order numbers only) | Kaydee | Deleted on anonymisation |
| Error log | `error_log` (no names or numbers) | Kaydee | 90 days |

Data is stored by Supabase in the EU (Ireland), D-007. No ID numbers, addresses or marketing profiles are collected; learner data is never used for marketing.

## Controls in place

- Row level security on every table; the public key cannot read any table (tested over HTTP and in SQL).
- Customers reach their own order only through a 256-bit link token kept on their phone; only its hash is stored.
- Staff roles (owner, helper) checked inside every dashboard action; no public sign-up.
- HTTPS only, HSTS 2 years, SSL Labs A+/A, TLS 1.2-1.3.
- No Supabase secret key on the web server; scheduled deletion uses a shared secret held in Supabase Vault and Vercel.
- Consent recorded with wording version; under-18 orders need guardian consent before anything is saved.
- POPIA deletion requests: Dashboard → Settings → "Delete a customer's details" (immediate).

## If you suspect a breach (step by step)

Act the same day. Write everything down as you go (the **incident register** below).

1. **Contain.**
   - Rotate secrets (see `docs/DEPLOYMENT.md`): Supabase publishable key, `CRON_SECRET` (Vault + Vercel), `GEMINI_API_KEY`, `GMAIL_APP_PASSWORD` (revoke it in the Google account and create a new one).
   - Make all staff reset their passwords; remove any unknown account from Supabase Auth and `staff_roles`.
   - If an order or invoice link may have leaked, it only opens that one order or invoice; if many leaked, the team can clear `orders.access_token_hash` / `invoices.share_token` for the affected orders (customers then contact Kaydee).
2. **Assess** using the logs: Supabase → Logs (API, Auth, Storage), Vercel → Logs, `error_log`, `job_runs`. Work out what data, which customers, and since when.
3. **Notify the Information Regulator** (POPIA section 22) as soon as reasonably possible when personal information was, or may have been, accessed by someone unauthorised: https://inforegulator.org.za (security compromise notification form).
4. **Notify affected customers** in writing (WhatsApp or email) as soon as possible, unless the Regulator or SAPS asks you to delay. Say what happened, what information was involved, what you have done, and what they can do. For learners, include their parent or guardian.
5. **Fix and learn.** Fix the cause, add a test that would catch it, record it in `docs/DECISIONS.md`.

## Incident register

| Date found | What happened | Data / customers affected | Actions taken (with dates) | Regulator notified (date) | Customers notified (date) | Closed |
|---|---|---|---|---|---|---|
| | | | | | | |
