-- M9: error logging from the API, job health for the dashboard, log retention.
-- Availability NFR, SRS gap 5 (error_log).

-- API routes run with the public key, so they log through this function.
-- Limited source names, truncated text and a flood limit keep it from being
-- abused; it never stores names or phone numbers (callers pass codes only).
create function public.log_error(p_source text, p_message text, p_context jsonb default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_source is null or p_source !~ '^api:[a-z0-9/_-]{1,40}$' then
    return;
  end if;
  -- Flood limit: at most 200 rows per 10 minutes.
  if (select count(*) from public.error_log where occurred_at > now() - interval '10 minutes') >= 200 then
    return;
  end if;
  insert into public.error_log (source, message, context)
  values (p_source, left(coalesce(p_message, ''), 500),
          case when p_context is null or length(p_context::text) > 2000 then null else p_context end);
end;
$$;

-- Latest run of every job, for the dashboard's System tab (owner only via RLS on job_runs).
create view public.job_health with (security_invoker = true) as
select distinct on (job_name) job_name, status, rows_affected, detail, started_at, finished_at
from public.job_runs
order by job_name, started_at desc;

-- Retention: error log 90 days, job log 1 year (kept as NFR evidence).
create function private.job_delete_old_logs()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('delete_old_logs');
  v_errors int;
  v_runs int;
begin
  delete from public.error_log where occurred_at < now() - interval '90 days';
  get diagnostics v_errors = row_count;
  delete from public.job_runs where started_at < now() - interval '365 days';
  get diagnostics v_runs = row_count;
  perform private.job_done(v_run, v_errors + v_runs, jsonb_build_object('error_log', v_errors, 'job_runs', v_runs));
exception when others then
  perform private.job_failed(v_run, 'delete_old_logs', sqlerrm);
end;
$$;

select cron.schedule('delete-old-logs', '45 0 * * *', 'select private.job_delete_old_logs()');

revoke execute on function public.log_error(text, text, jsonb) from public;
grant execute on function public.log_error(text, text, jsonb) to anon, authenticated, service_role;
revoke all on public.job_health from anon;
grant select on public.job_health to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function private.cron_secret() from authenticated;
