-- M4: BakeBot chat (REQ-21 to REQ-24, AI transparency NFR).
--
-- - faq_knowledge holds only owner-approved answers; the chat retrieves the
--   top 3 by cosine similarity (match_faq) and answers from those alone.
-- - Conversations are created and appended to by the chat API with a
--   token kept on the customer's phone (only its hash is stored), so the
--   public key never reads or writes the table directly (D-009).
-- - 100% of conversations are logged; deleted after 30 days (M6 job).

-- ---------------------------------------------------------------------------
-- Conversations: ownership token, handover contact (PII, 30-day lifetime)
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column access_token_hash text,
  add column contact_name text check (char_length(contact_name) <= 100),
  add column contact_phone text,
  add column fallback_count int not null default 0;

-- ---------------------------------------------------------------------------
-- Retrieval (REQ-22): top-k approved answers for a question embedding
-- ---------------------------------------------------------------------------
create function public.match_faq(p_embedding extensions.vector(768), p_language public.language_code, p_limit int default 3)
returns table (faq_id uuid, question text, approved_answer text, category public.faq_category, similarity float)
language sql
stable
security definer
set search_path = ''
as $$
  select f.faq_id, f.question, f.approved_answer, f.category,
         1 - (f.embedding operator(extensions.<=>) p_embedding) as similarity
  from public.faq_knowledge f
  where f.is_active and f.embedding is not null
    and (f.language = p_language or f.language = 'en')
  order by f.embedding operator(extensions.<=>) p_embedding
  limit least(greatest(p_limit, 1), 5);
$$;

-- ---------------------------------------------------------------------------
-- Append to a conversation (creates it on first use). Returns its state.
-- p_messages: [{role: "bot"|"customer"|"system", text, at}]
-- ---------------------------------------------------------------------------
create function public.chat_append(
  p_conversation_id uuid,
  p_token text,
  p_language public.language_code,
  p_messages jsonb,
  p_unresolved_delta int default 0,
  p_escalate boolean default false,
  p_fallback boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.conversations;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid_token' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 4 then
    raise exception 'invalid_messages' using errcode = 'check_violation';
  end if;

  insert into public.conversations (conversation_id, language, access_token_hash)
  values (p_conversation_id, p_language, private.hash_token(p_token))
  on conflict (conversation_id) do nothing;

  select * into c from public.conversations where conversation_id = p_conversation_id for update;
  if c.access_token_hash is distinct from private.hash_token(p_token) then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if jsonb_array_length(c.messages) >= 60 then
    raise exception 'too_long' using errcode = 'check_violation';  -- cost and abuse limit
  end if;

  update public.conversations
     set messages = messages || p_messages,
         language = p_language,
         unresolved_attempts = unresolved_attempts + greatest(p_unresolved_delta, 0),
         fallback_count = fallback_count + case when p_fallback then 1 else 0 end,
         escalated = escalated or p_escalate,
         escalated_at = case when p_escalate and not escalated then now() else escalated_at end,
         resolved_at = case when p_escalate then null else resolved_at end
   where conversation_id = p_conversation_id
  returning * into c;

  return jsonb_build_object(
    'unresolved_attempts', c.unresolved_attempts,
    'escalated', c.escalated,
    'has_contact', c.contact_phone is not null,
    'message_count', jsonb_array_length(c.messages));
end;
$$;

-- Customer leaves a name and number so Kaydee can reply (REQ-23).
create function public.chat_set_contact(p_conversation_id uuid, p_token text, p_name text, p_phone text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalise_za_phone(p_phone);
begin
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = 'check_violation';
  end if;
  update public.conversations
     set contact_name = nullif(left(btrim(coalesce(p_name, '')), 100), ''),
         contact_phone = v_phone,
         escalated = true,
         escalated_at = coalesce(escalated_at, now()),
         resolved_at = null
   where conversation_id = p_conversation_id
     and access_token_hash = private.hash_token(p_token);
  if not found then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Owner marks a handover as dealt with.
create function public.resolve_conversation(p_conversation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  update public.conversations set resolved_at = now() where conversation_id = p_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed FAQ (D-060). Prices are never typed into an answer: "{menu}" is
-- replaced with the live menu and prices when the answer is used. Answers
-- Kaydee has not written yet start inactive.
-- ---------------------------------------------------------------------------
insert into public.faq_knowledge (question, approved_answer, category, language, is_active) values
  ('How much do the cake pops cost? What flavours do you have? What is on the menu?',
   'Here is the menu: {menu}. Prices are per cake pop.', 'pricing', 'en', true),
  ('How do I order? When and where do I collect my order?',
   'Order on this page with the order form. Collection is at {place} during 2nd break (11:45–12:00) or after school (14:30–15:00) on the day you choose. Orders for next week close on Thursday at 20:00.',
   'other', 'en', true),
  ('How can I pay? Can I pay by EFT or cash?',
   'You can pay cash when you collect, or by EFT once Kaydee has confirmed your order. EFT payments use the reference on your confirmation.',
   'pricing', 'en', true),
  ('Do the cake pops contain nuts, gluten, dairy or eggs? Are they safe for allergies?',
   'NEEDS KAYDEE''S ANSWER', 'allergens', 'en', false),
  ('Do you give discounts for big orders, birthdays or teachers?',
   'NEEDS KAYDEE''S ANSWER', 'discounts', 'en', false);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.match_faq(extensions.vector, public.language_code, int),
  public.chat_append(uuid, text, public.language_code, jsonb, int, boolean, boolean),
  public.chat_set_contact(uuid, text, text, text),
  public.resolve_conversation(uuid)
  from public;
grant execute on function
  public.match_faq(extensions.vector, public.language_code, int),
  public.chat_append(uuid, text, public.language_code, jsonb, int, boolean, boolean),
  public.chat_set_contact(uuid, text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.resolve_conversation(uuid) to authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function private.cron_secret() from authenticated;

-- The chat fills "{place}" in approved answers; add it to the public options.
create or replace function public.get_order_options()
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
    'max_per_flavour', 100,
    'collection_place', (select s.collection_place from public.app_settings s)
  );
$$;
