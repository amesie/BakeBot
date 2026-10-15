-- DB test: proof of payment uploads (REQ-15), reject proof, invoice data
-- (REQ-14) and storage policies. Rolled back at the end. Run: npm run test:db

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
  tok text := repeat('p', 43);
  o_pending uuid; o_eft uuid;
  n_pending text; n_eft text;
  v_path text;
  got text;
  ok boolean;
  r jsonb;
  n int;
begin
  insert into auth.users (id, email, aud, role) values
    (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated'),
    (helper_id, 'helper@test.invalid', 'authenticated', 'authenticated'),
    (stranger_id, 'stranger@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner'), (helper_id, 'helper');
  insert into public.customers (full_name, phone_number, consent_given, consent_version, is_minor)
  values ('Proof Test', '+27820000003', true, 'test', false) returning customer_id into c;

  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, access_token_hash)
  values (c, 'eft', d, 'second_break', 2, private.hash_token(tok)) returning order_id, order_number into o_pending, n_pending;
  insert into public.orders (customer_id, payment_method, collection_date, collection_slot, total_units, access_token_hash)
  values (c, 'eft', d, 'second_break', 2, private.hash_token(tok)) returning order_id, order_number into o_eft, n_eft;
  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot)
  select x, (select product_id from public.products where flavour = 'Funfetti'), 2, 10
  from unnest(array[o_pending, o_eft]) as x;

  -- approve one as the owner (creates payment + invoice)
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.approve_order(o_eft);
  reset role;

  -- ------------------------------------------------------------- refusals
  begin
    perform public.start_proof_upload(n_eft, repeat('x', 43), 'jpg');
    got := 'allowed';
  exception when no_data_found then got := sqlerrm;
  end;
  insert into _results values ('wrong token cannot upload', got = 'not_found', got);

  begin
    perform public.start_proof_upload(n_pending, tok, 'jpg');
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('cannot upload before Kaydee approves (flagged)', got = 'not_approved', got);

  begin
    perform public.start_proof_upload(n_eft, tok, 'exe');
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('only images and PDFs', got = 'bad_type', got);

  -- ------------------------------------------------------------- grant + storage policy
  v_path := public.start_proof_upload(n_eft, tok, 'jpg');
  insert into _results values ('upload path is under the order and random',
    v_path ~ ('^' || o_eft || '/[0-9a-f-]{36}\.jpg$'), v_path);
  insert into _results values ('granted path is allowed', public.proof_upload_allowed(v_path), null);
  insert into _results values ('other paths are not',
    not public.proof_upload_allowed(o_eft || '/' || gen_random_uuid() || '.jpg'), null);

  begin
    set local role anon;
    insert into storage.objects (bucket_id, name) values ('payment-proofs', o_eft || '/' || gen_random_uuid() || '.jpg');
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('anon cannot upload without a grant', got = 'refused', got);

  begin
    set local role anon;
    insert into storage.objects (bucket_id, name) values ('payment-proofs', v_path);
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('anon can upload to the granted path', got = 'allowed', got);

  begin
    set local role anon;
    select count(*) into n from storage.objects where bucket_id = 'payment-proofs';
    got := n::text;
  exception when insufficient_privilege then got := '0';
  end;
  reset role;
  insert into _results values ('anon cannot list or read proofs', got = '0', got);

  -- ------------------------------------------------------------- finish
  r := public.finish_proof_upload(n_eft, tok, v_path);
  insert into _results values ('REQ-15 payment now pending review with the file path',
    exists (select 1 from public.payments where order_id = o_eft and payment_status = 'pending_review'
            and proof_of_payment_path = v_path and proof_uploaded_at is not null), r->>'payment_status');
  insert into _results values ('customer told the proof arrived',
    exists (select 1 from public.notifications where order_id = o_eft and template = 'proof_received'), null);
  insert into _results values ('grant used up', not public.proof_upload_allowed(v_path), null);

  begin
    perform public.finish_proof_upload(n_eft, tok, v_path);
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('cannot attach the same upload twice', got = 'no_upload', got);

  -- staff can see it; strangers cannot
  perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'payment-proofs' and name = v_path;
  reset role;
  insert into _results values ('helper can view the proof', n = 1, n::text);

  perform set_config('request.jwt.claims', json_build_object('sub', stranger_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'payment-proofs';
  reset role;
  insert into _results values ('non-staff cannot view proofs', n = 0, n::text);

  -- ------------------------------------------------------------- reject
  begin
    set local role authenticated;  -- still the stranger
    perform public.reject_proof(o_eft);
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('non-staff cannot reject a proof', got = 'refused', got);

  perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.reject_proof(o_eft);
  reset role;
  insert into _results values ('staff can reject a proof: back to unpaid',
    exists (select 1 from public.payments where order_id = o_eft and payment_status = 'unpaid'), null);
  insert into _results values ('customer asked to check and resend',
    exists (select 1 from public.notifications where order_id = o_eft and template = 'proof_rejected'), null);

  -- paid orders refuse further uploads
  set local role authenticated;
  perform public.mark_paid(o_eft);
  reset role;
  begin
    perform public.start_proof_upload(n_eft, tok, 'pdf');
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('no uploads once paid', got = 'already_paid', got);

  -- ------------------------------------------------------------- invoice data (REQ-14)
  r := public.get_invoice(n_eft, tok);
  insert into _results values ('REQ-14 invoice has number = payment reference and total',
    r->>'invoice_number' = (select payment_reference from public.orders where order_id = o_eft)
    and (r->>'total_amount')::numeric = 20, r->>'invoice_number');
  insert into _results values ('no invoice before approval', public.get_invoice(n_pending, tok) is null, null);
  insert into _results values ('no invoice with the wrong token', public.get_invoice(n_eft, repeat('x', 43)) is null, null);
end;
$$;

select setval('public.order_number_seq', last_value, is_called) from _seq;

select test, ok, detail from _results order by ok, test;

rollback;
