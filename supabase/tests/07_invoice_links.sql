-- DB test: private invoice links (D-053). Rolled back. Run: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  owner_id uuid := gen_random_uuid();
  c uuid;
  o uuid;
  d date := (select min(x) from private.collection_dates() x);
  ref text;
  share text;
  r jsonb;
  n int;
begin
  insert into auth.users (id, email, aud, role) values (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner');
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Link Test Person', '+27820000004', true, 'test', false) returning customer_id into c;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'eft', d, 'second_break', 2) returning order_id into o;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot)
  values (o, (select product_id from public.products where flavour = 'Funfetti'), 2, 10);

  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ref := public.approve_order(o)->>'payment_reference';
  select share_token into share from public.invoices where order_id = o;  -- owner can read it (RLS)
  reset role;

  insert into _results values ('approval gives the invoice a 43-character share token', share ~ '^[A-Za-z0-9_-]{43}$', null);
  insert into _results values ('every existing invoice has a token',
    not exists (select 1 from public.invoices where share_token is null), null);

  r := public.get_invoice_by_link(ref, share);
  insert into _results values ('share link opens that invoice', r->>'invoice_number' = ref and (r->>'total_amount')::numeric = 20, r->>'invoice_number');
  insert into _results values ('shared invoice shows first name only', r->>'first_name' = 'Link' and r::text not like '%Test Person%', r->>'first_name');
  insert into _results values ('wrong token opens nothing', public.get_invoice_by_link(ref, repeat('z', 43)) is null, null);
  insert into _results values ('token only works for its own invoice',
    public.get_invoice_by_link('KDP-9999-AAAA', share) is null, null);

  begin
    set local role anon;
    select count(*) into n from public.invoices;
    r := '{"read": true}';
  exception when insufficient_privilege then r := '{"read": false}';
  end;
  reset role;
  insert into _results values ('anon cannot read share tokens from the table', (r->>'read')::boolean = false, null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
