-- Phase 4b: proof of payment uploads (REQ-15) and invoice data (REQ-14).
--
-- Upload flow (no secret key needed, D-050):
--   1. API route calls start_proof_upload(order_number, token). It checks the
--      status-link token and that the order is approved and unpaid, then
--      records a short-lived upload grant for one random file path.
--   2. API route uploads the file to the private "payment-proofs" bucket with
--      the public key. The storage policy only allows paths with a live grant.
--   3. API route calls finish_proof_upload(), which links the file to the
--      payment, sets pending_review and tells the customer it arrived.
-- Staff view proofs through 15-minute signed URLs (spec 7.8).

-- ---------------------------------------------------------------------------
-- Private bucket: images and PDFs up to 4 MB (Vercel's request limit is 4.5 MB)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 4194304,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Upload grants: one path, 10 minutes, one use
-- ---------------------------------------------------------------------------
create table private.proof_upload_grants (
  object_path text primary key,
  order_id uuid not null references public.orders (order_id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create function public.proof_upload_allowed(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.proof_upload_grants g
    where g.object_path = p_path and g.expires_at > now()
  );
$$;

-- Order an upload may be attached to: right token, approved, not yet paid.
create function private.proof_order(p_order_number text, p_token text)
returns public.orders
language plpgsql
stable
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders
  where order_number = upper(btrim(p_order_number))
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and access_token_hash = private.hash_token(p_token);
  if not found then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if o.order_status not in ('confirmed', 'baking', 'ready', 'collected') then
    raise exception 'not_approved' using errcode = 'check_violation';  -- flag to Kaydee (spec 7.3)
  end if;
  if exists (select 1 from public.payments p where p.order_id = o.order_id and p.payment_status = 'paid') then
    raise exception 'already_paid' using errcode = 'check_violation';
  end if;
  return o;
end;
$$;

create function public.start_proof_upload(p_order_number text, p_token text, p_extension text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_path text;
begin
  if p_extension not in ('jpg', 'png', 'webp', 'pdf') then
    raise exception 'bad_type' using errcode = 'check_violation';
  end if;
  o := private.proof_order(p_order_number, p_token);
  delete from private.proof_upload_grants where expires_at < now();
  v_path := o.order_id || '/' || gen_random_uuid() || '.' || p_extension;
  insert into private.proof_upload_grants (object_path, order_id) values (v_path, o.order_id);
  return v_path;
end;
$$;

create function public.finish_proof_upload(p_order_number text, p_token text, p_path text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  o := private.proof_order(p_order_number, p_token);
  delete from private.proof_upload_grants where object_path = p_path and order_id = o.order_id;
  if not found then
    raise exception 'no_upload' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and name = p_path) then
    raise exception 'no_upload' using errcode = 'check_violation';
  end if;

  -- A replaced proof stays in the bucket until the retention job removes
  -- files no payment points to (M6).
  update public.payments
     set proof_of_payment_path = p_path,
         proof_uploaded_at = now(),
         payment_status = 'pending_review'
   where order_id = o.order_id;

  perform private.notify_customer(o.order_id, 'proof_received', '{}'::jsonb);
  return private.order_summary(o.order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: proof does not match -> back to unpaid, customer asked to check
-- ---------------------------------------------------------------------------
create function public.reject_proof(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  update public.payments set payment_status = 'unpaid'
   where order_id = p_order_id and payment_status = 'pending_review';
  if not found then
    raise exception 'no_proof' using errcode = 'no_data_found';
  end if;
  perform private.notify_customer(p_order_id, 'proof_rejected', '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoice data for the customer's PDF (REQ-14): only once approved
-- ---------------------------------------------------------------------------
create function public.get_invoice(p_order_number text, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.order_summary(o.order_id) || jsonb_build_object(
           'invoice_number', i.invoice_number,
           'issued_at', i.issued_at,
           'total_amount', i.total_amount)
  from public.orders o
  join public.invoices i using (order_id)
  where o.order_number = upper(btrim(p_order_number))
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and o.access_token_hash = private.hash_token(p_token);
$$;

-- ---------------------------------------------------------------------------
-- Storage policies (RLS on storage.objects is enabled by Supabase)
-- ---------------------------------------------------------------------------
create policy "proofs: upload with a grant"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs' and public.proof_upload_allowed(name));

create policy "proofs: staff can view"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and private.is_staff());

create policy "proofs: owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and private.is_owner());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
alter table private.proof_upload_grants enable row level security;

revoke execute on function
  public.proof_upload_allowed(text), public.start_proof_upload(text, text, text),
  public.finish_proof_upload(text, text, text), public.reject_proof(uuid), public.get_invoice(text, text)
  from public;
grant execute on function
  public.proof_upload_allowed(text), public.start_proof_upload(text, text, text),
  public.finish_proof_upload(text, text, text), public.get_invoice(text, text)
  to anon, authenticated, service_role;
grant execute on function public.reject_proof(uuid) to authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
