-- DB test: emailed proof of payment (D-069). Uses the real Vault secret
-- inside the transaction; rolled back. Run: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to anon;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  owner_id uuid := gen_random_uuid();
  secret text := private.cron_secret();
  c uuid;
  o uuid; o_pending uuid;
  d date := (select min(x) from private.collection_dates() x);
  ref text;
  v_path text;
  got text;
begin
  insert into auth.users (id, email, aud, role) values (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner');
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Email Proof Test', '+27820000008', true, 'test', false) returning customer_id into c;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'eft', d, 'second_break', 2) returning order_id into o;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'eft', d, 'second_break', 2) returning order_id into o_pending;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot)
  select x, (select product_id from public.products where flavour = 'Funfetti'), 2, 10 from unnest(array[o, o_pending]) x;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ref := public.approve_order(o)->>'payment_reference';
  reset role;

  insert into _results values ('cron secret is in Vault', secret is not null, null);

  begin
    perform public.start_emailed_proof('wrong', ref, 'jpg');
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  insert into _results values ('needs the cron secret', got = 'refused', got);

  begin
    perform public.start_emailed_proof(secret, 'KDP-9999-ZZZZ', 'jpg');
    got := 'allowed';
  exception when no_data_found then got := sqlerrm;
  end;
  insert into _results values ('unknown reference refused', got = 'not_found', got);

  v_path := public.start_emailed_proof(secret, lower(' ' || ref || ' '), 'pdf');
  insert into _results values ('reference matched regardless of case and spaces',
    v_path like o || '/email-%.pdf', v_path);

  set local role anon;
  insert into storage.objects (bucket_id, name) values ('payment-proofs', v_path);
  reset role;

  insert into _results values ('finish returns the order number',
    public.finish_emailed_proof(secret, ref, v_path) = (select order_number from public.orders where order_id = o), null);
  insert into _results values ('emailed proof sets pending review, never paid',
    exists (select 1 from public.payments where order_id = o and payment_status = 'pending_review' and proof_of_payment_path = v_path), null);
  insert into _results values ('customer told the emailed proof arrived',
    exists (select 1 from public.notifications where order_id = o and template = 'proof_received' and params->>'via' = 'email'), null);

  set local role authenticated;
  perform public.mark_paid(o);
  reset role;
  begin
    perform public.start_emailed_proof(secret, ref, 'jpg');
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('no proof accepted once paid', got = 'already_paid', got);

  perform public.flag_unmatched_email(secret, 'Payment for my pops', 'no_reference', now());
  insert into _results values ('unmatched email flagged to Kaydee',
    exists (select 1 from public.notifications where template = 'owner_unmatched_email' and params->>'reason' = 'no_reference'), null);

  perform public.email_check_done(secret, 3, 1, 2);
  insert into _results values ('each inbox check is logged',
    exists (select 1 from public.job_runs where job_name = 'check_email' and status = 'succeeded'
            and (detail->>'unmatched')::int = 2), null);

  insert into _results values ('inbox checked every 10 minutes in the day',
    (select schedule from cron.job where jobname = 'check-email') = '*/10 3-18 * * *', null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
