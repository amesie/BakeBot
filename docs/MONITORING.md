# Monitoring (M9, Availability NFR)

## 1. UptimeRobot (checks the site every 5 minutes)

Target: 99.5% monthly uptime. Evidence: a 30-day export.

1. Create a free account at https://uptimerobot.com (use the team's shared email).
2. **Add New Monitor**:
   - Monitor type: **HTTP(s)** (or **Keyword** for a stronger check)
   - Friendly name: `KD Pops health`
   - URL: `https://bake-bot-phi.vercel.app/api/health`
   - Monitoring interval: **5 minutes**
   - For a Keyword monitor: keyword `"status":"ok"`, alert when **not exists**
3. Alert contacts: add the team email (and Kaydee's, if she wants alerts).
4. Optional: create a **Status page** listing this monitor and share its link.
5. After 30 days: **Monitor → Export logs** (or the response-time and uptime report) and save it as `docs/evidence/uptime-<month>.csv`. Add the uptime percentage to `docs/TEST_REPORT.md`.

`/api/health` runs a small database query every time, so the 5-minute checks also stop the free Supabase plan from pausing the project.

## 2. Maintenance-window drill (once a month)

Sunday between 02:00 and 04:00 SAST (spec section 10):

1. In Supabase, **pause** the project (or simulate an outage by changing `NEXT_PUBLIC_SUPABASE_URL` on a preview deployment).
2. On a phone: open the site, place an order. Expected: the order is **saved on the phone** ("Saved on your phone") and the menu still shows (cached). The chat falls back to the order form.
3. UptimeRobot should report the outage. Restore the project; the saved order goes through when the page is open.
4. Write the date, what you saw and screenshots in `docs/TEST_REPORT.md`.

## 3. Inside the dashboard: System tab (owner)

- **Website and database:** live check.
- **Automatic jobs:** the last run of each of the 9 scheduled jobs (✓ on time, ! late, ✗ failed).
- **Recent errors:** the last 20 server errors (no personal details), kept 90 days.

## 4. Where else to look

- Vercel → Project → **Logs** (function errors, live).
- Supabase → **Logs** (database, auth, storage).
- SQL: `select * from public.job_runs order by started_at desc limit 50;` and `select * from cron.job_run_details order by start_time desc limit 50;`
