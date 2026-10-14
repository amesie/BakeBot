-- M1: row level security on every table (Security NFR, spec section 7.8).
--
-- Access model (SRS gap 8, docs/DECISIONS.md D-009):
--   anon          no table access at all. Customers go through API routes and
--                 SECURITY DEFINER functions that check the order access token.
--   authenticated only staff (rows in staff_roles) see anything.
--     owner       full access.
--     helper      read orders and related rows; update payments only.
--   service_role  bypasses RLS; used only by server code (never the browser).

-- ---------------------------------------------------------------------------
-- 1. Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.app_settings         enable row level security;
alter table public.school_day_overrides enable row level security;
alter table public.staff_roles          enable row level security;
alter table public.customers            enable row level security;
alter table public.products             enable row level security;
alter table public.weekly_capacity      enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.payments             enable row level security;
alter table public.invoices             enable row level security;
alter table public.feedback             enable row level security;
alter table public.conversations        enable row level security;
alter table public.faq_knowledge        enable row level security;
alter table public.notifications        enable row level security;
alter table public.job_runs             enable row level security;
alter table public.error_log            enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Belt and braces: anon has no privileges on tables, sequences or functions
--    in public, now or in future migrations. Functions anon may call are
--    granted explicitly (see 20261014200400_public_api.sql).
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;

alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

-- Helper functions: callable by signed-in users and server code (policies and
-- triggers run them as the caller), never by anon. The private schema is not
-- exposed through the API, so none of these can be called over HTTP.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Policies (all for the authenticated role; anon has none)
-- ---------------------------------------------------------------------------

-- Owner: full access to every table.
create policy owner_all on public.app_settings         for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.school_day_overrides for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.staff_roles          for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.customers            for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.products             for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.weekly_capacity      for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.orders               for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.order_items          for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.payments             for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.invoices             for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.feedback             for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.conversations        for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.faq_knowledge        for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.notifications        for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.job_runs             for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_all on public.error_log            for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- Any staff member can see their own role row (so the app knows who they are).
create policy staff_read_own_role on public.staff_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- Helper: read what is needed to find an order and record a payment.
create policy helper_read on public.orders          for select to authenticated using ((select private.staff_role()) = 'helper');
create policy helper_read on public.order_items     for select to authenticated using ((select private.staff_role()) = 'helper');
create policy helper_read on public.customers       for select to authenticated using ((select private.staff_role()) = 'helper');
create policy helper_read on public.products        for select to authenticated using ((select private.staff_role()) = 'helper');
create policy helper_read on public.payments        for select to authenticated using ((select private.staff_role()) = 'helper');
create policy helper_read on public.invoices        for select to authenticated using ((select private.staff_role()) = 'helper');
create policy helper_read on public.weekly_capacity for select to authenticated using ((select private.staff_role()) = 'helper');
create policy helper_read on public.app_settings    for select to authenticated using ((select private.staff_role()) = 'helper');

-- Helper: update payments only. The payments_before_update trigger stops a
-- helper changing the amount or order.
create policy helper_update_payments on public.payments
  for update to authenticated
  using ((select private.staff_role()) = 'helper')
  with check ((select private.staff_role()) = 'helper');
