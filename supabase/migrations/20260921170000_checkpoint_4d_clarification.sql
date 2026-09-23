-- Checkpoint 4D: optional clarification finalise, answer, and follow-up persist.
-- Additive. Does not replace persist_complete_initial_analysis or 4C message RPCs.
-- Does not change the stub provider. Normal 4D behaviour stays zero optional asks.
--
-- Why required:
--   Opening a conversation is read-only. The 0-or-1 askability decision cannot be
--   derived from pending/skipped shape when inventory has a single question
--   (4C stub "When did this happen?" vs a genuine one-ask). An insert-only
--   owner-scoped row records that decision on a write path.
--   Skipping unused inventory, recording one opted-in answer, and persisting a
--   questionless follow-up must be atomic, owner-scoped, and must not rewrite
--   cases.description. Authenticated has no UPDATE grant on case_analyses.
--
-- Affected existing objects:
--   - none replaced
--   - new table public.case_analysis_askability
--   - new functions (invoker): finalise_optional_clarification,
--     answer_optional_clarification, persist_complete_follow_up
--   - additive unique index on case_messages(question_id) where not null
--   - pgcrypto (if not already present) for the existing SHA-256 description hash
--   - reads/locks owned rows in public.cases, case_analyses, case_questions,
--     case_messages
--
-- Rollback:
--   1. drop function public.persist_complete_follow_up(uuid, uuid, jsonb, text, text, text, text);
--   2. drop function public.answer_optional_clarification(uuid, text);
--   3. drop function public.finalise_optional_clarification(uuid, uuid);
--   4. drop function public.js_string_trim(text);
--   5. drop index public.case_messages_question_id_key;
--   6. drop table public.case_analysis_askability;
--   Do not drop pgcrypto; it already exists in the linked project.
--
-- Security:
--   - security invoker, search_path empty
--   - auth.uid() owner checks and FOR UPDATE on the owned case
--   - RLS forced on the new table; select/insert own; no update/delete
--   - grant execute to authenticated only; revoke public/anon
--   - no service-role
--   - answers never update public.cases.description
--
-- Description hash: the same algorithm as src/features/situation-understanding/hashCaseInput.ts
-- hashCaseDescription — SHA-256 hex of UTF-8 String.prototype.trim(description),
-- implemented in SQL as public.js_string_trim. Empty answers hash is SHA-256 hex
-- of UTF-8 '[]', matching hashCanonicalAnswers([]). Follow-up answers hash is
-- SHA-256 of serializeCanonicalAnswers (compact JSON.stringify key order).

create extension if not exists pgcrypto with schema extensions;

-- Same code points as ECMAScript String.prototype.trim() (WhiteSpace + LineTerminator).
create function public.js_string_trim(p_value text)
returns text
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select case
    when p_value is null then null
    else regexp_replace(
      p_value,
      '^' || U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]' ||
      '+|' ||
      U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]' ||
      '+$',
      '',
      'g'
    )
  end;
$$;

revoke all on function public.js_string_trim(text) from public, anon;
grant execute on function public.js_string_trim(text) to authenticated;

create table public.case_analysis_askability (
  analysis_id uuid primary key,
  case_id uuid not null,
  user_id uuid not null,
  keep_question_id uuid,
  created_at timestamptz not null default now(),
  constraint case_analysis_askability_analysis_owner_fk
    foreign key (analysis_id, case_id, user_id)
    references public.case_analyses (id, case_id, user_id)
    on delete cascade,
  constraint case_analysis_askability_keep_question_fk
    foreign key (keep_question_id, case_id, user_id)
    references public.case_questions (id, case_id, user_id)
);

create index case_analysis_askability_case_id_idx
  on public.case_analysis_askability (case_id);

alter table public.case_analysis_askability enable row level security;
alter table public.case_analysis_askability force row level security;

revoke all on table public.case_analysis_askability from public;
revoke all on table public.case_analysis_askability from anon, authenticated;

grant select on table public.case_analysis_askability to authenticated;
grant insert (
  analysis_id,
  case_id,
  user_id,
  keep_question_id
) on table public.case_analysis_askability to authenticated;

create policy case_analysis_askability_select_own
  on public.case_analysis_askability
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy case_analysis_askability_insert_own
  on public.case_analysis_askability
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.case_analyses as analysis
      where analysis.id = analysis_id
        and analysis.case_id = case_analysis_askability.case_id
        and analysis.user_id = (select auth.uid())
        and analysis.round = 'initial'
        and analysis.status = 'complete'
    )
    and exists (
      select 1
      from public.cases as owned_case
      where owned_case.id = case_id
        and owned_case.user_id = (select auth.uid())
    )
    and (
      keep_question_id is null
      or exists (
        select 1
        from public.case_questions as owned_question
        where owned_question.id = keep_question_id
          and owned_question.analysis_id = case_analysis_askability.analysis_id
          and owned_question.case_id = case_analysis_askability.case_id
          and owned_question.user_id = (select auth.uid())
      )
    )
  );

create unique index case_messages_question_id_key
  on public.case_messages (question_id)
  where question_id is not null;

create function public.finalise_optional_clarification(
  p_analysis_id uuid,
  p_keep_question_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_case_id uuid;
  v_locked_case_id uuid;
  v_description text;
  v_description_hash text;
  v_empty_answers_hash text;
  v_current_initial_id uuid;
  v_round text;
  v_status text;
  v_keep_status text;
  v_existing_keep_question_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_analysis_id is null then
    raise exception 'analysis id is required';
  end if;

  select analysis.case_id, analysis.round, analysis.status
    into v_case_id, v_round, v_status
  from public.case_analyses as analysis
  where analysis.id = p_analysis_id
    and analysis.user_id = v_user_id;

  if v_case_id is null
     or v_round is distinct from 'initial'
     or v_status is distinct from 'complete' then
    raise exception 'analysis not found';
  end if;

  select owned_case.id, owned_case.description
    into v_locked_case_id, v_description
  from public.cases as owned_case
  where owned_case.id = v_case_id
    and owned_case.user_id = v_user_id
  for update;

  if v_locked_case_id is null then
    raise exception 'case not found';
  end if;

  v_description_hash := encode(
    extensions.digest(
      convert_to(public.js_string_trim(v_description), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  v_empty_answers_hash := encode(
    extensions.digest(convert_to('[]', 'UTF8'), 'sha256'),
    'hex'
  );

  select analysis.id
    into v_current_initial_id
  from public.case_analyses as analysis
  where analysis.case_id = v_case_id
    and analysis.user_id = v_user_id
    and analysis.round = 'initial'
    and analysis.status = 'complete'
    and analysis.source_description_hash = v_description_hash
    and analysis.source_answers_hash = v_empty_answers_hash
  order by analysis.created_at desc, analysis.id desc
  limit 1;

  if v_current_initial_id is distinct from p_analysis_id then
    raise exception 'analysis is not the current initial';
  end if;

  select askability.keep_question_id
    into v_existing_keep_question_id
  from public.case_analysis_askability as askability
  where askability.analysis_id = p_analysis_id
    and askability.user_id = v_user_id;

  if found then
    if v_existing_keep_question_id is not distinct from p_keep_question_id then
      return;
    end if;

    raise exception 'askability decision conflict';
  end if;

  if p_keep_question_id is not null then
    select owned_question.status
      into v_keep_status
    from public.case_questions as owned_question
    where owned_question.id = p_keep_question_id
      and owned_question.analysis_id = p_analysis_id
      and owned_question.case_id = v_case_id
      and owned_question.user_id = v_user_id
    for update;

    if v_keep_status is null or v_keep_status is distinct from 'pending' then
      raise exception 'keep question not found';
    end if;
  end if;

  update public.case_questions
  set status = 'skipped'
  where analysis_id = p_analysis_id
    and case_id = v_case_id
    and user_id = v_user_id
    and status = 'pending'
    and (
      p_keep_question_id is null
      or id is distinct from p_keep_question_id
    );

  insert into public.case_analysis_askability (
    analysis_id,
    case_id,
    user_id,
    keep_question_id
  )
  values (
    p_analysis_id,
    v_case_id,
    v_user_id,
    p_keep_question_id
  );
end;
$$;

create function public.answer_optional_clarification(
  p_question_id uuid,
  p_body text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_body text;
  v_case_id uuid;
  v_analysis_id uuid;
  v_locked_case_id uuid;
  v_status text;
  v_keep_question_id uuid;
  v_existing_message_id uuid;
  v_message_id uuid;
  v_description text;
  v_description_hash text;
  v_empty_answers_hash text;
  v_current_initial_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_question_id is null then
    raise exception 'question id is required';
  end if;

  if p_body is null then
    raise exception 'answer body is required';
  end if;

  v_body := trim(both from p_body);

  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'answer body must be between 1 and 2000 characters';
  end if;

  if char_length(p_body) > 2000 then
    raise exception 'answer body must be between 1 and 2000 characters';
  end if;

  select owned_question.case_id
    into v_case_id
  from public.case_questions as owned_question
  where owned_question.id = p_question_id
    and owned_question.user_id = v_user_id;

  if v_case_id is null then
    raise exception 'question not found';
  end if;

  select owned_case.id, owned_case.description
    into v_locked_case_id, v_description
  from public.cases as owned_case
  where owned_case.id = v_case_id
    and owned_case.user_id = v_user_id
  for update;

  if v_locked_case_id is null then
    raise exception 'case not found';
  end if;

  select owned_question.analysis_id, owned_question.status
    into v_analysis_id, v_status
  from public.case_questions as owned_question
  where owned_question.id = p_question_id
    and owned_question.case_id = v_case_id
    and owned_question.user_id = v_user_id
  for update;

  if v_analysis_id is null then
    raise exception 'question not found';
  end if;

  v_description_hash := encode(
    extensions.digest(
      convert_to(public.js_string_trim(v_description), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  v_empty_answers_hash := encode(
    extensions.digest(convert_to('[]', 'UTF8'), 'sha256'),
    'hex'
  );

  select analysis.id
    into v_current_initial_id
  from public.case_analyses as analysis
  where analysis.case_id = v_case_id
    and analysis.user_id = v_user_id
    and analysis.round = 'initial'
    and analysis.status = 'complete'
    and analysis.source_description_hash = v_description_hash
    and analysis.source_answers_hash = v_empty_answers_hash
  order by analysis.created_at desc, analysis.id desc
  limit 1;

  if v_current_initial_id is distinct from v_analysis_id then
    raise exception 'analysis is not the current initial';
  end if;

  select askability.keep_question_id
    into v_keep_question_id
  from public.case_analysis_askability as askability
  where askability.analysis_id = v_analysis_id
    and askability.user_id = v_user_id;

  if v_keep_question_id is null
     or v_keep_question_id is distinct from p_question_id then
    raise exception 'optional clarification is not open';
  end if;

  if exists (
    select 1
    from public.case_analyses as follow_up
    where follow_up.parent_analysis_id = v_analysis_id
      and follow_up.round = 'follow_up'
      and follow_up.status = 'complete'
  ) then
    raise exception 'optional clarification is not open';
  end if;

  select message.id
    into v_existing_message_id
  from public.case_messages as message
  where message.question_id = p_question_id
    and message.user_id = v_user_id;

  if v_status = 'answered' then
    if v_existing_message_id is null then
      raise exception 'optional clarification is not open';
    end if;

    return v_existing_message_id;
  end if;

  if v_status is distinct from 'pending' then
    raise exception 'optional clarification is not open';
  end if;

  update public.case_questions
  set status = 'answered',
      answer = v_body
  where id = p_question_id
    and case_id = v_case_id
    and user_id = v_user_id
    and status = 'pending';

  if not found then
    raise exception 'optional clarification is not open';
  end if;

  insert into public.case_messages (
    case_id,
    user_id,
    body,
    source,
    question_id
  )
  values (
    v_case_id,
    v_user_id,
    v_body,
    'text',
    p_question_id
  )
  returning id into v_message_id;

  if (
    select owned_case.description
    from public.cases as owned_case
    where owned_case.id = v_case_id
      and owned_case.user_id = v_user_id
  ) is distinct from v_description then
    raise exception 'answers must not rewrite the saved description';
  end if;

  return v_message_id;
end;
$$;

create function public.persist_complete_follow_up(
  p_case_id uuid,
  p_parent_analysis_id uuid,
  p_understanding jsonb,
  p_source_description_hash text,
  p_source_answers_hash text,
  p_provider_id text,
  p_model_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_locked_case_id uuid;
  v_description text;
  v_description_hash text;
  v_empty_answers_hash text;
  v_current_initial_id uuid;
  v_parent_round text;
  v_parent_status text;
  v_parent_description_hash text;
  v_keep_question_id uuid;
  v_keep_status text;
  v_pending_count integer;
  v_canonical_answers text;
  v_answers_hash text;
  v_analysis_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_case_id is null or p_parent_analysis_id is null then
    raise exception 'case and parent analysis are required';
  end if;

  select owned_case.id, owned_case.description
    into v_locked_case_id, v_description
  from public.cases as owned_case
  where owned_case.id = p_case_id
    and owned_case.user_id = v_user_id
  for update;

  if v_locked_case_id is null then
    raise exception 'case not found';
  end if;

  v_description_hash := encode(
    extensions.digest(
      convert_to(public.js_string_trim(v_description), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  v_empty_answers_hash := encode(
    extensions.digest(convert_to('[]', 'UTF8'), 'sha256'),
    'hex'
  );

  if p_source_description_hash is distinct from v_description_hash then
    raise exception 'analysis is not the current initial';
  end if;

  select analysis.id
    into v_current_initial_id
  from public.case_analyses as analysis
  where analysis.case_id = p_case_id
    and analysis.user_id = v_user_id
    and analysis.round = 'initial'
    and analysis.status = 'complete'
    and analysis.source_description_hash = v_description_hash
    and analysis.source_answers_hash = v_empty_answers_hash
  order by analysis.created_at desc, analysis.id desc
  limit 1;

  if v_current_initial_id is distinct from p_parent_analysis_id then
    raise exception 'analysis is not the current initial';
  end if;

  select parent.round, parent.status, parent.source_description_hash
    into v_parent_round, v_parent_status, v_parent_description_hash
  from public.case_analyses as parent
  where parent.id = p_parent_analysis_id
    and parent.case_id = p_case_id
    and parent.user_id = v_user_id;

  if v_parent_round is distinct from 'initial'
     or v_parent_status is distinct from 'complete'
     or v_parent_description_hash is distinct from v_description_hash then
    raise exception 'follow-up parent must be a complete initial analysis';
  end if;

  select askability.keep_question_id
    into v_keep_question_id
  from public.case_analysis_askability as askability
  where askability.analysis_id = p_parent_analysis_id
    and askability.case_id = p_case_id
    and askability.user_id = v_user_id;

  if v_keep_question_id is null then
    raise exception 'follow-up requires an answered optional clarification';
  end if;

  select owned_question.status
    into v_keep_status
  from public.case_questions as owned_question
  where owned_question.id = v_keep_question_id
    and owned_question.analysis_id = p_parent_analysis_id
    and owned_question.case_id = p_case_id
    and owned_question.user_id = v_user_id;

  if v_keep_status is distinct from 'answered' then
    raise exception 'follow-up requires an answered optional clarification';
  end if;

  if not exists (
    select 1
    from public.case_messages as message
    where message.question_id = v_keep_question_id
      and message.case_id = p_case_id
      and message.user_id = v_user_id
  ) then
    raise exception 'follow-up requires an answered optional clarification';
  end if;

  select count(*)::integer
    into v_pending_count
  from public.case_questions
  where analysis_id = p_parent_analysis_id
    and case_id = p_case_id
    and user_id = v_user_id
    and status = 'pending';

  if v_pending_count > 0 then
    raise exception 'complete follow-up requires no pending parent questions';
  end if;

  select
    '[' || string_agg(
      '{"id":' || to_json(owned_question.id::text)::text ||
      ',"position":' || owned_question.position::text ||
      ',"status":' || to_json(owned_question.status)::text ||
      ',"answer":' || to_json(
        case
          when owned_question.status = 'answered'
            then coalesce(public.js_string_trim(owned_question.answer), '')
          else ''
        end
      )::text ||
      '}',
      ','
      order by owned_question.position
    ) || ']'
    into v_canonical_answers
  from public.case_questions as owned_question
  where owned_question.analysis_id = p_parent_analysis_id
    and owned_question.case_id = p_case_id
    and owned_question.user_id = v_user_id;

  if v_canonical_answers is null
     or position(
       v_keep_question_id::text
       in v_canonical_answers
     ) = 0 then
    raise exception 'follow-up requires an answered optional clarification';
  end if;

  v_answers_hash := encode(
    extensions.digest(convert_to(v_canonical_answers, 'UTF8'), 'sha256'),
    'hex'
  );

  if p_source_answers_hash is distinct from v_answers_hash then
    raise exception 'answers hash mismatch';
  end if;

  insert into public.case_analyses (
    case_id,
    user_id,
    round,
    parent_analysis_id,
    status,
    failure_code,
    understanding,
    source_description_hash,
    source_answers_hash,
    provider_id,
    model_name
  )
  values (
    p_case_id,
    v_user_id,
    'follow_up',
    p_parent_analysis_id,
    'complete',
    null,
    p_understanding,
    v_description_hash,
    v_answers_hash,
    p_provider_id,
    p_model_name
  )
  returning id into v_analysis_id;

  return v_analysis_id;
end;
$$;

revoke all on function public.finalise_optional_clarification(uuid, uuid)
  from public, anon;
revoke all on function public.answer_optional_clarification(uuid, text)
  from public, anon;
revoke all on function public.persist_complete_follow_up(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function public.finalise_optional_clarification(uuid, uuid)
  to authenticated;
grant execute on function public.answer_optional_clarification(uuid, text)
  to authenticated;
grant execute on function public.persist_complete_follow_up(
  uuid,
  uuid,
  jsonb,
  text,
  text,
  text,
  text
) to authenticated;
