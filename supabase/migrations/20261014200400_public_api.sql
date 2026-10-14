-- M1: the only database functions the public (anon) key may call.
-- Each is SECURITY DEFINER, returns only non-personal data, and is granted
-- explicitly because 20261014200300_rls.sql revokes execute from anon by default.

-- Availability NFR: trivial query for /api/health, pinged every 5 minutes by
-- UptimeRobot. The regular traffic also stops the free plan pausing the project.
create function public.health_check()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok',
    'db_time', now(),
    'products', (select count(*) from public.products)
  );
$$;

-- Menu for the ordering page (REQ-04): available products and prices only.
create function public.get_menu()
returns table (
  product_id uuid,
  product_name text,
  flavour text,
  description text,
  unit_price numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.product_id, p.product_name, p.flavour, p.description, p.unit_price
  from public.products p
  where p.is_available
  order by p.sort_order, p.flavour;
$$;

revoke execute on function public.health_check(), public.get_menu() from public;
grant execute on function public.health_check(), public.get_menu() to anon, authenticated, service_role;
