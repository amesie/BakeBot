-- DB test: dashboard actions (Phase 4). REQ-07, REQ-12, REQ-13, REQ-14,
-- REQ-17, REQ-19 and role checks. Rolled back at the end. Run: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to authenticated, anon;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  owner_id uuid := gen_random_uuid();
  helper_id uuid := gen_random_uuid();
  stranger_id uuid := gen_random_uuid();
  c uuid;
  d date := (select min(x) from private.collection_dates() x);
  week date;
  belgian uuid := (select product_id from public.products where flavour = 'Belgian Chocolate');
  o_cash uuid; o_eft uuid; o_large uuid; o_wait uuid; o_decline uuid; o_baking uuid;
  r jsonb;
  ref text;
  got text;
  n int;
begin
  week := d - (extract(isodow from d)::int - 1);

  insert into auth.users (id, email, aud, role) values
    (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated'),
    (helper_id, 'helper@test.invalid', 'authenticated', 'authenticated'),
    (stranger_id, 'stranger@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner'), (helper_id, 'helper');

  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Owner Test', '+27820000001', true, 'test', false) returning customer_id into c;

  -- Orders: 3 x Belgian (R15) = R45 unless noted.
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', d, 'second_break', 3) returning order_id into o_cash;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'eft', d, 'after_school', 3) returning order_id into o_eft;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, is_large_order)
  values (c, 'eft', d, 'second_break', 40, true) returning order_id into o_large;
  insert into public.orders (customer_id, order_status, payment_method, collection_date, collection_slot, total_units)
  values (c, 'waitlisted', 'cash', d, 'second_break', 3) returning order_id into o_wait;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', d, 'second_break', 3) returning order_id into o_decline;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot)
  select x, belgian, case when x = o_large then 40 else 3 end, 15
  from unnest(array[o_cash, o_eft, o_large, o_wait, o_decline]) as x;

  -- ------------------------------------------------------------- role checks
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.approve_order(o_cash);
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('helper cannot approve orders', got = 'refused', got);

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', stranger_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.decline_order(o_cash);
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('non-staff cannot decline orders', got = 'refused', got);

  begin
    set local role anon;
    perform public.mark_paid(o_cash);
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('anon cannot call dashboard actions', got = 'refused', got);

  -- ------------------------------------------------------------- approve (owner)
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.approve_order(o_cash);
  reset role;
  ref := r->>'payment_reference';
  insert into _results values ('REQ-14 payment reference format KDP-0000-XXXX',
    ref ~ '^KDP-[0-9]{4,}-[A-HJKMNP-Z2-9]{4}$', ref);
  insert into _results values ('approve sets confirmed and stores reference',
    exists (select 1 from public.orders where order_id = o_cash and order_status = 'confirmed' and payment_reference = ref), null);
  insert into _results values ('REQ-14 unpaid payment for the item total',
    exists (select 1 from public.payments where order_id = o_cash and payment_status = 'unpaid' and amount = 45), null);
  insert into _results values ('REQ-14 invoice numbered with the reference',
    exists (select 1 from public.invoices where order_id = o_cash and invoice_number = ref and total_amount = 45), null);
  insert into _results values ('REQ-12 cash confirmation has day, slot, place and amount',
    exists (select 1 from public.notifications where order_id = o_cash and template = 'confirmation_cash'
            and params ?& array['date', 'slot', 'place', 'amount']), null);

  set local role authenticated;
  r := public.approve_order(o_eft);
  reset role;
  insert into _results values ('REQ-12 EFT confirmation includes the reference',
    exists (select 1 from public.notifications where order_id = o_eft and template = 'confirmation_eft'
            and params->>'reference' = r->>'payment_reference'), null);

  begin
    set local role authenticated;
    perform public.approve_order(o_cash);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  reset role;
  insert into _results values ('cannot approve twice', got = 'not_pending', got);

  -- REQ-07: large orders need a quote
  begin
    set local role authenticated;
    perform public.approve_order(o_large);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  reset role;
  insert into _results values ('REQ-07 large order cannot be approved without a quote', got = 'quote_required', got);

  set local role authenticated;
  r := public.approve_order(o_large, 450);
  reset role;
  insert into _results values ('REQ-07 quote becomes the amount owed',
    (r->>'amount')::numeric = 450 and exists (select 1 from public.payments where order_id = o_large and amount = 450), r->>'amount');

  set local role authenticated;
  perform public.approve_order(o_wait);
  reset role;
  insert into _results values ('owner can approve a waitlisted order',
    exists (select 1 from public.orders where order_id = o_wait and order_status = 'confirmed'), null);

  -- ------------------------------------------------------------- decline
  set local role authenticated;
  perform public.decline_order(o_decline);
  reset role;
  insert into _results values ('REQ-13 decline cancels and sends a polite message',
    exists (select 1 from public.orders where order_id = o_decline and order_status = 'cancelled')
    and exists (select 1 from public.notifications where order_id = o_decline and template = 'declined'), null);

  -- ------------------------------------------------------------- REQ-17 mark paid (helper)
  perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_paid(o_cash);
  reset role;
  insert into _results values ('REQ-17 helper marks paid; time and person recorded',
    exists (select 1 from public.payments where order_id = o_cash and payment_status = 'paid'
            and paid_at is not null and marked_paid_by = helper_id), null);
  insert into _results values ('customer told payment was received',
    exists (select 1 from public.notifications where order_id = o_cash and template = 'payment_received'), null);

  begin
    set local role authenticated;
    perform public.mark_paid(o_cash);
    got := 'allowed';
  exception when no_data_found then got := sqlerrm;
  end;
  reset role;
  insert into _results values ('cannot mark paid twice', got = 'no_unpaid_payment', got);

  begin
    set local role authenticated;
    perform public.advance_week(week, 'baking');
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('helper cannot move a batch', got = 'refused', got);

  -- ------------------------------------------------------------- batch steps (owner)
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  n := public.advance_week(week, 'baking');
  reset role;
  insert into _results values ('week moved to baking (4 confirmed orders)', n = 4, n::text);

  set local role authenticated;
  n := public.advance_week(week, 'ready');
  reset role;
  insert into _results values ('week moved to ready', n = 4, n::text);
  insert into _results values ('ready message sent with place',
    (select count(*) from public.notifications where template = 'ready' and params ? 'place'
       and order_id in (o_cash, o_eft, o_large, o_wait)) = 4, null);

  -- REQ-19: delay
  begin
    set local role authenticated;
    perform public.delay_batch(week, week + 5);  -- Saturday
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  reset role;
  insert into _results values ('REQ-19 delay to a weekend refused', got = 'invalid_date', got);

  set local role authenticated;
  n := public.delay_batch(week, week + 7);
  reset role;
  insert into _results values ('REQ-19 delay sets a new date on the week''s orders',
    n = 4 and (select count(*) from public.orders where collection_week = week and revised_collection_date = week + 7) = 4, n::text);
  insert into _results values ('REQ-19 customers told the new date',
    (select count(*) from public.notifications where template = 'delayed' and params->>'date' = (week + 7)::text) = 4, null);

  -- Handover (helper)
  perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_collected(o_cash);
  reset role;
  insert into _results values ('helper marks a ready order collected',
    exists (select 1 from public.orders where order_id = o_cash and order_status = 'collected'), null);

  begin
    set local role authenticated;
    perform public.mark_collected(o_decline);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  reset role;
  insert into _results values ('only ready orders can be collected', got = 'not_ready', got);

  -- Customer status page shows the new information
  insert into _results values ('status summary shows reference and place after approval',
    (private.order_summary(o_eft)->>'payment_reference') is not null
    and (private.order_summary(o_eft)->>'collection_place') is not null, null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
