-- M3: order capture in one transaction (spec 7.1).
-- Covers: REQ-01 (consent stored), REQ-02/03 (lookup or create by phone),
-- REQ-04/05 (capture and validation), REQ-06 (weekly cap -> waitlist),
-- REQ-07 (large orders), REQ-08 (order number), REQ-09 (idempotent retries),
-- REQ-10 (in-app acknowledgement), status link (gap 4, D-028).
--
-- All three public functions are SECURITY DEFINER and validate everything
-- themselves, so they are safe to call with the public key (D-009, D-027).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- South African numbers to E.164: "082 123 4567", "27821234567" -> +27821234567.
create function private.normalise_za_phone(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^0[1-9][0-9]{8}$'  then '+27' || substr(d, 2)
    when d ~ '^27[1-9][0-9]{8}$' then '+' || d
    else null
  end
  from (select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') as d) s;
$$;

create function private.hash_token(token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(token, 'sha256'), 'hex');
$$;

-- First week customers can still order for. Pre-orders close Thursday 20:00
-- SAST for the following week (REQ-18 cut-off); after that, the week after.
create function private.first_open_week(at_time timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select case when local_time < (monday + 3) + time '20:00' then monday + 7 else monday + 14 end
  from (
    select at_time at time zone 'Africa/Johannesburg' as local_time,
           date_trunc('week', at_time at time zone 'Africa/Johannesburg')::date as monday
  ) s;
$$;

-- Last school day of a week: a public-holiday override, else the setting (gap 7).
create function private.last_school_day(week_start date)
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select o.last_school_day from public.school_day_overrides o where o.week_start = last_school_day.week_start),
    week_start + (select s.last_school_day_isodow from public.app_settings s) - 1
  );
$$;

-- Collection dates open for ordering: school days in the next two open weeks.
create function private.collection_dates(at_time timestamptz default now())
returns setof date
language sql
stable
set search_path = ''
as $$
  select d::date
  from (select private.first_open_week(at_time) as w) f,
       lateral (values (f.w), (f.w + 7)) as weeks(week_start),
       lateral generate_series(weeks.week_start, private.last_school_day(weeks.week_start), interval '1 day') as d
  order by 1;
$$;

-- What a customer may see about their order. First name and masked phone only.
create function private.order_summary(p_order_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'order_status', o.order_status,
    'payment_method', o.payment_method,
    'payment_status', coalesce(pay.payment_status, 'unpaid'),
    'payment_reference', o.payment_reference,
    'collection_date', o.collection_date,
    'revised_collection_date', o.revised_collection_date,
    'collection_slot', o.collection_slot,
    'collection_place', case when o.order_status in ('confirmed', 'baking', 'ready')
                             then (select s.collection_place from public.app_settings s) end,
    'is_large_order', o.is_large_order,
    'quote_amount', o.quote_amount,
    'total_units', o.total_units,
    'total_amount', coalesce(o.quote_amount, (select sum(i.quantity * i.unit_price_snapshot) from public.order_items i where i.order_id = o.order_id)),
    'released', o.released_at is not null,
    'created_at', o.created_at,
    'first_name', split_part(c.full_name, ' ', 1),
    'phone_masked', '******' || right(c.phone_number, 4),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'flavour', p.flavour,
               'quantity', i.quantity,
               'unit_price', i.unit_price_snapshot,
               'line_total', i.quantity * i.unit_price_snapshot
             ) order by p.sort_order)
      from public.order_items i join public.products p using (product_id)
      where i.order_id = o.order_id), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('template', n.template, 'params', n.params, 'created_at', n.created_at)
             order by n.created_at)
      from public.notifications n
      where n.order_id = o.order_id and n.channel = 'in_app' and n.recipient = 'customer'), '[]'::jsonb)
  )
  from public.orders o
  join public.customers c using (customer_id)
  left join public.payments pay on pay.order_id = o.order_id
  where o.order_id = p_order_id;
$$;

-- ---------------------------------------------------------------------------
-- public.get_order_options(): data the order form needs
-- ---------------------------------------------------------------------------
create function public.get_order_options()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'collection_dates', (select jsonb_agg(d) from private.collection_dates() d),
    'slots', jsonb_build_array('second_break', 'after_school'),
    'next_cutoff', ((private.first_open_week() - 4) + time '20:00') at time zone 'Africa/Johannesburg',
    'large_order_threshold', (select s.large_order_threshold from public.app_settings s),
    'max_per_flavour', 100
  );
$$;

-- ---------------------------------------------------------------------------
-- public.place_order(payload): REQ-01 to REQ-10 in one transaction
--
-- Payload (JSON): order_id (uuid, client-generated), access_token (43-char
-- base64url, client-generated), full_name, phone, language, consent_given,
-- consent_version, is_minor, guardian_consent, items [{product_id, quantity}],
-- collection_date, collection_slot, payment_method, special_notes.
--
-- Returns {ok: true, duplicate, ...summary} or {ok: false, errors: {field: code}}.
-- Nothing is written when ok is false (REQ-05).
-- ---------------------------------------------------------------------------
create function public.place_order(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_errors jsonb := '{}'::jsonb;
  v_order_id uuid;
  v_token text := p->>'access_token';
  v_existing_hash text;
  v_name text := btrim(coalesce(p->>'full_name', ''));
  v_phone_raw text := btrim(coalesce(p->>'phone', ''));
  v_phone text;
  v_language public.language_code;
  v_is_minor boolean;
  v_date date;
  v_slot public.collection_slot;
  v_method public.payment_method;
  v_notes text := nullif(btrim(coalesce(p->>'special_notes', '')), '');
  v_customer uuid;
  v_week date;
  v_cap int;
  v_used int;
  v_total_units int;
  v_threshold int;
  v_status public.order_status := 'pending';
  v_number text;
  v_template text;
begin
  -- Idempotency key and status-link token (REQ-09, gap 4) -----------------
  begin
    v_order_id := (p->>'order_id')::uuid;
  exception when others then
    v_order_id := null;
  end;
  if v_order_id is null then
    v_errors := v_errors || '{"order_id": "invalid"}';
  end if;
  if v_token is null or v_token !~ '^[A-Za-z0-9_-]{43}$' then
    v_errors := v_errors || '{"access_token": "invalid"}';
  end if;
  if v_errors <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'errors', v_errors);
  end if;

  -- REQ-09: a retry of an order we already have returns it unchanged.
  select o.access_token_hash into v_existing_hash from public.orders o where o.order_id = v_order_id;
  if found then
    if v_existing_hash is distinct from private.hash_token(v_token) then
      return jsonb_build_object('ok', false, 'errors', '{"order_id": "conflict"}'::jsonb);
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true) || private.order_summary(v_order_id);
  end if;

  -- REQ-01 and POPIA: consent first ---------------------------------------
  if p->'consent_given' is distinct from 'true'::jsonb then
    v_errors := v_errors || '{"consent_given": "required"}';
  end if;
  if coalesce(btrim(p->>'consent_version'), '') = '' or length(p->>'consent_version') > 40 then
    v_errors := v_errors || '{"consent_version": "required"}';
  end if;
  v_is_minor := case jsonb_typeof(p->'is_minor') when 'boolean' then (p->>'is_minor')::boolean end;
  if v_is_minor is null then
    v_errors := v_errors || '{"is_minor": "required"}';
  elsif v_is_minor and p->'guardian_consent' is distinct from 'true'::jsonb then
    v_errors := v_errors || '{"guardian_consent": "required"}';
  end if;

  -- REQ-05: required fields -------------------------------------------------
  if v_name = '' then
    v_errors := v_errors || '{"full_name": "required"}';
  elsif length(v_name) > 100 then
    v_errors := v_errors || '{"full_name": "too_long"}';
  end if;

  if v_phone_raw = '' then
    v_errors := v_errors || '{"phone": "required"}';
  else
    v_phone := private.normalise_za_phone(v_phone_raw);
    if v_phone is null then
      v_errors := v_errors || '{"phone": "invalid"}';
    end if;
  end if;

  if coalesce(p->>'payment_method', '') = '' then
    v_errors := v_errors || '{"payment_method": "required"}';
  elsif p->>'payment_method' not in ('cash', 'eft') then
    v_errors := v_errors || '{"payment_method": "invalid"}';
  else
    v_method := (p->>'payment_method')::public.payment_method;
  end if;

  v_language := case when p->>'language' in ('en', 'xh', 'af') then (p->>'language')::public.language_code else 'en' end;

  begin
    v_date := (p->>'collection_date')::date;
  exception when others then
    v_date := null;
  end;
  if v_date is null then
    v_errors := v_errors || '{"collection_date": "required"}';
  elsif not exists (select 1 from private.collection_dates() d where d = v_date) then
    v_errors := v_errors || '{"collection_date": "closed"}';
  end if;

  if coalesce(p->>'collection_slot', '') = '' then
    v_errors := v_errors || '{"collection_slot": "required"}';
  elsif p->>'collection_slot' not in ('second_break', 'after_school') then
    v_errors := v_errors || '{"collection_slot": "invalid"}';
  else
    v_slot := (p->>'collection_slot')::public.collection_slot;
  end if;

  if char_length(v_notes) > 280 then
    v_errors := v_errors || '{"special_notes": "too_long"}';
  end if;

  -- Items: merge duplicate flavours, re-price from products (never trust the
  -- browser), reject unknown or unavailable flavours.
  create temp table if not exists _order_lines (product_id uuid primary key, quantity int, unit_price numeric(8,2)) on commit drop;
  truncate _order_lines;
  begin
    if coalesce(jsonb_typeof(p->'items'), '') <> 'array' or jsonb_array_length(p->'items') = 0 then
      raise exception using errcode = 'P0001';
    end if;
    insert into _order_lines (product_id, quantity)
    select x.product_id, sum(x.quantity)
    from jsonb_to_recordset(p->'items') as x(product_id uuid, quantity int)
    group by x.product_id;
  exception when others then
    v_errors := v_errors || '{"items": "required"}';
  end;

  if not v_errors ? 'items' then
    if exists (select 1 from _order_lines l where l.product_id is null or l.quantity is null or l.quantity < 1) then
      v_errors := v_errors || '{"items": "required"}';
    elsif exists (select 1 from _order_lines l where l.quantity > 100) then
      v_errors := v_errors || '{"items": "too_many"}';
    elsif exists (
      select 1 from _order_lines l
      left join public.products pr on pr.product_id = l.product_id and pr.is_available
      where pr.product_id is null
    ) then
      v_errors := v_errors || '{"items": "unavailable"}';
    else
      update _order_lines l set unit_price = pr.unit_price
      from public.products pr where pr.product_id = l.product_id;
    end if;
  end if;

  if v_errors <> '{}'::jsonb then
    return jsonb_build_object('ok', false, 'errors', v_errors);
  end if;

  -- REQ-02 / REQ-03: look up by phone, create if new. Latest name, language
  -- and consent wording win.
  insert into public.customers as c (
    full_name, phone_number, preferred_language, consent_given, consent_timestamp,
    consent_version, is_minor, guardian_consent, last_order_at
  ) values (
    v_name, v_phone, v_language, true, now(),
    p->>'consent_version', v_is_minor, coalesce(p->'guardian_consent' = 'true'::jsonb, false), now()
  )
  on conflict (phone_number) do update set
    full_name = excluded.full_name,
    preferred_language = excluded.preferred_language,
    consent_given = true,
    consent_timestamp = excluded.consent_timestamp,
    consent_version = excluded.consent_version,
    is_minor = excluded.is_minor,
    guardian_consent = excluded.guardian_consent,
    last_order_at = excluded.last_order_at
  returning c.customer_id into v_customer;

  -- REQ-06: weekly cap. Serialise orders for the same week so two customers
  -- cannot both take the last pops.
  v_week := v_date - (extract(isodow from v_date)::int - 1);
  perform pg_advisory_xact_lock(hashtextextended('kdpops:capacity:' || v_week, 0));

  select sum(l.quantity) into v_total_units from _order_lines l;
  v_cap := coalesce(
    (select w.unit_cap from public.weekly_capacity w where w.week_start = v_week),
    (select s.default_weekly_cap from public.app_settings s)
  );
  select coalesce(sum(o.total_units), 0) into v_used
  from public.orders o
  where o.collection_week = v_week and o.order_status not in ('cancelled', 'waitlisted');

  if v_used + v_total_units > v_cap then
    v_status := 'waitlisted';
  end if;

  -- REQ-07: large orders go to Kaydee for a quote.
  select s.large_order_threshold into v_threshold from public.app_settings s;

  -- REQ-08 / REQ-09: insert once; order_number comes from the trigger.
  insert into public.orders (
    order_id, customer_id, order_status, payment_method, collection_date, collection_slot,
    special_notes, total_units, is_large_order, access_token_hash
  ) values (
    v_order_id, v_customer, v_status, v_method, v_date, v_slot,
    v_notes, v_total_units, v_total_units > v_threshold, private.hash_token(v_token)
  )
  on conflict (order_id) do nothing
  returning order_number into v_number;

  if v_number is null then
    -- Lost a race with an identical retry: return that one.
    return jsonb_build_object('ok', true, 'duplicate', true) || private.order_summary(v_order_id);
  end if;

  insert into public.order_items (order_id, product_id, quantity, unit_price_snapshot)
  select v_order_id, l.product_id, l.quantity, l.unit_price from _order_lines l;

  -- REQ-10: acknowledgement on the in-app status page (WhatsApp in M6).
  v_template := case
    when v_status = 'waitlisted' then 'waitlisted'
    when v_total_units > v_threshold then 'quote_pending'
    else 'acknowledgement'
  end;
  insert into public.notifications (order_id, customer_id, recipient, channel, template, params, status, sent_at)
  values (v_order_id, v_customer, 'customer', 'in_app', v_template,
          jsonb_build_object('order_number', v_number), 'sent', now());

  return jsonb_build_object('ok', true, 'duplicate', false) || private.order_summary(v_order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- public.get_order_status(order_number, token): the private status link
-- ---------------------------------------------------------------------------
create function public.get_order_status(p_order_number text, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.order_summary(o.order_id)
  from public.orders o
  where o.order_number = upper(btrim(p_order_number))
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and o.access_token_hash = private.hash_token(p_token);
$$;

revoke execute on function public.get_order_options(), public.place_order(jsonb), public.get_order_status(text, text) from public;
grant execute on function public.get_order_options(), public.place_order(jsonb), public.get_order_status(text, text)
  to anon, authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;
