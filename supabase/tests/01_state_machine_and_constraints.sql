-- DB test: order/payment state machines, REQ-08 order numbers and data
-- constraints (REQ-01, REQ-05 at DB level, consent and under-18 rules).
-- Runs in a transaction that is rolled back; the last statement returns one
-- row per check with ok = true/false. Run with: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  c uuid;
  o uuid;
  p uuid;
  s public.order_status;
  t public.order_status;
  ps public.payment_status;
  pt public.payment_status;
  got boolean;
  -- Expected legal transitions, written out by hand (not derived from the
  -- function under test).
  allowed_orders text[] := array[
    'waitlisted>pending', 'waitlisted>cancelled',
    'pending>confirmed', 'pending>cancelled',
    'confirmed>baking', 'confirmed>cancelled',
    'baking>ready',
    'ready>collected'
  ];
  allowed_payments text[] := array[
    'unpaid>pending_review', 'unpaid>paid',
    'pending_review>paid', 'pending_review>unpaid'
  ];
  n text;
begin
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Test Customer', '+27821234567', true, 'test-v1', false)
  returning customer_id into c;

  -- ---------------------------------------------------------------------
  -- Order state machine: every (from, to) pair
  -- ---------------------------------------------------------------------
  foreach s in array enum_range(null::public.order_status) loop
    foreach t in array enum_range(null::public.order_status) loop
      continue when t = s;

      insert into public.orders (customer_id, order_status, payment_method, collection_date, collection_slot, total_units)
      values (c, case when s = 'waitlisted' then 'waitlisted'::public.order_status else 'pending' end,
              'cash', date '2026-10-21', 'second_break', 5)
      returning order_id into o;

      -- Walk legal steps to reach the "from" state.
      if s = 'cancelled' then
        update public.orders set order_status = 'cancelled' where order_id = o;
      elsif s in ('confirmed', 'baking', 'ready', 'collected') then
        update public.orders set order_status = 'confirmed' where order_id = o;
        if s in ('baking', 'ready', 'collected') then
          update public.orders set order_status = 'baking' where order_id = o;
        end if;
        if s in ('ready', 'collected') then
          update public.orders set order_status = 'ready' where order_id = o;
        end if;
        if s = 'collected' then
          update public.orders set order_status = 'collected' where order_id = o;
        end if;
      end if;

      begin
        update public.orders set order_status = t where order_id = o;
        raise exception using errcode = 'P0099';  -- undo, but record success
      exception
        when sqlstate 'P0099' then got := true;
        when check_violation then got := false;
      end;

      insert into _results values (
        'order ' || s || ' -> ' || t,
        got = ((s || '>' || t) = any (allowed_orders)),
        case when got then 'allowed' else 'rejected' end
      );
    end loop;
  end loop;

  -- REQ-20: ready -> cancelled is allowed once the order is released.
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', date '2026-10-21', 'after_school', 5) returning order_id into o;
  update public.orders set order_status = 'confirmed' where order_id = o;
  update public.orders set order_status = 'baking' where order_id = o;
  update public.orders set order_status = 'ready' where order_id = o;
  begin
    update public.orders set order_status = 'cancelled', released_at = now() where order_id = o;
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('order ready -> cancelled when released (REQ-20)', got, null);

  -- New orders can only start as pending or waitlisted.
  begin
    insert into public.orders (customer_id, order_status, payment_method, collection_date, collection_slot, total_units)
    values (c, 'confirmed', 'cash', date '2026-10-21', 'second_break', 5);
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('order cannot be inserted as confirmed', not got, null);

  -- ---------------------------------------------------------------------
  -- Payment state machine: every (from, to) pair
  -- ---------------------------------------------------------------------
  foreach ps in array enum_range(null::public.payment_status) loop
    foreach pt in array enum_range(null::public.payment_status) loop
      continue when pt = ps;

      insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
      values (c, 'eft', date '2026-10-21', 'second_break', 5) returning order_id into o;
      insert into public.payments (order_id, amount) values (o, 50) returning payment_id into p;
      if ps in ('pending_review', 'paid') then
        update public.payments set payment_status = 'pending_review' where payment_id = p;
      end if;
      if ps = 'paid' then
        update public.payments set payment_status = 'paid' where payment_id = p;
      end if;

      begin
        update public.payments set payment_status = pt where payment_id = p;
        raise exception using errcode = 'P0099';
      exception
        when sqlstate 'P0099' then got := true;
        when check_violation then got := false;
      end;

      insert into _results values (
        'payment ' || ps || ' -> ' || pt,
        got = ((ps || '>' || pt) = any (allowed_payments)),
        case when got then 'allowed' else 'rejected' end
      );
    end loop;
  end loop;

  -- REQ-17: marking paid records the time.
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', date '2026-10-21', 'second_break', 5) returning order_id into o;
  insert into public.payments (order_id, amount) values (o, 50) returning payment_id into p;
  update public.payments set payment_status = 'paid' where payment_id = p;
  insert into _results
  select 'payment marked paid sets paid_at (REQ-17)', paid_at is not null, null
  from public.payments where payment_id = p;

  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'cash', date '2026-10-21', 'second_break', 5) returning order_id into o;
  begin
    insert into public.payments (order_id, amount, payment_status, paid_at)
    values (o, 10, 'paid', now());
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('payment cannot be inserted as paid', not got, null);

  -- ---------------------------------------------------------------------
  -- REQ-08: order numbers
  -- ---------------------------------------------------------------------
  insert into _results values
    ('order number format KDP-0042', private.format_order_number(42) = 'KDP-0042', private.format_order_number(42)),
    ('order number grows past 9999', private.format_order_number(12345) = 'KDP-12345', private.format_order_number(12345));

  select order_number into n from public.orders where order_id = o;
  insert into _results values ('inserted order gets KDP number', n ~ '^KDP-[0-9]{4,}$', n);

  begin
    update public.orders set order_number = 'KDP-9999' where order_id = o;
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('order number cannot change', not got, null);

  -- Collection week is the Monday of the collection date.
  insert into _results
  select 'collection_week is Monday of collection_date', collection_week = date '2026-10-19', collection_week::text
  from public.orders where order_id = o;

  begin
    insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
    values (c, 'cash', date '2026-10-24', 'second_break', 5);  -- Saturday
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('collection on a weekend rejected', not got, null);

  begin
    insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, special_notes)
    values (c, 'cash', date '2026-10-21', 'second_break', 5, repeat('x', 281));
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('special notes over 280 chars rejected', not got, null);

  -- ---------------------------------------------------------------------
  -- REQ-01 and POPIA rules on customers
  -- ---------------------------------------------------------------------
  begin
    insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
    values ('No Consent', '+27821111111', false, 'test-v1', false);
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('customer without consent rejected (REQ-01)', not got, null);

  begin
    insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor, guardian_consent)
    values ('Minor', '+27822222222', true, 'test-v1', true, false);
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('under-18 without guardian consent rejected', not got, null);

  begin
    insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor, guardian_consent)
    values ('Minor With Guardian', '+27823333333', true, 'test-v1', true, true);
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('under-18 with guardian consent accepted', got, null);

  begin
    insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
    values ('Local Format', '0824444444', true, 'test-v1', false);
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('phone must be E.164 +27', not got, null);

  begin
    insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
    values ('   ', '+27825555555', true, 'test-v1', false);
    got := true;
  exception when check_violation then got := false;
  end;
  insert into _results values ('blank name rejected (REQ-05)', not got, null);
end;
$$;

-- Give back the order numbers used by this test (nextval ignores rollback).
select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
