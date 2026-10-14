-- DB test: order capture (spec 7.1). REQ-01, REQ-02, REQ-03, REQ-05, REQ-06,
-- REQ-07, REQ-08, REQ-09, REQ-10, status link token, cut-off and phone rules.
-- Rolled back at the end. Run with: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to anon;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  d date := (select min(x) from private.collection_dates() x);
  week date;
  belgian uuid := (select product_id from public.products where flavour = 'Belgian Chocolate');
  funfetti uuid := (select product_id from public.products where flavour = 'Funfetti');
  tok text := repeat('a', 43);
  base jsonb;
  r jsonb;
  r2 jsonb;
  n_customers int := (select count(*) from public.customers);
  n_orders int := (select count(*) from public.orders);
  oid uuid;
begin
  week := d - (extract(isodow from d)::int - 1);
  -- Plenty of room this week unless a test lowers it.
  insert into public.weekly_capacity (week_start, unit_cap) values (week, 1000)
  on conflict (week_start) do update set unit_cap = 1000;

  base := jsonb_build_object(
    'full_name', 'Thandi Test',
    'phone', '082 123 4567',
    'language', 'xh',
    'consent_given', true,
    'consent_version', 'test-v1',
    'is_minor', false,
    'items', jsonb_build_array(
      jsonb_build_object('product_id', belgian, 'quantity', 2, 'unit_price', 0.01),  -- client price ignored
      jsonb_build_object('product_id', funfetti, 'quantity', 3)
    ),
    'collection_date', d,
    'collection_slot', 'second_break',
    'payment_method', 'eft'
  );

  -- ------------------------------------------------------------------ REQ-05
  r := public.place_order(jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                             'consent_given', true, 'consent_version', 'v', 'is_minor', false));
  insert into _results values ('REQ-05 empty submission rejected', (r->>'ok')::boolean = false, r->>'errors');
  insert into _results values ('REQ-05 reports missing name, phone, items, payment',
    (r->'errors') ?& array['full_name', 'phone', 'items', 'payment_method'], r->>'errors');
  insert into _results values ('REQ-05 nothing saved on rejection',
    (select count(*) from public.customers) = n_customers and (select count(*) from public.orders) = n_orders, null);

  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok, 'full_name', '   '));
  insert into _results values ('REQ-05 blank name rejected', r->'errors'->>'full_name' = 'required', r->>'errors');

  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok, 'phone', '12345'));
  insert into _results values ('invalid phone rejected', r->'errors'->>'phone' = 'invalid', r->>'errors');

  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                     'items', jsonb_build_array(jsonb_build_object('product_id', gen_random_uuid(), 'quantity', 1))));
  insert into _results values ('unknown flavour rejected', r->'errors'->>'items' = 'unavailable', r->>'errors');

  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                     'items', jsonb_build_array(jsonb_build_object('product_id', belgian, 'quantity', 0))));
  insert into _results values ('zero quantity rejected', r->'errors'->>'items' = 'required', r->>'errors');

  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                     'collection_date', d - 7));
  insert into _results values ('closed collection date rejected', r->'errors'->>'collection_date' = 'closed', r->>'errors');

  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                     'special_notes', repeat('x', 281)));
  insert into _results values ('notes over 280 chars rejected', r->'errors'->>'special_notes' = 'too_long', r->>'errors');

  r := public.place_order(base || jsonb_build_object('order_id', 'not-a-uuid', 'access_token', 'short'));
  insert into _results values ('bad order id and token rejected',
    (r->'errors') ?& array['order_id', 'access_token'], r->>'errors');

  -- ------------------------------------------------------------------ REQ-01 consent
  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok, 'consent_given', false));
  insert into _results values ('REQ-01 no consent rejected', r->'errors'->>'consent_given' = 'required', r->>'errors');

  r := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok, 'is_minor', true));
  insert into _results values ('under-18 without guardian consent rejected', r->'errors'->>'guardian_consent' = 'required', r->>'errors');
  insert into _results values ('consent failures save nothing',
    (select count(*) from public.customers) = n_customers and (select count(*) from public.orders) = n_orders, null);

  -- ------------------------------------------------------------------ happy path
  oid := gen_random_uuid();
  r := public.place_order(base || jsonb_build_object('order_id', oid, 'access_token', tok));
  insert into _results values ('valid order accepted', (r->>'ok')::boolean, r->>'errors');
  insert into _results values ('REQ-08 order number assigned', r->>'order_number' ~ '^KDP-[0-9]{4,}$', r->>'order_number');
  insert into _results values ('new order is pending', r->>'order_status' = 'pending', r->>'order_status');
  insert into _results values ('REQ-03 customer created with E.164 phone',
    exists (select 1 from public.customers where phone_number = '+27821234567' and full_name = 'Thandi Test'), null);
  insert into _results values ('REQ-01 consent version stored',
    exists (select 1 from public.customers where phone_number = '+27821234567' and consent_version = 'test-v1' and consent_given), null);
  insert into _results values ('language stored', exists (select 1 from public.customers where phone_number = '+27821234567' and preferred_language = 'xh'), null);
  insert into _results values ('prices taken from products, not the browser',
    (r->>'total_amount')::numeric = 2 * 15 + 3 * 10, r->>'total_amount');
  insert into _results values ('total units stored', (r->>'total_units')::int = 5, r->>'total_units');
  insert into _results values ('summary masks phone', r->>'phone_masked' = '******4567', r->>'phone_masked');
  insert into _results values ('summary shows first name only', r->>'first_name' = 'Thandi', r->>'first_name');
  insert into _results values ('REQ-10 acknowledgement recorded',
    exists (select 1 from public.notifications where order_id = oid and template = 'acknowledgement' and channel = 'in_app'), null);
  insert into _results values ('status link token stored only as a hash',
    exists (select 1 from public.orders where order_id = oid and access_token_hash = private.hash_token(tok) and access_token_hash <> tok), null);

  -- ------------------------------------------------------------------ REQ-09 idempotency
  r2 := public.place_order(base || jsonb_build_object('order_id', oid, 'access_token', tok));
  r2 := public.place_order(base || jsonb_build_object('order_id', oid, 'access_token', tok));
  insert into _results values ('REQ-09 same order id 3 times gives one order',
    (select count(*) from public.orders where order_id = oid) = 1 and (select count(*) from public.order_items where order_id = oid) = 2, null);
  insert into _results values ('REQ-09 retry returns same order number',
    r2->>'order_number' = r->>'order_number' and (r2->>'duplicate')::boolean, r2->>'order_number');

  r2 := public.place_order(base || jsonb_build_object('order_id', oid, 'access_token', repeat('b', 43)));
  insert into _results values ('REQ-09 same order id with another token refused', r2->'errors'->>'order_id' = 'conflict', r2->>'errors');

  -- ------------------------------------------------------------------ REQ-02 lookup
  r2 := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                      'phone', '+27 82 123 4567', 'full_name', 'Thandi T'));
  insert into _results values ('REQ-02 same phone in another format finds the same customer',
    (select count(*) from public.customers where phone_number = '+27821234567') = 1
    and (select count(*) from public.orders o join public.customers c using (customer_id) where c.phone_number = '+27821234567') = 2, null);

  -- ------------------------------------------------------------------ REQ-07 large orders
  r2 := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                      'items', jsonb_build_array(jsonb_build_object('product_id', funfetti, 'quantity', 31))));
  insert into _results values ('REQ-07 31 units flagged as large order', (r2->>'is_large_order')::boolean, r2->>'total_units');
  insert into _results values ('REQ-07 large order gets quote_pending message',
    r2->'messages'->0->>'template' = 'quote_pending', r2->'messages'->0->>'template');

  r2 := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                      'items', jsonb_build_array(jsonb_build_object('product_id', funfetti, 'quantity', 30))));
  insert into _results values ('REQ-07 exactly 30 units is not large', not (r2->>'is_large_order')::boolean, r2->>'total_units');

  -- ------------------------------------------------------------------ REQ-06 weekly cap
  -- Used so far this week: 5 + 5 + 31 + 30 = 71. Cap at 75: 4 fit, 5 do not.
  update public.weekly_capacity set unit_cap = 75 where week_start = week;
  r2 := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                      'items', jsonb_build_array(jsonb_build_object('product_id', funfetti, 'quantity', 4))));
  insert into _results values ('REQ-06 order that fits the cap is pending', r2->>'order_status' = 'pending', r2->>'order_status');
  r2 := public.place_order(base || jsonb_build_object('order_id', gen_random_uuid(), 'access_token', tok,
                                                      'items', jsonb_build_array(jsonb_build_object('product_id', funfetti, 'quantity', 1))));
  insert into _results values ('REQ-06 order over the cap is waitlisted', r2->>'order_status' = 'waitlisted', r2->>'order_status');
  insert into _results values ('REQ-06 waitlisted message recorded', r2->'messages'->0->>'template' = 'waitlisted', null);

  -- ------------------------------------------------------------------ status link
  insert into _results values ('status with correct token returns order',
    public.get_order_status(r->>'order_number', tok)->>'order_number' = r->>'order_number', null);
  insert into _results values ('status with wrong token returns nothing',
    public.get_order_status(r->>'order_number', repeat('c', 43)) is null, null);
  insert into _results values ('status lookup ignores case and spaces',
    public.get_order_status(' ' || lower(r->>'order_number') || ' ', tok) is not null, null);

  -- anon can call the order functions (and nothing else, see 02_rls.sql)
  begin
    set local role anon;
    perform public.get_order_options();
    perform public.place_order('{}'::jsonb);
    perform public.get_order_status('KDP-0001', tok);
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then insert into _results values ('anon can call order functions', true, null);
    when insufficient_privilege then insert into _results values ('anon can call order functions', false, sqlerrm);
  end;

  -- ------------------------------------------------------------------ helpers
  insert into _results values
    ('phone 0821234567', private.normalise_za_phone('0821234567') = '+27821234567', null),
    ('phone 082 123 4567', private.normalise_za_phone('082 123 4567') = '+27821234567', null),
    ('phone +27 82 123 4567', private.normalise_za_phone('+27 82 123 4567') = '+27821234567', null),
    ('phone 27821234567', private.normalise_za_phone('27821234567') = '+27821234567', null),
    ('phone too short is null', private.normalise_za_phone('082123') is null, null),
    ('phone foreign is null', private.normalise_za_phone('+44 20 7946 0958') is null, null),
    -- Thursday 2026-10-15 is in the week of Monday 2026-10-12.
    ('before Thu 20:00 SAST: next week open',
      private.first_open_week('2026-10-15 19:59+02') = date '2026-10-19', private.first_open_week('2026-10-15 19:59+02')::text),
    ('after Thu 20:00 SAST: week after next',
      private.first_open_week('2026-10-15 20:01+02') = date '2026-10-26', private.first_open_week('2026-10-15 20:01+02')::text),
    ('collection dates are weekdays only',
      not exists (select 1 from private.collection_dates() x where extract(isodow from x) > 5), null),
    ('get_order_options lists 10 school days by default',
      jsonb_array_length(public.get_order_options()->'collection_dates') = 10, null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
