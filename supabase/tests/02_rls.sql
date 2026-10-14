-- DB test: row level security and role permissions (Security NFR, spec 7.8).
-- Simulates each role inside the database with SET LOCAL ROLE and JWT claims.
-- The HTTP-level check with the real publishable key is tests/rls-anon.test.ts.
-- Rolled back at the end. Run with: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to anon, authenticated;
create temp table _seq as select last_value, is_called from public.order_number_seq;

do $$
declare
  c uuid;
  o uuid;
  p uuid;
  owner_id uuid := gen_random_uuid();
  helper_id uuid := gen_random_uuid();
  stranger_id uuid := gen_random_uuid();
  tbl text;
  got boolean;
  n int;
begin
  -- Fixtures (as the migration owner, which bypasses RLS).
  insert into auth.users (id, email, aud, role)
  values (owner_id,    'owner@test.invalid',    'authenticated', 'authenticated'),
         (helper_id,   'helper@test.invalid',   'authenticated', 'authenticated'),
         (stranger_id, 'stranger@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner'), (helper_id, 'helper');

  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('RLS Customer', '+27829999999', true, 'test-v1', false) returning customer_id into c;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
  values (c, 'eft', date '2026-10-21', 'second_break', 3) returning order_id into o;
  insert into public.payments (order_id, amount) values (o, 45) returning payment_id into p;
  insert into public.conversations (customer_id) values (c);

  -- -------------------------------------------------------------------
  -- anon: no access to any table in public
  -- -------------------------------------------------------------------
  for tbl in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    begin
      set local role anon;
      execute format('select count(*) from public.%I', tbl);
      raise exception using errcode = 'P0099';
    exception
      when sqlstate 'P0099' then got := true;
      when insufficient_privilege then got := false;
    end;
    insert into _results values ('anon cannot read ' || tbl, not got, null);
  end loop;

  begin
    set local role anon;
    insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units)
    values (c, 'cash', date '2026-10-21', 'second_break', 1);
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then got := true;
    when insufficient_privilege then got := false;
  end;
  insert into _results values ('anon cannot insert orders', not got, null);

  -- anon may call the two public functions, and nothing in private.
  begin
    set local role anon;
    select count(*) into n from public.get_menu();
    raise exception using errcode = 'P0099', message = n::text;
  exception
    when sqlstate 'P0099' then got := true;
    when insufficient_privilege then got := false;
  end;
  insert into _results values ('anon can call get_menu()', got, null);

  begin
    set local role anon;
    perform public.health_check();
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then got := true;
    when insufficient_privilege then got := false;
  end;
  insert into _results values ('anon can call health_check()', got, null);

  begin
    set local role anon;
    perform private.is_owner();
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then got := true;
    when insufficient_privilege then got := false;
  end;
  insert into _results values ('anon cannot call private functions', not got, null);

  -- -------------------------------------------------------------------
  -- Signed-in user who is not staff: sees nothing
  -- -------------------------------------------------------------------
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', stranger_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select (select count(*) from public.orders) + (select count(*) from public.customers)
         + (select count(*) from public.payments) + (select count(*) from public.conversations)
      into n;
    raise exception using errcode = 'P0099', message = n::text;
  exception when sqlstate 'P0099' then n := sqlerrm::int;
  end;
  insert into _results values ('non-staff user sees no rows', n = 0, n::text);

  -- -------------------------------------------------------------------
  -- Helper: read orders, update payment status only
  -- -------------------------------------------------------------------
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.orders where order_id = o;
    raise exception using errcode = 'P0099', message = n::text;
  exception when sqlstate 'P0099' then n := sqlerrm::int;
  end;
  insert into _results values ('helper can read orders', n = 1, n::text);

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.orders set order_status = 'confirmed' where order_id = o;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0099', message = n::text;
  exception when sqlstate 'P0099' then n := sqlerrm::int;
  end;
  insert into _results values ('helper cannot update orders', n = 0, n::text || ' rows updated');

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.payments set payment_status = 'paid' where payment_id = p;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0099', message = n::text;
  exception when sqlstate 'P0099' then n := sqlerrm::int;
  end;
  insert into _results values ('helper can mark payment paid (REQ-17)', n = 1, n::text || ' rows updated');

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.payments set amount = 1 where payment_id = p;
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then got := true;
    when insufficient_privilege then got := false;
  end;
  insert into _results values ('helper cannot change payment amount', not got, null);

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.conversations;
    raise exception using errcode = 'P0099', message = n::text;
  exception when sqlstate 'P0099' then n := sqlerrm::int;
  end;
  insert into _results values ('helper cannot read conversations', n = 0, n::text);

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.staff_roles (user_id, role) values (stranger_id, 'owner');
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then got := true;
    when insufficient_privilege then got := false;
  end;
  insert into _results values ('helper cannot grant roles', not got, null);

  -- -------------------------------------------------------------------
  -- Owner: full access
  -- -------------------------------------------------------------------
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.orders set order_status = 'confirmed' where order_id = o;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0099', message = n::text;
  exception when sqlstate 'P0099' then n := sqlerrm::int;
  end;
  insert into _results values ('owner can approve orders', n = 1, n::text || ' rows updated');

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.conversations;
    raise exception using errcode = 'P0099', message = n::text;
  exception when sqlstate 'P0099' then n := sqlerrm::int;
  end;
  insert into _results values ('owner can read conversations', n >= 1, n::text);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
