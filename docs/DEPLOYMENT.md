# Deployment (M8)

## Where things run

| Part | Where | Notes |
|---|---|---|
| Website and API | Vercel project `bake-bot`, functions in `dub1` (Dublin) | Production URL: https://bake-bot-phi.vercel.app |
| Database, auth, storage, scheduled jobs | Supabase project `BakeBot` (`eu-west-1`) | pg_cron + pg_net, Vault holds `cron_secret` |
| AI | Google Gemini API | Key in Vercel `GEMINI_API_KEY` |
| Code | GitHub `amesie/BakeBot` (public) | CI: lint, typecheck, unit tests on every push |

## Environment variables (Vercel → Settings → Environment Variables)

See `.env.example`. Production needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_OWNER_WHATSAPP`, `EFT_BANK_DETAILS`, `CRON_SECRET` (same value as the Vault secret `cron_secret`), `GEMINI_API_KEY`, `GMAIL_APP_PASSWORD` (and optionally `GMAIL_USER`, `NEXT_PUBLIC_PROOF_EMAIL`). Optional: `GEMINI_CHAT_MODEL`, `GEMINI_EMBED_MODEL`, `CHAT_SIMILARITY_THRESHOLD`. Never set `BAKEBOT_FAKE_MODEL` on Vercel. After changing a variable, **redeploy**.

## Releasing a change

1. **Branch and code.** Work on a branch; name commits with the requirement IDs (`feat(orders): … [REQ-08]`).
2. **Database changes only through migrations:** `npm run db:new <name>` → write SQL in `supabase/migrations/` → write or extend a test in `supabase/tests/`.
3. **Test locally:**
   - `npm run lint && npm run typecheck && npm test`
   - Dry-run new migrations with their tests inside a rolled-back transaction (see how earlier phases did it), then `npm run test:db`.
   - `npm run build && npm run test:e2e`
4. **Preview.** Push the branch: Vercel builds a **preview deployment** (protected by Vercel login). Click through the change there.
5. **Apply migrations** before merging: `npx supabase db push` (asks for confirmation). Then `npm run test:db` against the live project.
6. **Merge to `main`.** Vercel deploys to production automatically. Check `https://bake-bot-phi.vercel.app/api/health` and the dashboard's System tab.
7. **Record** the change in `docs/TRACEABILITY.md` and any deviation in `docs/DECISIONS.md`.

Order matters: apply the migration **before** the code that needs it reaches production, and make migrations backwards-compatible (add columns and functions; remove old ones in a later release).

## Rolling back

- **Code:** Vercel → Deployments → choose the last good production deployment → **Promote to Production** (instant).
- **Database:** write a new migration that undoes the change (never edit an applied migration). Supabase also keeps daily backups (Project → Database → Backups).

## Staging (recommended before go-live, D-018)

There is no separate staging database yet (the free plan's two projects are in use). Tests run against the live project inside rolled-back transactions, and load and latency tests clean up after themselves. Before real trading grows, create a second Supabase project for staging, point Vercel **Preview** variables at it, and apply migrations there first.

## Rotating secrets

| Secret | How |
|---|---|
| `GEMINI_API_KEY` | AI Studio → new key → `npx vercel env rm GEMINI_API_KEY production --yes` → `npx vercel env add GEMINI_API_KEY production` → redeploy → delete the old key |
| `CRON_SECRET` | Generate a new random value; update Vault (`select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<new>');`) and Vercel together |
| Supabase publishable key | Supabase → API keys → rotate, then update Vercel and redeploy |
| Staff passwords | Staff use "Forgot password?" |

Breach response: see `docs/SECURITY.md`.
