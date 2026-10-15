-- Phase 4b: private invoice links for one-tap WhatsApp (D-053).
-- Each invoice gets a random 256-bit share token when it is created (on
-- approval). Staff can read it to put the link in the WhatsApp message;
-- the link opens only that one invoice PDF.

create function private.new_share_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

alter table public.invoices add column share_token text unique;
update public.invoices set share_token = private.new_share_token() where share_token is null;
alter table public.invoices alter column share_token set not null;

create function private.invoices_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.share_token := coalesce(new.share_token, private.new_share_token());
  return new;
end;
$$;

create trigger invoices_before_insert
  before insert on public.invoices
  for each row execute function private.invoices_before_insert();

-- Invoice for a shared link (no status-link token needed). First name only.
create function public.get_invoice_by_link(p_invoice_number text, p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.order_summary(i.order_id) || jsonb_build_object(
           'invoice_number', i.invoice_number,
           'issued_at', i.issued_at,
           'total_amount', i.total_amount)
  from public.invoices i
  where i.invoice_number = upper(btrim(p_invoice_number))
    and p_share_token ~ '^[A-Za-z0-9_-]{43}$'
    and i.share_token = p_share_token;
$$;

revoke execute on function public.get_invoice_by_link(text, text) from public;
grant execute on function public.get_invoice_by_link(text, text) to anon, authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
