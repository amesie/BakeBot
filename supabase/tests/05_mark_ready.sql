-- DB test: mark ready one order at a time, and "All ready" including orders
-- that skipped "Start baking". Rolled back at the end. Run: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to authenticated, anon;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  owner_id uuid := gen_random_uuid();
  helper_id uuid := gen_random_uuid();
  c uuid;
  d date := (select min(x) from private.collection_dates() x);
  week date;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid;
  got text;
  n int;
begin
  week := d - (extract(isodow from d)::int - 1);
  insert into auth.users (id, email, aud, role) values
    (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated'),
    (helper_id, 'helper@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner'), (helper_id, 'helper');
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Ready Test', '+27820000002', true, 'test', false) returning customer_id into c;

  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', d, 'second_break', 2) returning order_id into o1;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', d, 'second_break', 2) returning order_id into o2;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', d, 'second_break', 2) returning order_id into o3;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', d, 'second_break', 2) returning order_id into o4;
  update public.orders set order_status = 'confirmed' where order_id in (o1, o2, o3, o4);
  update public.orders set order_status = 'baking' where order_id = o2;

  -- helper may not
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.mark_ready(o1);
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('helper cannot mark ready', got = 'refused', got);

  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);

  -- confirmed -> ready in one tap
  set local role authenticated;
  perform public.mark_ready(o1);
  reset role;
  insert into _results values ('one confirmed order marked ready',
    exists (select 1 from public.orders where order_id = o1 and order_status = 'ready'), null);
  insert into _results values ('that customer gets the ready message',
    (select count(*) from public.notifications where order_id = o1 and template = 'ready') = 1, null);
  insert into _results values ('other orders untouched',
    (select count(*) from public.orders where order_id in (o3, o4) and order_status = 'confirmed') = 2, null);

  -- baking -> ready
  set local role authenticated;
  perform public.mark_ready(o2);
  reset role;
  insert into _results values ('one baking order marked ready',
    exists (select 1 from public.orders where order_id = o2 and order_status = 'ready'), null);

  -- already ready -> refused
  begin
    set local role authenticated;
    perform public.mark_ready(o1);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  reset role;
  insert into _results values ('cannot mark ready twice (no second message)', got = 'not_bakeable', got);

  -- All ready takes the remaining confirmed orders (no Start baking needed)
  set local role authenticated;
  n := public.advance_week(week, 'ready');
  reset role;
  insert into _results values ('All ready includes confirmed orders', n = 2, n::text);
  insert into _results values ('every order ready, one message each',
    (select count(*) from public.orders where order_id in (o1, o2, o3, o4) and order_status = 'ready') = 4
    and (select count(*) from public.notifications where order_id in (o1, o2, o3, o4) and template = 'ready') = 4, null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
