// M9: System tab. Is the database up, did the scheduled jobs run, and what
// went wrong recently (Availability NFR, spec 7.6 "every job writes a row").
import type { ErrorRow, JobHealth } from "@/lib/dashboard/data";
import { formatDay, sastDate } from "@/lib/dates";
import { dictionaries } from "@/lib/i18n";

const en = dictionaries.en;
const when = (iso: string) =>
  `${formatDay(sastDate(iso), en)} ${new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))}`;

// What each job is for, and how often it should have run (hours).
const JOBS: Record<string, { label: string; everyHours: number }> = {
  owner_daily_summary: { label: "15:00 order summary for Kaydee", everyHours: 24 },
  batch_summary: { label: "Thursday 20:00 bake list", everyHours: 24 * 7 },
  payment_reminders: { label: "07:00 EFT payment reminders", everyHours: 24 },
  release_unpaid: { label: "14:00 release unpaid orders (last school day)", everyHours: 24 * 3 },
  feedback_requests: { label: "16:00 feedback requests", everyHours: 24 },
  request_proof_deletion: { label: "02:00 delete old proofs of payment", everyHours: 24 },
  delete_proofs: { label: "Proof files deleted by the website", everyHours: 24 },
  anonymise: { label: "02:15 anonymise customers after 90 days", everyHours: 24 },
  delete_conversations: { label: "02:30 delete chats after 30 days", everyHours: 24 },
  delete_old_logs: { label: "02:45 clear old error and job logs", everyHours: 24 },
  check_email: { label: "Emailed proofs read from Gmail (logged when emails arrive)", everyHours: 24 * 14 },
};

export function SystemPanel({
  dbOk,
  dbMs,
  jobs,
  errors,
  checkedAt,
}: {
  dbOk: boolean;
  dbMs: number;
  checkedAt: number;
  jobs: JobHealth[];
  errors: ErrorRow[];
}) {
  const byName = new Map(jobs.map((j) => [j.job_name, j]));
  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="kd-card" style={{ padding: 20 }}>
        <h2 className="font-display" style={{ fontSize: 20, margin: "0 0 6px" }}>Website and database</h2>
        <p className="m-0">
          {dbOk ? "✓ Working" : "✗ The database is not answering"} · checked in {dbMs} ms
        </p>
        <p className="form-note m-0">Uptime is also checked every 5 minutes by UptimeRobot (see docs/MONITORING.md).</p>
      </section>

      <section className="kd-card stack" style={{ padding: 20 }}>
        <h2 className="font-display" style={{ fontSize: 20, margin: 0 }}>Automatic jobs</h2>
        <ul className="m-0 stack" style={{ listStyle: "none", padding: 0, gap: 10 }}>
          {Object.entries(JOBS).map(([name, info]) => {
            const run = byName.get(name);
            const late =
              run && checkedAt - new Date(run.started_at).getTime() > (info.everyHours + 2) * 3600 * 1000;
            const mark = !run ? "–" : run.status === "failed" ? "✗" : late ? "!" : "✓";
            return (
              <li key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span>
                  <b aria-hidden="true">{mark}</b> {info.label}
                </span>
                <span className="form-note">
                  {!run
                    ? "has not run yet"
                    : `${run.status === "failed" ? "FAILED" : late ? "late" : "ran"} ${when(run.started_at)}${
                        run.rows_affected ? ` · ${run.rows_affected} rows` : ""
                      }`}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="form-note m-0">✓ ran on time · ! late · ✗ failed (see errors below) · – not run yet</p>
      </section>

      <section className="kd-card stack" style={{ padding: 20 }}>
        <h2 className="font-display" style={{ fontSize: 20, margin: 0 }}>Recent errors</h2>
        {errors.length === 0 ? (
          <p className="form-note m-0">No errors. 🎉</p>
        ) : (
          <ul className="message-list">
            {errors.map((e, i) => (
              <li key={i}>
                <time dateTime={e.occurred_at}>{when(e.occurred_at)} · {e.source}</time>
                {e.message}
              </li>
            ))}
          </ul>
        )}
        <p className="form-note m-0">Errors are kept for 90 days. They never contain customer names or numbers.</p>
      </section>
    </div>
  );
}
