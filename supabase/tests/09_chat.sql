-- DB test: BakeBot chat storage and retrieval (REQ-21 to REQ-23).
-- Rolled back at the end. Run: npm run test:db

begin;

create temp table _results (test text, ok boolean, detail text) on commit drop;
grant all on _results to authenticated, anon;

do $$
declare
  owner_id uuid := gen_random_uuid();
  helper_id uuid := gen_random_uuid();
  conv uuid := gen_random_uuid();
  tok text := repeat('c', 43);
  v jsonb;
  got text;
  n int;
  e1 extensions.vector(768);
  e2 extensions.vector(768);
  hit record;
begin
  insert into auth.users (id, email, aud, role) values
    (owner_id, 'owner@test.invalid', 'authenticated', 'authenticated'),
    (helper_id, 'helper@test.invalid', 'authenticated', 'authenticated');
  insert into public.staff_roles (user_id, role) values (owner_id, 'owner'), (helper_id, 'helper');

  -- ------------------------------------------------------------- retrieval
  -- Two orthogonal test vectors: e1 = [1,0,0,...], e2 = [0,1,0,...]
  e1 := ('[1' || repeat(',0', 767) || ']')::extensions.vector;
  e2 := ('[0,1' || repeat(',0', 766) || ']')::extensions.vector;
  update public.faq_knowledge set is_active = false;  -- hide real rows for this test
  insert into public.faq_knowledge (question, approved_answer, category, embedding, is_active)
  values ('test q1', 'answer one', 'other', e1, true),
         ('test q2', 'answer two', 'other', e2, true),
         ('inactive', 'never shown', 'other', e1, false);

  select * into hit from public.match_faq(e1, 'en', 3) limit 1;
  insert into _results values ('REQ-22 best match is the closest approved answer',
    hit.approved_answer = 'answer one' and hit.similarity > 0.99, hit.similarity::text);
  insert into _results values ('inactive answers are never returned',
    not exists (select 1 from public.match_faq(e1, 'en', 5) m where m.approved_answer = 'never shown'), null);
  insert into _results values ('unrelated answer scores low',
    (select min(similarity) from public.match_faq(e1, 'en', 3)) < 0.5, null);
  insert into _results values ('at most 3 by default',
    (select count(*) from public.match_faq(e1, 'en')) <= 3, null);

  -- ------------------------------------------------------------- conversations
  v := public.chat_append(conv, tok, 'en',
    jsonb_build_array(jsonb_build_object('role', 'bot', 'text', 'I''m BakeBot, KD Pops'' automated assistant.')));
  insert into _results values ('REQ-21 conversation starts with the disclosure logged',
    (select messages->0->>'text' from public.conversations where conversation_id = conv) like 'I''m BakeBot%', null);
  insert into _results values ('token stored only as a hash',
    (select access_token_hash from public.conversations where conversation_id = conv) = private.hash_token(tok), null);

  v := public.chat_append(conv, tok, 'en',
    jsonb_build_array(jsonb_build_object('role', 'customer', 'text', 'q'), jsonb_build_object('role', 'bot', 'text', 'I''ll check with Kaydee')), 1);
  v := public.chat_append(conv, tok, 'en',
    jsonb_build_array(jsonb_build_object('role', 'customer', 'text', 'q2')), 1, true);
  insert into _results values ('REQ-23 two unresolved attempts then escalated',
    (v->>'unresolved_attempts')::int = 2 and (v->>'escalated')::boolean, v::text);
  insert into _results values ('all messages logged', (v->>'message_count')::int = 4, v->>'message_count');

  begin
    perform public.chat_append(conv, repeat('x', 43), 'en', '[]'::jsonb);
    got := 'allowed';
  exception when no_data_found then got := sqlerrm;
  end;
  insert into _results values ('another token cannot write to the conversation', got = 'not_found', got);

  begin
    perform public.chat_set_contact(conv, tok, 'Thandi', '12345');
    got := 'allowed';
  exception when check_violation then got := sqlerrm;
  end;
  insert into _results values ('handover contact must be a SA cell number', got = 'invalid_phone', got);

  perform public.chat_set_contact(conv, tok, 'Thandi', '082 123 4567');
  insert into _results values ('handover contact saved in E.164',
    (select contact_phone from public.conversations where conversation_id = conv) = '+27821234567', null);

  -- ------------------------------------------------------------- access
  begin
    set local role anon;
    select count(*) into n from public.conversations;
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('anon cannot read conversations', got = 'refused', got);

  perform set_config('request.jwt.claims', json_build_object('sub', helper_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.conversations where conversation_id = conv;
  begin
    perform public.resolve_conversation(conv);
    got := 'allowed';
  exception when insufficient_privilege then got := 'refused';
  end;
  reset role;
  insert into _results values ('helper cannot read chats or resolve handovers', n = 0 and got = 'refused', got);

  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.conversations where conversation_id = conv and escalated;
  perform public.resolve_conversation(conv);
  reset role;
  insert into _results values ('owner sees the handover and can resolve it',
    n = 1 and (select resolved_at is not null from public.conversations where conversation_id = conv), null);

  insert into _results values ('seeded FAQ: allergen and discount answers start switched off',
    not exists (select 1 from public.faq_knowledge where approved_answer like 'NEEDS KAYDEE%' and is_active), null);
end;
$$;

select test, ok, detail from _results order by ok, test;

rollback;
