-- DB test: scheduled jobs (M6). REQ-11, REQ-16, REQ-18, REQ-20, REQ-26,
-- REQ-27, conversation deletion, proof deletion rules, schedules.
-- Jobs touch real rows inside this transaction; everything is rolled back.

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to authenticated, anon;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  owner_id uuid := gen_random_uuid();
  c uuid; c_old uuid; c_active uuid;
  today date := private.local_today();
  this_monday date := today - (extract(isodow from today)::int - 1);
  next_monday date := this_monday + 7;
  last_day date := private.last_school_day(this_monday + 7);
  tok text := repeat('f', 43);
  funfetti uuid := (select product_id from public.products where flavour = 'Funfetti');
  o_pending uuid; o_next uuid; o_remind uuid; o_unpaid uuid; o_paid uuid; o_collected uuid; o_old uuid; o_active uuid;
  v jsonb;
  got text;
  n int;
begin
  insert into auth.users (id, email, aud, role) values (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner');
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Job Test', '+27820000005', true, 'test', false) returning customer_id into c;

  -- ------------------------------------------------------------ REQ-11 daily summary
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', next_monday, 'second_break', 4) returning order_id into o_pending;
  perform private.job_owner_daily_summary();
  select params into v from public.notifications where template = 'owner_daily_summary' order by created_at desc limit 1;
  insert into _results values ('REQ-11 owner summary sent when orders wait', (v->>'pending')::int >= 1, v::text);
  insert into _results values ('job run logged as succeeded',
    exists (select 1 from public.job_runs where job_name = 'owner_daily_summary' and status = 'succeeded'), null);

  -- ------------------------------------------------------------ REQ-18 batch summary
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', next_monday + 1, 'second_break', 6) returning order_id into o_next;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot) values (o_next, funfetti, 6, 10);
  update public.orders set order_status = 'confirmed' where order_id = o_next;
  perform private.job_batch_summary();
  select params into v from public.notifications where template = 'owner_batch_summary' order by created_at desc limit 1;
  insert into _results values ('REQ-18 bake list is for next week', v->>'week' = next_monday::text, v->>'week');
  insert into _results values ('REQ-18 bake list counts Funfetti',
    exists (select 1 from jsonb_array_elements(v->'flavours') f where f->>'flavour' = 'Funfetti' and (f->>'confirmed')::int >= 6), v::text);

  -- ------------------------------------------------------------ REQ-16 payment reminder
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, revised_collection_date)
  values (c, 'eft', this_monday, 'second_break', 2, today + 3) returning order_id into o_remind;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot) values (o_remind, funfetti, 2, 10);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.approve_order(o_remind);
  reset role;
  perform private.job_payment_reminders();
  perform private.job_payment_reminders();  -- second run must not repeat it
  insert into _results values ('REQ-16 one reminder 3 days before collection',
    (select count(*) from public.notifications where order_id = o_remind and template = 'payment_reminder') = 1, null);

  -- ------------------------------------------------------------ REQ-20 release (D-054)
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', next_monday, 'second_break', 2) returning order_id into o_unpaid;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', next_monday, 'second_break', 2) returning order_id into o_paid;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot)
  values (o_unpaid, funfetti, 2, 10), (o_paid, funfetti, 2, 10);
  set local role authenticated;
  perform public.approve_order(o_unpaid);
  perform public.approve_order(o_paid);
  perform public.mark_paid(o_paid);
  reset role;

  perform private.job_release_unpaid(last_day - 1);  -- not the last school day
  insert into _results values ('REQ-20 does nothing before the last school day',
    (select released_at is null from public.orders where order_id = o_unpaid), null);

  perform private.job_release_unpaid(last_day);
  insert into _results values ('REQ-20 unpaid order released on the last school day',
    (select released_at is not null from public.orders where order_id = o_unpaid), null);
  insert into _results values ('REQ-20 customer told about the release',
    exists (select 1 from public.notifications where order_id = o_unpaid and template = 'released'), null);
  insert into _results values ('D-054 paid order is not released',
    (select released_at is null from public.orders where order_id = o_paid), null);
  insert into _results values ('D-054 paid but uncollected: customer reminded',
    exists (select 1 from public.notifications where order_id = o_paid and template = 'collect_reminder'), null);
  select params into v from public.notifications where template = 'owner_release_summary' order by created_at desc limit 1;
  insert into _results values ('D-054 Kaydee told which paid orders wait',
    v->'paid_uncollected' ? (select order_number from public.orders where order_id = o_paid), v::text);
  insert into _results values ('released order can now be cancelled (D-010)',
    private.order_transition_allowed('confirmed', 'cancelled', true), null);

  -- ------------------------------------------------------------ REQ-26 feedback
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, access_token_hash)
  values (c, 'cash', this_monday, 'second_break', 1, private.hash_token(tok)) returning order_id into o_collected;
  update public.orders set order_status = 'confirmed' where order_id = o_collected;
  update public.orders set order_status = 'baking' where order_id = o_collected;
  update public.orders set order_status = 'ready' where order_id = o_collected;
  update public.orders set order_status = 'collected' where order_id = o_collected;
  update public.orders set status_changed_at = now() - interval '1 day' where order_id = o_collected;
  perform private.job_feedback_requests();
  insert into _results values ('REQ-26 feedback requested the day after collection',
    exists (select 1 from public.notifications where order_id = o_collected and template = 'feedback_request'), null);

  insert into _results values ('feedback form offered', public.can_give_feedback(
    (select order_number from public.orders where order_id = o_collected), tok), null);
  perform public.submit_feedback((select order_number from public.orders where order_id = o_collected), tok, 5, 5, 4, 3, 'Yum!');
  insert into _results values ('REQ-26 feedback saved with taste, size, price',
    exists (select 1 from public.feedback where order_id = o_collected and rating = 5 and size_rating = 4 and price_rating = 3), null);
  begin
    perform public.submit_feedback((select order_number from public.orders where order_id = o_collected), tok, 1);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('feedback only once per order', got = 'already_given', got);
  begin
    perform public.submit_feedback((select order_number from public.orders where order_id = o_collected), repeat('x', 43), 5);
    got := 'allowed';
  exception when no_data_found then got := sqlerrm;
  end;
  insert into _results values ('feedback needs the order link', got = 'not_found', got);

  -- ------------------------------------------------------------ REQ-27 anonymise
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor, created_at)
  values ('Old Customer', '+27820000006', true, 'test', false, now() - interval '200 days') returning customer_id into c_old;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, special_notes)
  values (c_old, 'cash', this_monday, 'second_break', 1, 'no nuts please') returning order_id into o_old;
  update public.orders set order_status = 'cancelled' where order_id = o_old;
  update public.orders set status_changed_at = now() - interval '91 days' where order_id = o_old;

  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor, created_at)
  values ('Active Customer', '+27820000007', true, 'test', false, now() - interval '200 days') returning customer_id into c_active;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c_active, 'cash', this_monday, 'second_break', 1) returning order_id into o_active;

  perform private.job_anonymise();
  insert into _results values ('REQ-27 customer anonymised 90 days after last order',
    exists (select 1 from public.customers where customer_id = c_old and anonymised_at is not null
            and full_name = 'Anonymised customer' and phone_number not like '+27%'), null);
  insert into _results values ('REQ-27 order notes removed',
    (select special_notes is null from public.orders where order_id = o_old), null);
  insert into _results values ('customers with active orders are kept',
    exists (select 1 from public.customers where customer_id = c_active and anonymised_at is null), null);

  begin
    set local role authenticated;
    perform public.anonymise_customer_now(c_active);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  reset role;
  insert into _results values ('deletion request waits for active orders', got = 'has_active_orders', got);

  update public.orders set order_status = 'cancelled' where order_id = o_active;
  set local role authenticated;
  perform public.anonymise_customer_now(c_active);
  reset role;
  insert into _results values ('owner deletion request anonymises immediately',
    exists (select 1 from public.customers where customer_id = c_active and anonymised_at is not null), null);

  -- ------------------------------------------------------------ conversations
  insert into public.conversations (created_at) values (now() - interval '31 days'), (now() - interval '1 day');
  n := (select count(*) from public.conversations where created_at < now() - interval '30 days');
  perform private.job_delete_conversations();
  insert into _results values ('conversations older than 30 days deleted',
    not exists (select 1 from public.conversations where created_at < now() - interval '30 days')
    and exists (select 1 from public.conversations where created_at > now() - interval '2 days'), n::text);

  -- ------------------------------------------------------------ proof deletion rules
  update public.payments set proof_of_payment_path = 'test/old.jpg', paid_at = now() - interval '31 days'
   where order_id = o_paid;
  insert into _results values ('proof paid 31 days ago is due', private.proof_is_due('test/old.jpg'), null);
  update public.payments set paid_at = now() - interval '5 days' where order_id = o_paid;
  insert into _results values ('recent proof is kept', not private.proof_is_due('test/old.jpg'), null);
  begin
    perform public.due_proof_paths('wrong-secret');
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  insert into _results values ('due proof list needs the cron secret', got = 'refused', got);

  -- ------------------------------------------------------------ schedules
  insert into _results values ('all 8 jobs scheduled',
    (select count(*) from cron.job where jobname in ('owner-daily-summary', 'batch-summary', 'payment-reminders',
      'release-unpaid', 'feedback-requests', 'delete-proofs', 'anonymise-customers', 'delete-conversations')) = 8, null);
  insert into _results values ('15:00 SAST summary is 13:00 UTC',
    (select schedule from cron.job where jobname = 'owner-daily-summary') = '0 13 * * *', null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
