-- Customer email (D-070): optional address for order emails (received,
-- invoice on approval, ready, cancelled), and cancelling from the email or
-- status page until baking starts (D-071).

alter table public.customers
  add column email text check (
    email is null
    or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

-- Every email the system sends or fails to send (spec 7.5: "every send
-- logged with status"). No addresses or message text are stored here.
create table public.email_log (
  email_id bigint generated always as identity primary key,
  order_id uuid references public.orders (order_id) on delete set null,
  template text not null,
  status text not null check (status in ('sent', 'failed')),
  attempts int not null default 1,
  error text,
  created_at timestamptz not null default now()
);
create index email_log_order_idx on public.email_log (order_id);
create index email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
create policy owner_all on public.email_log for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
revoke all on public.email_log from anon;

-- Order for a status-link token (the customer's proof of ownership).
create function private.order_by_token(p_order_number text, p_token text)
returns public.orders
language plpgsql
stable
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders
  where order_number = upper(btrim(p_order_number))
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and access_token_hash = private.hash_token(p_token);
  if not found then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  return o;
end;
$$;

-- Called by POST /api/orders right after place_order when the customer gave
-- an email. Blank keeps any address saved from an earlier order.
create function public.set_order_email(p_order_number text, p_token text, p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  o := private.order_by_token(p_order_number, p_token);
  if v_email is null then
    return;
  end if;
  update public.customers set email = v_email where customer_id = o.customer_id;
end;
$$;

-- D-071: customers may cancel until baking starts, but not after paying by
-- EFT online (that needs a refund conversation with Kaydee).
create function public.cancel_order(p_order_number text, p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  o := private.order_by_token(p_order_number, p_token);
  if o.order_status not in ('waitlisted', 'pending', 'confirmed') then
    raise exception 'too_late' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.payments p where p.order_id = o.order_id and p.payment_status in ('paid', 'pending_review')) then
    raise exception 'paid_contact_kaydee' using errcode = 'check_violation';
  end if;

  update public.orders set order_status = 'cancelled' where order_id = o.order_id;
  perform private.notify_customer(o.order_id, 'cancelled_by_customer', '{}'::jsonb);
  perform private.notify_owner('owner_customer_cancelled', jsonb_build_object('order_number', o.order_number));

  return private.order_summary(o.order_id) || jsonb_build_object(
    'email', (select c.email from public.customers c where c.customer_id = o.customer_id),
    'language', (select c.preferred_language from public.customers c where c.customer_id = o.customer_id));
end;
$$;

-- Customer-side sends (order received, cancelled) are logged with the token.
create function public.log_order_email(p_order_number text, p_token text, p_template text, p_status text, p_attempts int, p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  o := private.order_by_token(p_order_number, p_token);
  insert into public.email_log (order_id, template, status, attempts, error)
  values (o.order_id, left(p_template, 40), case when p_status = 'sent' then 'sent' else 'failed' end,
          greatest(1, least(coalesce(p_attempts, 1), 5)), left(p_error, 300));
end;
$$;

-- REQ-27: anonymisation also removes the email address.
create or replace function private.anonymise_customer(p_customer_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.customers
     set full_name = 'Anonymised customer',
         phone_number = 'anon-' || p_customer_id,
         email = null,
         customer_type = null,
         anonymised_at = now()
   where customer_id = p_customer_id and anonymised_at is null;
  update public.orders set special_notes = null where customer_id = p_customer_id;
  update public.feedback f set comment = null
    from public.orders o where o.order_id = f.order_id and o.customer_id = p_customer_id;
  delete from public.conversations where customer_id = p_customer_id;
  delete from public.notifications where customer_id = p_customer_id;
end;
$$;

-- Email log kept 90 days, like the error log.
create or replace function private.job_delete_old_logs()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run bigint := private.job_start('delete_old_logs');
  v_errors int;
  v_runs int;
  v_emails int;
begin
  delete from public.error_log where occurred_at < now() - interval '90 days';
  get diagnostics v_errors = row_count;
  delete from public.job_runs where started_at < now() - interval '365 days';
  get diagnostics v_runs = row_count;
  delete from public.email_log where created_at < now() - interval '90 days';
  get diagnostics v_emails = row_count;
  perform private.job_done(v_run, v_errors + v_runs + v_emails,
    jsonb_build_object('error_log', v_errors, 'job_runs', v_runs, 'email_log', v_emails));
exception when others then
  perform private.job_failed(v_run, 'delete_old_logs', sqlerrm);
end;
$$;

revoke execute on function
  public.set_order_email(text, text, text), public.cancel_order(text, text),
  public.log_order_email(text, text, text, text, int, text)
  from public;
grant execute on function
  public.set_order_email(text, text, text), public.cancel_order(text, text),
  public.log_order_email(text, text, text, text, int, text)
  to anon, authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function private.cron_secret(), private.require_cron_secret(text) from authenticated;
