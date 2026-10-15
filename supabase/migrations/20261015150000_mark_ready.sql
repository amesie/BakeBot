-- Phase 4: mark orders ready one at a time, and let "All ready" include
-- orders that skipped "Start baking". Customers get the "ready" message
-- (in-app now; SMS/WhatsApp copy in the notifications phase).

-- ---------------------------------------------------------------------------
-- One order: confirmed or baking -> ready (owner)
-- ---------------------------------------------------------------------------
create function public.mark_ready(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  perform private.require_owner();
  select * into o from public.orders where order_id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'no_data_found';
  end if;
  if o.order_status not in ('confirmed', 'baking') or o.released_at is not null then
    raise exception 'not_bakeable' using errcode = 'check_violation';
  end if;

  -- The status rules require passing through baking.
  if o.order_status = 'confirmed' then
    update public.orders set order_status = 'baking' where order_id = p_order_id;
  end if;
  update public.orders set order_status = 'ready' where order_id = p_order_id;

  perform private.notify_customer(p_order_id, 'ready', jsonb_build_object(
    'date', coalesce(o.revised_collection_date, o.collection_date),
    'slot', o.collection_slot,
    'place', (select s.collection_place from public.app_settings s)));

  return jsonb_build_object('order_number', o.order_number);
end;
$$;

-- ---------------------------------------------------------------------------
-- Whole week: "All ready" now also takes confirmed orders (through baking)
-- ---------------------------------------------------------------------------
create or replace function public.advance_week(p_week date, p_to public.order_status)
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
  if p_to not in ('baking', 'ready') then
    raise exception 'invalid_step' using errcode = 'check_violation';
  end if;

  if p_to = 'baking' then
    update public.orders set order_status = 'baking'
     where collection_week = p_week and order_status = 'confirmed' and released_at is null;
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  -- Ready: confirmed orders step through baking first.
  update public.orders set order_status = 'baking'
   where collection_week = p_week and order_status = 'confirmed' and released_at is null;

  for r in
    update public.orders set order_status = 'ready'
     where collection_week = p_week and order_status = 'baking' and released_at is null
    returning order_id, coalesce(revised_collection_date, collection_date) as day, collection_slot
  loop
    perform private.notify_customer(r.order_id, 'ready', jsonb_build_object(
      'date', r.day, 'slot', r.collection_slot,
      'place', (select s.collection_place from public.app_settings s)));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.mark_ready(uuid) from public, anon;
grant execute on function public.mark_ready(uuid) to authenticated, service_role;
