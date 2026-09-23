-- Checkpoint 4D correction: multiple material clarifications, skip, and adaptive stop.
-- Additive. Does not change cases.description, RLS ownership, or invoker-only RPCs.
--
-- Why:
--   The previous 0-or-1 keep_question_id cannot persist a refined multi-question
--   carousel, skip remaining questions after reassessment, or follow-up only after
--   the keep-set is settled.
--
-- Affected objects:
--   - public.case_analysis_askability.keep_question_ids uuid[]
--   - replace public.finalise_optional_clarification(uuid, uuid)
--     with public.finalise_optional_clarification(uuid, uuid[])
--   - replace public.answer_optional_clarification(uuid, text)
--   - new public.skip_optional_clarification(uuid)
--   - replace public.persist_complete_follow_up(...)
--
-- Security:
--   Invoker RPCs, owner-scoped, no service-role. Insert-only askability. Answers
--   and skips never rewrite cases.description. Skip does not insert a message.
--
-- Rollback:
--   Restore the previous 4D objects before dropping keep_question_ids, because
--   case_analysis_askability_insert_own references that column after this
--   migration. Do not drop the column while the new insert policy is live.
--   1. drop function public.skip_optional_clarification(uuid);
--   2. drop function public.finalise_optional_clarification(uuid, uuid[]);
--   3. restore the 4D finalise/answer/follow-up function bodies from
--      20260921170000_checkpoint_4d_clarification.sql
--      (recreates public.finalise_optional_clarification(uuid, uuid));
--   4. drop policy case_analysis_askability_insert_own
--      on public.case_analysis_askability;
--   5. recreate the previous 4D case_analysis_askability_insert_own policy from
--      20260921170000_checkpoint_4d_clarification.sql
--      (it does not reference keep_question_ids);
--   6. revoke insert (keep_question_ids) on table public.case_analysis_askability
--      from authenticated;
--   7. alter table public.case_analysis_askability
--        drop constraint case_analysis_askability_keep_ids_match,
--        drop constraint case_analysis_askability_keep_ids_limit;
--   8. alter table public.case_analysis_askability drop column keep_question_ids;
--   Do not drop pgcrypto or public.js_string_trim.

alter table public.case_analysis_askability
  add column keep_question_ids uuid[] not null default '{}'::uuid[];

update public.case_analysis_askability
set keep_question_ids = case
  when keep_question_id is null then '{}'::uuid[]
  else array[keep_question_id]
end
where keep_question_ids = '{}'::uuid[]
  and keep_question_id is not null;

alter table public.case_analysis_askability
  add constraint case_analysis_askability_keep_ids_limit
  check (cardinality(keep_question_ids) <= 5);

alter table public.case_analysis_askability
  add constraint case_analysis_askability_keep_ids_match
  check (
    (
      keep_question_id is null
      and cardinality(keep_question_ids) = 0
    )
    or (
      keep_question_id is not null
      and cardinality(keep_question_ids) > 0
      and keep_question_ids[1] = keep_question_id
    )
  );

grant insert (keep_question_ids) on table public.case_analysis_askability
  to authenticated;

drop policy case_analysis_askability_insert_own on public.case_analysis_askability;

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
          and owned_question.status = 'pending'
      )
    )
    and (
      select count(*)
      from unnest(keep_question_ids) as keep_id(id)
    ) = (
      select count(distinct keep_id.id)
      from unnest(keep_question_ids) as keep_id(id)
    )
    and not exists (
      select 1
      from unnest(keep_question_ids) as keep_id(id)
      where keep_id.id is null
         or not exists (
           select 1
           from public.case_questions as owned_question
           where owned_question.id = keep_id.id
             and owned_question.analysis_id = case_analysis_askability.analysis_id
             and owned_question.case_id = case_analysis_askability.case_id
             and owned_question.user_id = (select auth.uid())
             and owned_question.status = 'pending'
         )
    )
  );

drop function if exists public.finalise_optional_clarification(uuid, uuid);

create function public.finalise_optional_clarification(
  p_analysis_id uuid,
  p_keep_question_ids uuid[]
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
  v_first_keep_id uuid;
  v_existing_keep_question_ids uuid[];
  v_canonical_keep_ids uuid[];
  v_matching_keep_count integer;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_analysis_id is null then
    raise exception 'analysis id is required';
  end if;

  if p_keep_question_ids is null then
    raise exception 'keep question ids are required';
  end if;

  if cardinality(p_keep_question_ids) > 5 then
    raise exception 'keep question ids exceed the allowed maximum';
  end if;

  if exists (
    select 1
    from unnest(p_keep_question_ids) as keep_id(id)
    where keep_id.id is null
  ) then
    raise exception 'keep question not found';
  end if;

  if exists (
    select 1
    from unnest(p_keep_question_ids) as keep_id(id)
    group by keep_id.id
    having count(*) > 1
  ) then
    raise exception 'duplicate keep question';
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

  if cardinality(p_keep_question_ids) = 0 then
    v_canonical_keep_ids := '{}'::uuid[];
  else
    perform owned_question.id
    from public.case_questions as owned_question
    where owned_question.analysis_id = p_analysis_id
      and owned_question.case_id = v_case_id
      and owned_question.user_id = v_user_id
      and owned_question.id = any (p_keep_question_ids)
    for update;

    select count(*)
      into v_matching_keep_count
    from public.case_questions as owned_question
    where owned_question.analysis_id = p_analysis_id
      and owned_question.case_id = v_case_id
      and owned_question.user_id = v_user_id
      and owned_question.id = any (p_keep_question_ids);

    if v_matching_keep_count is distinct from cardinality(p_keep_question_ids) then
      raise exception 'keep question not found';
    end if;

    if exists (
      select 1
      from public.case_questions as owned_question
      where owned_question.analysis_id = p_analysis_id
        and owned_question.case_id = v_case_id
        and owned_question.user_id = v_user_id
        and owned_question.id = any (p_keep_question_ids)
        and owned_question.status is distinct from 'pending'
    ) then
      raise exception 'keep question not found';
    end if;

    select array_agg(
             owned_question.id
             order by owned_question.position asc, owned_question.id asc
           )
      into v_canonical_keep_ids
    from public.case_questions as owned_question
    where owned_question.analysis_id = p_analysis_id
      and owned_question.case_id = v_case_id
      and owned_question.user_id = v_user_id
      and owned_question.id = any (p_keep_question_ids);
  end if;

  select askability.keep_question_ids
    into v_existing_keep_question_ids
  from public.case_analysis_askability as askability
  where askability.analysis_id = p_analysis_id
    and askability.user_id = v_user_id;

  if found then
    if v_existing_keep_question_ids is not distinct from v_canonical_keep_ids then
      return;
    end if;

    raise exception 'askability decision conflict';
  end if;

  update public.case_questions
  set status = 'skipped'
  where analysis_id = p_analysis_id
    and case_id = v_case_id
    and user_id = v_user_id
    and status = 'pending'
    and (
      cardinality(v_canonical_keep_ids) = 0
      or id <> all (v_canonical_keep_ids)
    );

  if cardinality(v_canonical_keep_ids) > 0 then
    v_first_keep_id := v_canonical_keep_ids[1];
  else
    v_first_keep_id := null;
  end if;

  insert into public.case_analysis_askability (
    analysis_id,
    case_id,
    user_id,
    keep_question_id,
    keep_question_ids
  )
  values (
    p_analysis_id,
    v_case_id,
    v_user_id,
    v_first_keep_id,
    v_canonical_keep_ids
  );
end;
$$;

create or replace function public.answer_optional_clarification(
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
  v_stored_answer text;
  v_keep_question_ids uuid[];
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

  v_body := public.js_string_trim(p_body);

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

  select owned_question.analysis_id, owned_question.status, owned_question.answer
    into v_analysis_id, v_status, v_stored_answer
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

  select askability.keep_question_ids
    into v_keep_question_ids
  from public.case_analysis_askability as askability
  where askability.analysis_id = v_analysis_id
    and askability.user_id = v_user_id;

  if v_keep_question_ids is null
     or cardinality(v_keep_question_ids) = 0
     or p_question_id <> all (v_keep_question_ids) then
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

    if public.js_string_trim(coalesce(v_stored_answer, '')) is not distinct from v_body then
      return v_existing_message_id;
    end if;

    raise exception 'optional clarification answer conflict';
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

create function public.skip_optional_clarification(
  p_question_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_case_id uuid;
  v_analysis_id uuid;
  v_locked_case_id uuid;
  v_status text;
  v_keep_question_ids uuid[];
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

  select askability.keep_question_ids
    into v_keep_question_ids
  from public.case_analysis_askability as askability
  where askability.analysis_id = v_analysis_id
    and askability.user_id = v_user_id;

  if v_keep_question_ids is null
     or cardinality(v_keep_question_ids) = 0
     or p_question_id <> all (v_keep_question_ids) then
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

  if v_status = 'skipped' then
    return;
  end if;

  if v_status is distinct from 'pending' then
    raise exception 'optional clarification is not open';
  end if;

  update public.case_questions
  set status = 'skipped',
      answer = null
  where id = p_question_id
    and case_id = v_case_id
    and user_id = v_user_id
    and status = 'pending';

  if not found then
    raise exception 'optional clarification is not open';
  end if;

  if (
    select owned_case.description
    from public.cases as owned_case
    where owned_case.id = v_case_id
      and owned_case.user_id = v_user_id
  ) is distinct from v_description then
    raise exception 'answers must not rewrite the saved description';
  end if;
end;
$$;

create or replace function public.persist_complete_follow_up(
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
  v_keep_question_ids uuid[];
  v_pending_keep_count integer;
  v_answered_keep_count integer;
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

  select askability.keep_question_ids
    into v_keep_question_ids
  from public.case_analysis_askability as askability
  where askability.analysis_id = p_parent_analysis_id
    and askability.case_id = p_case_id
    and askability.user_id = v_user_id;

  if v_keep_question_ids is null or cardinality(v_keep_question_ids) = 0 then
    raise exception 'follow-up requires an answered optional clarification';
  end if;

  select count(*)::integer
    into v_pending_keep_count
  from public.case_questions as owned_question
  where owned_question.analysis_id = p_parent_analysis_id
    and owned_question.case_id = p_case_id
    and owned_question.user_id = v_user_id
    and owned_question.id = any (v_keep_question_ids)
    and owned_question.status = 'pending';

  if v_pending_keep_count > 0 then
    raise exception 'complete follow-up requires no pending parent questions';
  end if;

  select count(*)::integer
    into v_answered_keep_count
  from public.case_questions as owned_question
  where owned_question.analysis_id = p_parent_analysis_id
    and owned_question.case_id = p_case_id
    and owned_question.user_id = v_user_id
    and owned_question.id = any (v_keep_question_ids)
    and owned_question.status = 'answered'
    and exists (
      select 1
      from public.case_messages as message
      where message.question_id = owned_question.id
        and message.case_id = p_case_id
        and message.user_id = v_user_id
    );

  if v_answered_keep_count < 1 then
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

  if v_canonical_answers is null then
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

revoke all on function public.finalise_optional_clarification(uuid, uuid[])
  from public, anon;
revoke all on function public.answer_optional_clarification(uuid, text)
  from public, anon;
revoke all on function public.skip_optional_clarification(uuid)
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

grant execute on function public.finalise_optional_clarification(uuid, uuid[])
  to authenticated;
grant execute on function public.answer_optional_clarification(uuid, text)
  to authenticated;
grant execute on function public.skip_optional_clarification(uuid)
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
