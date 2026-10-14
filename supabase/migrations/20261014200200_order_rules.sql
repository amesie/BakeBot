-- M1: business rules enforced in the database, not just the UI.
-- Covers: REQ-08 (order numbers), order/payment state machines (spec section 4),
-- helper role limits (spec section 7.8).

-- ---------------------------------------------------------------------------
-- Staff role helpers (used by RLS policies and triggers)
-- ---------------------------------------------------------------------------
create function private.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_roles where user_id = (select auth.uid());
$$;

create function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.staff_role() = 'owner', false);
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_role() is not null;
$$;

-- ---------------------------------------------------------------------------
-- REQ-08: order numbers KDP-0001, KDP-0002, ... (grows past 4 digits safely)
-- ---------------------------------------------------------------------------
create function private.format_order_number(n bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'KDP-' || lpad(n::text, greatest(4, length(n::text)), '0');
$$;

create function private.orders_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- New orders enter the lifecycle at the start only.
  if new.order_status not in ('pending', 'waitlisted') then
    raise exception 'new orders must be pending or waitlisted, not %', new.order_status
      using errcode = 'check_violation';
  end if;
  new.order_number := private.format_order_number(nextval('public.order_number_seq'));
  new.status_changed_at := now();
  return new;
end;
$$;

create trigger orders_before_insert
  before insert on public.orders
  for each row execute function private.orders_before_insert();

-- ---------------------------------------------------------------------------
-- Order state machine
--   waitlisted -> pending | cancelled          (gap 1)
--   pending    -> confirmed | cancelled
--   confirmed  -> baking | cancelled
--   baking     -> ready
--   ready      -> collected
--   ready      -> cancelled  only once released to general sale (REQ-20, D-010)
-- ---------------------------------------------------------------------------
create function private.order_transition_allowed(
  from_status public.order_status,
  to_status public.order_status,
  is_released boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case from_status
    when 'waitlisted' then to_status in ('pending', 'cancelled')
    when 'pending'    then to_status in ('confirmed', 'cancelled')
    when 'confirmed'  then to_status in ('baking', 'cancelled')
    when 'baking'     then to_status = 'ready'
    when 'ready'      then to_status = 'collected' or (to_status = 'cancelled' and is_released)
    else false  -- collected and cancelled are final
  end;
$$;

create function private.orders_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_number is distinct from old.order_number then
    raise exception 'order_number cannot change' using errcode = 'check_violation';
  end if;
  if new.order_status is distinct from old.order_status then
    if not private.order_transition_allowed(old.order_status, new.order_status, new.released_at is not null) then
      raise exception 'illegal order_status transition: % -> %', old.order_status, new.order_status
        using errcode = 'check_violation';
    end if;
    new.status_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_before_update
  before update on public.orders
  for each row execute function private.orders_before_update();

-- ---------------------------------------------------------------------------
-- Payment state machine
--   unpaid         -> pending_review | paid   (cash is marked paid at handover)
--   pending_review -> paid | unpaid           (unpaid = proof rejected, D-011)
--   paid is final
-- ---------------------------------------------------------------------------
create function private.payment_transition_allowed(
  from_status public.payment_status,
  to_status public.payment_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case from_status
    when 'unpaid'         then to_status in ('pending_review', 'paid')
    when 'pending_review' then to_status in ('paid', 'unpaid')
    else false
  end;
$$;

create function private.payments_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_status <> 'unpaid' then
    raise exception 'new payments must be unpaid, not %', new.payment_status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger payments_before_insert
  before insert on public.payments
  for each row execute function private.payments_before_insert();

create function private.payments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Helper may record payments but never change what is owed (spec 7.8).
  if private.staff_role() = 'helper'
     and (new.amount is distinct from old.amount or new.order_id is distinct from old.order_id) then
    raise exception 'helpers can only update payment status' using errcode = 'insufficient_privilege';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if not private.payment_transition_allowed(old.payment_status, new.payment_status) then
      raise exception 'illegal payment_status transition: % -> %', old.payment_status, new.payment_status
        using errcode = 'check_violation';
    end if;
    -- REQ-17: record who marked it paid and when.
    if new.payment_status = 'paid' then
      new.paid_at := coalesce(new.paid_at, now());
      new.marked_paid_by := coalesce(new.marked_paid_by, (select auth.uid()));
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger payments_before_update
  before update on public.payments
  for each row execute function private.payments_before_update();

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function private.set_updated_at();

create trigger faq_knowledge_set_updated_at
  before update on public.faq_knowledge
  for each row execute function private.set_updated_at();

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function private.set_updated_at();
