-- M5 (Phase 4): owner and helper actions for the dashboard.
-- Covers: REQ-07 (quote before approving a large order), REQ-12 (confirmation
-- with day, place, amount), REQ-13 (polite decline), REQ-14 (payment
-- reference + invoice), REQ-17 (mark paid), REQ-19 (delayed batch).
--
-- Each function is SECURITY DEFINER so it can write the order, payment,
-- invoice and message rows together, and checks the caller's role first.
-- Only signed-in users can call them; anon cannot (D-009).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.require_owner()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function private.require_staff()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- In-app message to the customer (WhatsApp copy added in M6). Params hold
-- only what the template needs, never names or phone numbers.
create function private.notify_customer(p_order_id uuid, p_template text, p_params jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.notifications (order_id, customer_id, recipient, channel, template, params, status, sent_at)
  select o.order_id, o.customer_id, 'customer', 'in_app', p_template,
         jsonb_build_object('order_number', o.order_number) || p_params, 'sent', now()
  from public.orders o where o.order_id = p_order_id;
$$;

-- REQ-14: KDP-0042-7F3K. No 0/O or 1/I so it is easy to type into a banking app.
create function private.new_payment_reference(p_order_number text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  suffix text;
  candidate text;
begin
  loop
    select string_agg(substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1), '')
      into suffix
    from (select extensions.gen_random_bytes(4) as b) r, generate_series(0, 3) as i;
    candidate := p_order_number || '-' || suffix;
    exit when not exists (select 1 from public.orders where payment_reference = candidate);
  end loop;
  return candidate;
end;
$$;

-- What the customer owes: the quote for large orders, otherwise the items.
create function private.order_amount(p_order_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    o.quote_amount,
    (select sum(i.quantity * i.unit_price_snapshot) from public.order_items i where i.order_id = o.order_id)
  )
  from public.orders o where o.order_id = p_order_id;
$$;

-- ---------------------------------------------------------------------------
-- REQ-07, REQ-12, REQ-14: approve
-- ---------------------------------------------------------------------------
create function public.approve_order(p_order_id uuid, p_quote numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_reference text;
  v_amount numeric;
begin
  perform private.require_owner();

  select * into o from public.orders where order_id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'no_data_found';
  end if;
  if o.order_status not in ('pending', 'waitlisted') then
    raise exception 'not_pending' using errcode = 'check_violation';
  end if;
  if p_quote is not null and p_quote < 0 then
    raise exception 'invalid_quote' using errcode = 'check_violation';
  end if;
  if o.is_large_order and coalesce(p_quote, o.quote_amount) is null then
    raise exception 'quote_required' using errcode = 'check_violation';  -- REQ-07
  end if;

  if p_quote is not null then
    update public.orders set quote_amount = p_quote where order_id = p_order_id;
  end if;
  -- Kaydee may take a waitlisted order (her decision, not the system's).
  if o.order_status = 'waitlisted' then
    update public.orders set order_status = 'pending' where order_id = p_order_id;
  end if;

  v_reference := private.new_payment_reference(o.order_number);
  update public.orders
     set order_status = 'confirmed', payment_reference = v_reference
   where order_id = p_order_id;

  v_amount := private.order_amount(p_order_id);
  insert into public.payments (order_id, amount) values (p_order_id, v_amount);
  insert into public.invoices (invoice_number, order_id, total_amount) values (v_reference, p_order_id, v_amount);

  -- REQ-12: day, place and amount (EFT customers also get the reference).
  perform private.notify_customer(
    p_order_id,
    case when o.payment_method = 'eft' then 'confirmation_eft' else 'confirmation_cash' end,
    jsonb_build_object(
      'date', coalesce(o.revised_collection_date, o.collection_date),
      'slot', o.collection_slot,
      'place', (select s.collection_place from public.app_settings s),
      'amount', v_amount,
      'reference', v_reference
    )
  );

  return jsonb_build_object('order_number', o.order_number, 'payment_reference', v_reference, 'amount', v_amount);
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-13: decline (status -> cancelled, polite message)
-- ---------------------------------------------------------------------------
create function public.decline_order(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  perform 1 from public.orders where order_id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'no_data_found';
  end if;
  -- The status trigger refuses orders that are already baking or later.
  update public.orders set order_status = 'cancelled' where order_id = p_order_id;
  perform private.notify_customer(p_order_id, 'declined', '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-17: payment received (owner or helper)
-- ---------------------------------------------------------------------------
create function public.mark_paid(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  update public.payments
     set payment_status = 'paid', paid_at = now(), marked_paid_by = (select auth.uid())
   where order_id = p_order_id and payment_status <> 'paid';
  if not found then
    raise exception 'no_unpaid_payment' using errcode = 'no_data_found';
  end if;
  perform private.notify_customer(p_order_id, 'payment_received', '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Handover: ready -> collected (owner or helper, D-040)
-- ---------------------------------------------------------------------------
create function public.mark_collected(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  update public.orders set order_status = 'collected' where order_id = p_order_id and order_status = 'ready';
  if not found then
    raise exception 'not_ready' using errcode = 'check_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Batch: move a whole week to baking or ready (owner)
-- ---------------------------------------------------------------------------
create function public.advance_week(p_week date, p_to public.order_status)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_from public.order_status;
  v_count int := 0;
  r record;
begin
  perform private.require_owner();
  v_from := case p_to when 'baking' then 'confirmed' when 'ready' then 'baking' end;
  if v_from is null then
    raise exception 'invalid_step' using errcode = 'check_violation';
  end if;

  for r in
    update public.orders set order_status = p_to
     where collection_week = p_week and order_status = v_from and released_at is null
    returning order_id, coalesce(revised_collection_date, collection_date) as day, collection_slot
  loop
    if p_to = 'ready' then
      perform private.notify_customer(r.order_id, 'ready', jsonb_build_object(
        'date', r.day, 'slot', r.collection_slot,
        'place', (select s.collection_place from public.app_settings s)));
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- REQ-19: batch delayed (load shedding) -> new date for the week's orders
-- ---------------------------------------------------------------------------
create function public.delay_batch(p_week date, p_new_date date)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  r record;
begin
  perform private.require_owner();
  if extract(isodow from p_new_date) > 5 or p_new_date < (now() at time zone 'Africa/Johannesburg')::date then
    raise exception 'invalid_date' using errcode = 'check_violation';
  end if;

  for r in
    update public.orders set revised_collection_date = p_new_date
     where collection_week = p_week and order_status in ('confirmed', 'baking', 'ready')
    returning order_id
  loop
    perform private.notify_customer(r.order_id, 'delayed', jsonb_build_object('date', p_new_date));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: signed-in users only. Role checks happen inside each function.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.approve_order(uuid, numeric), public.decline_order(uuid), public.mark_paid(uuid),
  public.mark_collected(uuid), public.advance_week(date, public.order_status), public.delay_batch(date, date)
  from public, anon;
grant execute on function
  public.approve_order(uuid, numeric), public.decline_order(uuid), public.mark_paid(uuid),
  public.mark_collected(uuid), public.advance_week(date, public.order_status), public.delay_batch(date, date)
  to authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
