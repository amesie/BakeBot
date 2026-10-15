-- M6: scheduled jobs (spec 7.6) and the in-app notification side of 7.5.
-- Covers REQ-11, REQ-16, REQ-18, REQ-20, REQ-26, REQ-27, proof deletion
-- (Security NFR) and conversation deletion (SRS 3.4).
--
-- pg_cron runs in UTC; SAST = UTC + 2 (no daylight saving).
-- Every job writes a job_runs row (NFR evidence) and never throws: failures
-- are recorded with status 'failed' and an error_log row.

-- ---------------------------------------------------------------------------
-- Settings and job logging
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column site_url text not null default 'https://bake-bot-phi.vercel.app';

create function private.job_start(p_name text)
returns bigint
language sql
set search_path = ''
as $$
  insert into public.job_runs (job_name) values (p_name) returning run_id;
$$;

create function private.job_done(p_run bigint, p_rows int, p_detail jsonb default null)
returns void
language sql
set search_path = ''
as $$
  update public.job_runs
     set status = 'succeeded', rows_affected = p_rows, detail = p_detail, finished_at = now()
   where run_id = p_run;
$$;

create function private.job_failed(p_run bigint, p_name text, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.job_runs set status = 'failed', detail = jsonb_build_object('error', p_error), finished_at = now()
   where run_id = p_run;
  insert into public.error_log (source, message) values ('job:' || p_name, p_error);
$$;

create function private.local_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Johannesburg')::date;
$$;

create function private.notify_owner(p_template text, p_params jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.notifications (recipient, channel, template, params, status, sent_at)
  values ('owner', 'in_app', p_template, p_params, 'sent', now());
$$;

-- ---------------------------------------------------------------------------
-- REQ-11: 15:00 owner summary when at least one order is waiting
-- ---------------------------------------------------------------------------
create function private.job_owner_daily_summary()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('owner_daily_summary');
  v jsonb;
begin
  select jsonb_build_object(
           'pending', count(*) filter (where order_status = 'pending'),
           'waitlisted', count(*) filter (where order_status = 'waitlisted'),
           'needs_quote', count(*) filter (where is_large_order and quote_amount is null),
           'units', coalesce(sum(total_units), 0))
    into v
  from public.orders where order_status in ('pending', 'waitlisted');

  if (v->>'pending')::int + (v->>'waitlisted')::int > 0 then
    perform private.notify_owner('owner_daily_summary', v);
    perform private.job_done(v_run, 1, v);
  else
    perform private.job_done(v_run, 0, jsonb_build_object('skipped', 'no pending orders'));
  end if;
exception when others then
  perform private.job_failed(v_run, 'owner_daily_summary', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-18: Thursday 20:00 cut-off -> per-flavour bake list for next week
-- ---------------------------------------------------------------------------
create function private.job_batch_summary()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('batch_summary');
  v_week date := date_trunc('week', now() at time zone 'Africa/Johannesburg')::date + 7;
  v_flavours jsonb;
  v_total int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('flavour', flavour, 'confirmed', confirmed, 'pending', pending)
                            order by sort_order), '[]'::jsonb),
         coalesce(sum(confirmed + pending), 0)
    into v_flavours, v_total
  from (
    select p.flavour, p.sort_order,
           sum(i.quantity) filter (where o.order_status in ('confirmed', 'baking'))::int as confirmed,
           sum(i.quantity) filter (where o.order_status = 'pending')::int as pending
    from public.orders o
    join public.order_items i using (order_id)
    join public.products p using (product_id)
    where o.collection_week = v_week and o.order_status in ('pending', 'confirmed', 'baking')
    group by p.flavour, p.sort_order
  ) t;

  perform private.notify_owner('owner_batch_summary',
    jsonb_build_object('week', v_week, 'total', v_total, 'flavours', v_flavours));
  perform private.job_done(v_run, v_total, jsonb_build_object('week', v_week));
exception when others then
  perform private.job_failed(v_run, 'batch_summary', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-16: 07:00 reminder for approved EFT orders unpaid 3 days before collection
-- ---------------------------------------------------------------------------
create function private.job_payment_reminders()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('payment_reminders');
  v_count int := 0;
  r record;
begin
  for r in
    select o.order_id, o.payment_reference, coalesce(o.revised_collection_date, o.collection_date) as day, pay.amount
    from public.orders o
    join public.payments pay using (order_id)
    where o.payment_method = 'eft'
      and o.order_status in ('confirmed', 'baking', 'ready')
      and o.released_at is null
      and pay.payment_status = 'unpaid'
      and coalesce(o.revised_collection_date, o.collection_date) = private.local_today() + 3
      and not exists (select 1 from public.notifications n
                      where n.order_id = o.order_id and n.template = 'payment_reminder')
  loop
    perform private.notify_customer(r.order_id, 'payment_reminder',
      jsonb_build_object('amount', r.amount, 'reference', r.payment_reference, 'date', r.day));
    v_count := v_count + 1;
  end loop;
  perform private.job_done(v_run, v_count);
exception when others then
  perform private.job_failed(v_run, 'payment_reminders', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-20: last school day 14:00 -> release unpaid orders; flag paid but
-- uncollected ones (D-054). Runs every weekday; acts only on the last school
-- day (public holiday overrides respected).
-- ---------------------------------------------------------------------------
create function private.job_release_unpaid(p_today date default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, private.local_today());
  v_week date := v_today - (extract(isodow from v_today)::int - 1);
  v_run bigint := private.job_start('release_unpaid');
  v_released int := 0;
  v_waiting jsonb;
  r record;
begin
  if v_today <> private.last_school_day(v_week) then
    perform private.job_done(v_run, 0, jsonb_build_object('skipped', 'not the last school day'));
    return;
  end if;

  for r in
    update public.orders o set released_at = now()
     where coalesce(o.revised_collection_date, o.collection_date) <= v_today
       and o.order_status in ('confirmed', 'baking', 'ready')
       and o.released_at is null
       and not exists (select 1 from public.payments p where p.order_id = o.order_id and p.payment_status = 'paid')
    returning o.order_id
  loop
    perform private.notify_customer(r.order_id, 'released', '{}'::jsonb);
    v_released := v_released + 1;
  end loop;

  -- Paid but not collected: never released; remind the customer, tell Kaydee.
  select coalesce(jsonb_agg(o.order_number order by o.order_number), '[]'::jsonb) into v_waiting
  from public.orders o
  where coalesce(o.revised_collection_date, o.collection_date) <= v_today
    and o.order_status in ('confirmed', 'baking', 'ready')
    and o.released_at is null;
  perform private.notify_customer(o.order_id, 'collect_reminder', '{}'::jsonb)
  from public.orders o
  where o.order_number in (select jsonb_array_elements_text(v_waiting));

  if v_released > 0 or jsonb_array_length(v_waiting) > 0 then
    perform private.notify_owner('owner_release_summary',
      jsonb_build_object('released', v_released, 'paid_uncollected', v_waiting));
  end if;
  perform private.job_done(v_run, v_released, jsonb_build_object('paid_uncollected', v_waiting));
exception when others then
  perform private.job_failed(v_run, 'release_unpaid', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-26: 16:00 feedback request for orders collected yesterday
-- ---------------------------------------------------------------------------
create function private.job_feedback_requests()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('feedback_requests');
  v_count int := 0;
  r record;
begin
  for r in
    select o.order_id from public.orders o
    where o.order_status = 'collected'
      and (o.status_changed_at at time zone 'Africa/Johannesburg')::date = private.local_today() - 1
      and not exists (select 1 from public.feedback f where f.order_id = o.order_id)
      and not exists (select 1 from public.notifications n where n.order_id = o.order_id and n.template = 'feedback_request')
  loop
    perform private.notify_customer(r.order_id, 'feedback_request', '{}'::jsonb);
    v_count := v_count + 1;
  end loop;
  perform private.job_done(v_run, v_count);
exception when others then
  perform private.job_failed(v_run, 'feedback_requests', sqlerrm);
end;
$$;

-- Customer leaves feedback from their status page (token-checked, once).
create function public.submit_feedback(
  p_order_number text, p_token text,
  p_rating int, p_taste int default null, p_size int default null, p_price int default null,
  p_comment text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order uuid;
begin
  select order_id into v_order from public.orders
  where order_number = upper(btrim(p_order_number))
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and access_token_hash = private.hash_token(p_token)
    and order_status = 'collected';
  if v_order is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  insert into public.feedback (order_id, rating, taste_rating, size_rating, price_rating, comment)
  values (v_order, p_rating, p_taste, p_size, p_price, nullif(btrim(coalesce(p_comment, '')), ''));
exception
  when unique_violation then raise exception 'already_given' using errcode = 'check_violation';
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-27: anonymise 90 days after the customer's last order is finished
-- ---------------------------------------------------------------------------
create function private.anonymise_customer(p_customer_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.customers
     set full_name = 'Anonymised customer',
         phone_number = 'anon-' || p_customer_id,
         customer_type = null,
         anonymised_at = now()
   where customer_id = p_customer_id and anonymised_at is null;
  update public.orders set special_notes = null where customer_id = p_customer_id;
  update public.feedback f set comment = null
    from public.orders o where o.order_id = f.order_id and o.customer_id = p_customer_id;
  delete from public.conversations where customer_id = p_customer_id;
  delete from public.notifications where customer_id = p_customer_id;
  -- Invoices keep their number and total (financial records); the PDF is
  -- generated from the anonymised data from now on (D-049).
end;
$$;

create function private.job_anonymise()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('anonymise');
  v_count int := 0;
  r record;
begin
  for r in
    select c.customer_id from public.customers c
    where c.anonymised_at is null
      and not exists (select 1 from public.orders o
                      where o.customer_id = c.customer_id and o.order_status not in ('collected', 'cancelled'))
      and coalesce((select max(o.status_changed_at) from public.orders o where o.customer_id = c.customer_id),
                   c.last_order_at, c.created_at) < now() - interval '90 days'
  loop
    perform private.anonymise_customer(r.customer_id);
    v_count := v_count + 1;
  end loop;
  perform private.job_done(v_run, v_count);
exception when others then
  perform private.job_failed(v_run, 'anonymise', sqlerrm);
end;
$$;

-- Owner-triggered deletion request (spec 7.8): same routine, immediately.
create function public.anonymise_customer_now(p_customer_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  if exists (select 1 from public.orders where customer_id = p_customer_id
             and order_status not in ('collected', 'cancelled')) then
    raise exception 'has_active_orders' using errcode = 'check_violation';
  end if;
  perform private.anonymise_customer(p_customer_id);
  insert into public.job_runs (job_name, status, rows_affected, finished_at, detail)
  values ('anonymise_on_request', 'succeeded', 1, now(), jsonb_build_object('by', (select auth.uid())));
end;
$$;

-- ---------------------------------------------------------------------------
-- SRS 3.4: conversations deleted after 30 days
-- ---------------------------------------------------------------------------
create function private.job_delete_conversations()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('delete_conversations');
  v_count int;
begin
  delete from public.conversations where created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  perform private.job_done(v_run, v_count);
exception when others then
  perform private.job_failed(v_run, 'delete_conversations', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- Security NFR: proof files deleted 30 days after payment (and files no
-- payment points to any more). Storage only allows deletion through its API,
-- so pg_cron asks the website to do it (spec 7.6, D-055):
--   pg_net POST /api/cron/delete-proofs  (header x-cron-secret from Vault)
--   -> due_proof_paths(secret) -> Storage API delete (policy: due files only)
--   -> proofs_deleted(secret, paths)
-- ---------------------------------------------------------------------------
create function private.cron_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
$$;

create function private.proof_is_due(p_path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    exists (select 1 from public.payments p
            where p.proof_of_payment_path = p_path and p.payment_status = 'paid'
              and p.paid_at < now() - interval '30 days')
    or exists (select 1 from public.payments p join public.orders o using (order_id)
               join public.customers c using (customer_id)
               where p.proof_of_payment_path = p_path and c.anonymised_at is not null)
    or (not exists (select 1 from public.payments p where p.proof_of_payment_path = p_path)
        and not exists (select 1 from private.proof_upload_grants g where g.object_path = p_path)
        and exists (select 1 from storage.objects s where s.bucket_id = 'payment-proofs' and s.name = p_path
                    and s.created_at < now() - interval '1 day'));
$$;

create function public.proof_delete_allowed(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.proof_is_due(p_path);
$$;

create function public.due_proof_paths(p_secret text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.cron_secret() is null or p_secret is distinct from private.cron_secret() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((select array_agg(s.name) from storage.objects s
                   where s.bucket_id = 'payment-proofs' and private.proof_is_due(s.name)), '{}');
end;
$$;

create function public.proofs_deleted(p_secret text, p_paths text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run bigint;
begin
  if private.cron_secret() is null or p_secret is distinct from private.cron_secret() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  update public.payments set proof_of_payment_path = null where proof_of_payment_path = any (p_paths);
  v_run := private.job_start('delete_proofs');
  perform private.job_done(v_run, coalesce(array_length(p_paths, 1), 0));
end;
$$;

create policy "proofs: delete when due"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'payment-proofs' and public.proof_delete_allowed(name));

-- remove() looks the file up first: allow that only for files that are due.
create policy "proofs: due files visible for deletion"
  on storage.objects for select to anon
  using (bucket_id = 'payment-proofs' and public.proof_delete_allowed(name));

create function private.job_request_proof_deletion()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('request_proof_deletion');
  v_secret text := private.cron_secret();
  v_request bigint;
begin
  if v_secret is null then
    perform private.job_failed(v_run, 'request_proof_deletion', 'cron_secret is not set in Vault');
    return;
  end if;
  select net.http_post(
           url := (select s.site_url from public.app_settings s) || '/api/cron/delete-proofs',
           headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
           body := '{}'::jsonb,
           timeout_milliseconds := 20000)
    into v_request;
  perform private.job_done(v_run, 0, jsonb_build_object('pg_net_request', v_request));
exception when others then
  perform private.job_failed(v_run, 'request_proof_deletion', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer status summary: can they leave feedback?
-- ---------------------------------------------------------------------------
create function public.can_give_feedback(p_order_number text, p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.order_number = upper(btrim(p_order_number))
      and p_token ~ '^[A-Za-z0-9_-]{43}$'
      and o.access_token_hash = private.hash_token(p_token)
      and o.order_status = 'collected'
      and not exists (select 1 from public.feedback f where f.order_id = o.order_id));
$$;

-- ---------------------------------------------------------------------------
-- Schedules (UTC). Re-running this migration replaces them.
-- ---------------------------------------------------------------------------
select cron.schedule('owner-daily-summary',   '0 13 * * *',   'select private.job_owner_daily_summary()');
select cron.schedule('batch-summary',         '0 18 * * 4',   'select private.job_batch_summary()');
select cron.schedule('payment-reminders',     '0 5 * * *',    'select private.job_payment_reminders()');
select cron.schedule('release-unpaid',        '0 12 * * 1-5', 'select private.job_release_unpaid()');
select cron.schedule('feedback-requests',     '0 14 * * *',   'select private.job_feedback_requests()');
select cron.schedule('delete-proofs',         '0 0 * * *',    'select private.job_request_proof_deletion()');
select cron.schedule('anonymise-customers',   '15 0 * * *',   'select private.job_anonymise()');
select cron.schedule('delete-conversations',  '30 0 * * *',   'select private.job_delete_conversations()');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.submit_feedback(text, text, int, int, int, int, text), public.anonymise_customer_now(uuid),
  public.proof_delete_allowed(text), public.due_proof_paths(text), public.proofs_deleted(text, text[]),
  public.can_give_feedback(text, text)
  from public;
grant execute on function
  public.submit_feedback(text, text, int, int, int, int, text), public.proof_delete_allowed(text),
  public.due_proof_paths(text), public.proofs_deleted(text, text[]), public.can_give_feedback(text, text)
  to anon, authenticated, service_role;
grant execute on function public.anonymise_customer_now(uuid) to authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
-- The cron secret is for the scheduler and the deletion functions only.
revoke execute on function private.cron_secret() from authenticated;
