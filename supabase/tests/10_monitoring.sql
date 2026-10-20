-- DB test: error logging and job health (M9). Rolled back. Run: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to authenticated, anon;

do $$
declare
  owner_id uuid := gen_random_uuid();
  helper_id uuid := gen_random_uuid();
  before int := (select count(*) from public.error_log);
  n int;
  got text;
begin
  insert into auth.users (id, email, aud, role) values
    (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated'),
    (helper_id, 'helper@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner'), (helper_id, 'helper');

  set local role anon;
  perform public.log_error('api:orders', repeat('x', 900), '{"code": "test"}');
  perform public.log_error('not-allowed source', 'ignored');
  reset role;
  insert into _results values ('anon can log an API error', (select count(*) from public.error_log) = before + 1, null);
  insert into _results values ('message truncated to 500 characters',
    (select length(message) from public.error_log order by error_id desc limit 1) = 500, null);
  insert into _results values ('unknown sources ignored',
    not exists (select 1 from public.error_log where source = 'not-allowed source'), null);

  begin
    set local role anon;
    select count(*) into n from public.error_log;
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('anon cannot read the error log', got = 'refused', got);

  perform private.job_delete_old_logs();
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.job_health where job_name = 'delete_old_logs' and status = 'succeeded';
  reset role;
  insert into _results values ('owner sees the latest run of each job', n = 1, n::text);

  perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.job_health;
  reset role;
  insert into _results values ('helper does not see job health', n = 0, n::text);

  insert into _results values ('old-log cleanup scheduled at 02:45 SAST',
    (select schedule from cron.job where jobname = 'delete-old-logs') = '45 0 * * *', null);
  insert into _results values ('10 jobs scheduled in total (incl. check-email, D-069)', (select count(*) from cron.job) = 10, null);
end;
$$;

select test, ok, detail from _results order by ok, test;

rollback;
