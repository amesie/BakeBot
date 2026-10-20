-- DB test: customer email, cancelling, email log (D-070, D-071).
-- Rolled back. Run: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to anon, authenticated;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  owner_id uuid := gen_random_uuid();
  helper_id uuid := gen_random_uuid();
  c uuid;
  d date := (select min(x) from private.collection_dates() x);
  tok text := repeat('e', 43);
  o1 uuid; o2 uuid; o3 uuid; o4 uuid;
  n1 text; n2 text; n3 text; n4 text;
  r jsonb;
  got text;
  n int;
begin
  insert into auth.users (id, email, aud, role) values
    (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated'),
    (helper_id, 'helper@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner'), (helper_id, 'helper');
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Email Test', '+27820000010', true, 'test', false) returning customer_id into c;

  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, access_token_hash)
  values (c, 'eft', d, 'second_break', 2, private.hash_token(tok)) returning order_id, order_number into o1, n1;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, access_token_hash)
  values (c, 'cash', d, 'second_break', 2, private.hash_token(tok)) returning order_id, order_number into o2, n2;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, access_token_hash)
  values (c, 'cash', d, 'second_break', 2, private.hash_token(tok)) returning order_id, order_number into o3, n3;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, access_token_hash)
  values (c, 'eft', d, 'second_break', 2, private.hash_token(tok)) returning order_id, order_number into o4, n4;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot)
  select x, (select product_id from public.products where flavour = 'Funfetti'), 2, 10 from unnest(array[o1, o2, o3, o4]) x;

  -- ------------------------------------------------------------ email
  set local role anon;
  perform public.set_order_email(n1, tok, '  Thandi@Example.com ');
  reset role;
  insert into _results values ('email saved lower-case and trimmed',
    (select email from public.customers where customer_id = c) = 'thandi@example.com', null);

  perform public.set_order_email(n1, tok, '');
  insert into _results values ('blank email keeps the saved address',
    (select email from public.customers where customer_id = c) = 'thandi@example.com', null);

  begin
    perform public.set_order_email(n1, tok, 'not-an-email');
    got := 'allowed';
  exception when check_violation then got := 'refused';
  end;
  insert into _results values ('invalid email refused', got = 'refused', got);

  begin
    perform public.set_order_email(n1, repeat('x', 43), 'x@y.co');
    got := 'allowed';
  exception when no_data_found then got := sqlerrm;
  end;
  insert into _results values ('email needs the order link', got = 'not_found', got);

  -- ------------------------------------------------------------ cancelling (D-071)
  set local role anon;
  r := public.cancel_order(n2, tok);
  reset role;
  insert into _results values ('pending order cancelled by the customer',
    (select order_status from public.orders where order_id = o2) = 'cancelled', r->>'order_status');
  insert into _results values ('cancel returns the email to send to', r->>'email' = 'thandi@example.com', r->>'email');
  insert into _results values ('customer and Kaydee told',
    exists (select 1 from public.notifications where order_id = o2 and template = 'cancelled_by_customer')
    and exists (select 1 from public.notifications where template = 'owner_customer_cancelled'
                and params->>'order_number' = n2), null);

  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.approve_order(o3);
  perform public.approve_order(o1);
  perform public.approve_order(o4);
  reset role;
  r := public.cancel_order(n3, tok);
  insert into _results values ('approved, unpaid order can still be cancelled',
    (select order_status from public.orders where order_id = o3) = 'cancelled', null);

  update public.payments set payment_status = 'pending_review' where order_id = o4;
  begin
    perform public.cancel_order(n4, tok);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('after paying, customer must contact Kaydee', got = 'paid_contact_kaydee', got);

  update public.orders set order_status = 'baking' where order_id = o1;
  begin
    perform public.cancel_order(n1, tok);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('cannot cancel once baking', got = 'too_late', got);

  begin
    perform public.cancel_order(n1, repeat('x', 43));
    got := 'allowed';
  exception when no_data_found then got := sqlerrm;
  end;
  insert into _results values ('cancelling needs the order link', got = 'not_found', got);

  -- ------------------------------------------------------------ email log
  set local role anon;
  perform public.log_order_email(n2, tok, 'order_received', 'sent', 1);
  begin
    select count(*) into n from public.email_log;
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('send logged; public key cannot read the log', got = 'refused', got);
  insert into _results values ('log row stored without address',
    exists (select 1 from public.email_log where order_id = o2 and template = 'order_received' and status = 'sent'), null);

  perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.email_log;
  reset role;
  insert into _results values ('helper cannot read the email log', n = 0, n::text);

  -- ------------------------------------------------------------ POPIA
  perform private.anonymise_customer(c);
  insert into _results values ('anonymisation removes the email',
    (select email is null from public.customers where customer_id = c), null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
