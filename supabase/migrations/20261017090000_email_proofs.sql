-- Emailed proof of payment (D-069). Customers paying by EFT may email their
-- proof to the KD Pops inbox with the payment reference as the subject.
-- Every 10 minutes (05:00-20:59 SAST) pg_cron asks the website to read new
-- emails; matches are stored like an upload (pending_review, never "paid").
-- All functions require the cron secret from Vault (same as D-055).

create function private.require_cron_secret(p_secret text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.cron_secret() is null or p_secret is distinct from private.cron_secret() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Approved, not yet paid order for a payment reference.
create function private.order_by_reference(p_reference text)
returns public.orders
language plpgsql
stable
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where payment_reference = upper(btrim(p_reference));
  if not found then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if o.order_status not in ('confirmed', 'baking', 'ready', 'collected') or o.released_at is not null then
    raise exception 'not_approved' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.payments p where p.order_id = o.order_id and p.payment_status = 'paid') then
    raise exception 'already_paid' using errcode = 'check_violation';
  end if;
  return o;
end;
$$;

create function public.start_emailed_proof(p_secret text, p_reference text, p_extension text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_path text;
begin
  perform private.require_cron_secret(p_secret);
  if p_extension not in ('jpg', 'png', 'webp', 'pdf') then
    raise exception 'bad_type' using errcode = 'check_violation';
  end if;
  o := private.order_by_reference(p_reference);
  delete from private.proof_upload_grants where expires_at < now();
  v_path := o.order_id || '/email-' || gen_random_uuid() || '.' || p_extension;
  insert into private.proof_upload_grants (object_path, order_id) values (v_path, o.order_id);
  return v_path;
end;
$$;

create function public.finish_emailed_proof(p_secret text, p_reference text, p_path text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  perform private.require_cron_secret(p_secret);
  o := private.order_by_reference(p_reference);
  delete from private.proof_upload_grants where object_path = p_path and order_id = o.order_id;
  if not found or not exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and name = p_path) then
    raise exception 'no_upload' using errcode = 'check_violation';
  end if;
  update public.payments
     set proof_of_payment_path = p_path, proof_uploaded_at = now(), payment_status = 'pending_review'
   where order_id = o.order_id;
  perform private.notify_customer(o.order_id, 'proof_received', jsonb_build_object('via', 'email'));
  return o.order_number;
end;
$$;

-- Emails that could not be matched are flagged to Kaydee, never dropped.
create function public.flag_unmatched_email(p_secret text, p_subject text, p_reason text, p_received_at timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_cron_secret(p_secret);
  perform private.notify_owner('owner_unmatched_email', jsonb_build_object(
    'subject', left(coalesce(p_subject, ''), 80),
    'reason', left(coalesce(p_reason, ''), 40),
    'received_at', p_received_at));
end;
$$;

create function public.email_check_done(p_secret text, p_seen int, p_matched int, p_unmatched int, p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run bigint;
begin
  perform private.require_cron_secret(p_secret);
  v_run := private.job_start('check_email');
  if p_error is not null then
    perform private.job_failed(v_run, 'check_email', left(p_error, 300));
  else
    perform private.job_done(v_run, p_matched,
      jsonb_build_object('seen', p_seen, 'matched', p_matched, 'unmatched', p_unmatched));
  end if;
end;
$$;

create function private.job_request_email_check()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_secret text := private.cron_secret();
begin
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := (select s.site_url from public.app_settings s) || '/api/cron/check-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
end;
$$;

-- Every 10 minutes, 05:00-20:59 SAST (03:00-18:59 UTC).
select cron.schedule('check-email', '*/10 3-18 * * *', 'select private.job_request_email_check()');

revoke execute on function
  public.start_emailed_proof(text, text, text), public.finish_emailed_proof(text, text, text),
  public.flag_unmatched_email(text, text, text, timestamptz), public.email_check_done(text, int, int, int, text)
  from public;
grant execute on function
  public.start_emailed_proof(text, text, text), public.finish_emailed_proof(text, text, text),
  public.flag_unmatched_email(text, text, text, timestamptz), public.email_check_done(text, int, int, int, text)
  to anon, authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function private.cron_secret(), private.require_cron_secret(text) from authenticated;
