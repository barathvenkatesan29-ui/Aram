-- Checkpoint 4B: situation-understanding storage.
-- persist_complete_initial_analysis is the canonical atomic APPLICATION path.
-- It is not an exclusive security boundary: authenticated owners can still insert
-- their own rows through the Supabase API, subject to RLS and composite FKs.
-- Phase 5 must not treat the existence of a case_analyses row as proof that
-- Aram's model produced it.
--
-- Rollback (drop functions/triggers before tables; do not drop public.cases):
--   1. drop function public.persist_complete_initial_analysis(uuid, jsonb, text, text, text, text, jsonb);
--   2. drop trigger case_analyses_validate_follow_up on public.case_analyses;
--   3. drop function public.validate_case_analysis_follow_up();
--   4. drop trigger case_questions_set_updated_at on public.case_questions;
--   5. drop function public.set_case_questions_updated_at();
--   6. drop table public.case_questions;
--   7. drop table public.case_analyses;
--   8. alter table public.cases drop constraint cases_id_user_id_key;

alter table public.cases
  add constraint cases_id_user_id_key unique (id, user_id);

create table public.case_analyses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  round text not null,
  parent_analysis_id uuid,
  status text not null,
  failure_code text,
  understanding jsonb,
  source_description_hash text not null,
  source_answers_hash text not null,
  provider_id text not null,
  model_name text not null,
  created_at timestamptz not null default now(),
  constraint case_analyses_case_owner_fk
    foreign key (case_id, user_id)
    references public.cases (id, user_id)
    on delete cascade,
  constraint case_analyses_id_case_user_key
    unique (id, case_id, user_id),
  constraint case_analyses_parent_fk
    foreign key (parent_analysis_id, case_id, user_id)
    references public.case_analyses (id, case_id, user_id)
    on delete cascade,
  constraint case_analyses_round_check
    check (round in ('initial', 'follow_up')),
  constraint case_analyses_status_check
    check (status in ('complete', 'failed')),
  constraint case_analyses_round_parent_check
    check (
      (round = 'initial' and parent_analysis_id is null)
      or
      (round = 'follow_up' and parent_analysis_id is not null)
    ),
  constraint case_analyses_complete_payload_check
    check (
      (
        status = 'complete'
        and understanding is not null
        and failure_code is null
      )
      or
      (
        status = 'failed'
        and understanding is null
        and failure_code is not null
      )
    ),
  constraint case_analyses_failure_code_check
    check (
      failure_code is null
      or failure_code in (
        'timeout',
        'invalid-output',
        'rate-limited',
        'unavailable'
      )
    ),
  constraint case_analyses_understanding_object_check
    check (
      understanding is null
      or jsonb_typeof(understanding) = 'object'
    ),
  constraint case_analyses_provider_id_check
    check (char_length(trim(provider_id)) > 0),
  constraint case_analyses_model_name_check
    check (char_length(trim(model_name)) > 0)
);

create index case_analyses_case_id_created_at_id_idx
  on public.case_analyses (case_id, created_at desc, id desc);

create index case_analyses_parent_analysis_id_idx
  on public.case_analyses (parent_analysis_id);

create unique index case_analyses_one_complete_follow_up_idx
  on public.case_analyses (parent_analysis_id)
  where round = 'follow_up' and status = 'complete';

create table public.case_questions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  user_id uuid not null,
  analysis_id uuid not null,
  position integer not null,
  question text not null,
  why_it_matters text not null,
  status text not null default 'pending',
  answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_questions_analysis_owner_fk
    foreign key (analysis_id, case_id, user_id)
    references public.case_analyses (id, case_id, user_id)
    on delete cascade,
  constraint case_questions_analysis_position_key
    unique (analysis_id, position),
  constraint case_questions_position_check
    check (position between 1 and 5),
  constraint case_questions_question_length_check
    check (char_length(trim(question)) between 1 and 2000),
  constraint case_questions_why_it_matters_length_check
    check (char_length(trim(why_it_matters)) between 1 and 2000),
  constraint case_questions_status_check
    check (status in ('pending', 'answered', 'skipped')),
  constraint case_questions_answer_length_check
    check (answer is null or char_length(answer) <= 2000),
  constraint case_questions_status_answer_check
    check (
      (status in ('pending', 'skipped') and answer is null)
      or
      (
        status = 'answered'
        and answer is not null
        and char_length(answer) <= 2000
        and char_length(trim(answer)) between 1 and 2000
      )
    )
);

create function public.set_case_questions_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger case_questions_set_updated_at
before update on public.case_questions
for each row
execute function public.set_case_questions_updated_at();

-- Follow-up checks live on case_analyses and may query case_questions.
-- Do not put this validation in a case_analyses RLS policy (recursive RLS).
create function public.validate_case_analysis_follow_up()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_round text;
  parent_status text;
  question_count integer;
  pending_count integer;
begin
  if new.round is distinct from 'follow_up' then
    return new;
  end if;

  select parent.round, parent.status
    into parent_round, parent_status
  from public.case_analyses as parent
  where parent.id = new.parent_analysis_id;

  if not found
     or parent_round is distinct from 'initial'
     or parent_status is distinct from 'complete' then
    raise exception 'follow-up parent must be a complete initial analysis';
  end if;

  select count(*)::integer
    into question_count
  from public.case_questions
  where analysis_id = new.parent_analysis_id;

  if question_count = 0 then
    raise exception 'follow-up is not valid when the parent initial has no questions';
  end if;

  if new.status = 'complete' then
    select count(*)::integer
      into pending_count
    from public.case_questions
    where analysis_id = new.parent_analysis_id
      and status = 'pending';

    if pending_count > 0 then
      raise exception 'complete follow-up requires no pending parent questions';
    end if;
  end if;

  return new;
end;
$$;

create trigger case_analyses_validate_follow_up
before insert or update on public.case_analyses
for each row
execute function public.validate_case_analysis_follow_up();

create function public.persist_complete_initial_analysis(
  p_case_id uuid,
  p_understanding jsonb,
  p_source_description_hash text,
  p_source_answers_hash text,
  p_provider_id text,
  p_model_name text,
  p_questions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_analysis_id uuid;
  v_question_count integer;
  v_index integer;
  v_item jsonb;
  v_key_count integer;
  v_position integer;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'questions must be a JSON array';
  end if;

  v_question_count := jsonb_array_length(p_questions);

  if v_question_count > 5 then
    raise exception 'questions must have 0 to 5 items';
  end if;

  v_index := 0;
  while v_index < v_question_count loop
    v_item := p_questions -> v_index;

    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'each question must be an object';
    end if;

    if v_item ? 'id' then
      raise exception 'question ids are assigned by the database';
    end if;

    select count(*)::integer
      into v_key_count
    from jsonb_object_keys(v_item) as question_key;

    if v_key_count is distinct from 3
       or not (v_item ? 'position')
       or not (v_item ? 'question')
       or not (v_item ? 'why_it_matters') then
      raise exception 'each question must have only position, question, and why_it_matters';
    end if;

    if jsonb_typeof(v_item -> 'position') is distinct from 'number'
       or jsonb_typeof(v_item -> 'question') is distinct from 'string'
       or jsonb_typeof(v_item -> 'why_it_matters') is distinct from 'string' then
      raise exception 'each question must have only position, question, and why_it_matters';
    end if;

    v_position := (v_item ->> 'position')::integer;

    if v_position is distinct from (v_index + 1) then
      raise exception 'question positions must be 1..n with no gaps';
    end if;

    v_index := v_index + 1;
  end loop;

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
    'initial',
    null,
    'complete',
    null,
    p_understanding,
    p_source_description_hash,
    p_source_answers_hash,
    p_provider_id,
    p_model_name
  )
  returning id into v_analysis_id;

  v_index := 0;
  while v_index < v_question_count loop
    v_item := p_questions -> v_index;

    insert into public.case_questions (
      case_id,
      user_id,
      analysis_id,
      position,
      question,
      why_it_matters
    )
    values (
      p_case_id,
      v_user_id,
      v_analysis_id,
      (v_item ->> 'position')::integer,
      v_item ->> 'question',
      v_item ->> 'why_it_matters'
    );

    v_index := v_index + 1;
  end loop;

  return v_analysis_id;
end;
$$;

alter table public.case_analyses enable row level security;
alter table public.case_analyses force row level security;

alter table public.case_questions enable row level security;
alter table public.case_questions force row level security;

revoke all on table public.case_analyses from public;
revoke all on table public.case_analyses from anon, authenticated;

revoke all on table public.case_questions from public;
revoke all on table public.case_questions from anon, authenticated;

grant select on table public.case_analyses to authenticated;
grant insert (
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
) on table public.case_analyses to authenticated;

grant select on table public.case_questions to authenticated;
grant insert (
  case_id,
  user_id,
  analysis_id,
  position,
  question,
  why_it_matters
) on table public.case_questions to authenticated;
grant update (status, answer) on table public.case_questions to authenticated;

revoke all on function public.set_case_questions_updated_at()
  from public, anon, authenticated;
revoke all on function public.validate_case_analysis_follow_up()
  from public, anon, authenticated;
revoke all on function public.persist_complete_initial_analysis(
  uuid,
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function public.persist_complete_initial_analysis(
  uuid,
  jsonb,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

create policy case_analyses_select_own
  on public.case_analyses
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy case_analyses_insert_own
  on public.case_analyses
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.cases as owned_case
      where owned_case.id = case_id
        and owned_case.user_id = (select auth.uid())
    )
  );

create policy case_questions_select_own
  on public.case_questions
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy case_questions_insert_own
  on public.case_questions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.case_analyses as analysis
      where analysis.id = analysis_id
        and analysis.case_id = case_questions.case_id
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
    and not exists (
      select 1
      from public.case_analyses as follow_up
      where follow_up.parent_analysis_id = case_questions.analysis_id
        and follow_up.round = 'follow_up'
        and follow_up.status = 'complete'
    )
  );

create policy case_questions_update_own
  on public.case_questions
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and not exists (
      select 1
      from public.case_analyses as follow_up
      where follow_up.parent_analysis_id = case_questions.analysis_id
        and follow_up.round = 'follow_up'
        and follow_up.status = 'complete'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1
      from public.case_analyses as follow_up
      where follow_up.parent_analysis_id = case_questions.analysis_id
        and follow_up.round = 'follow_up'
        and follow_up.status = 'complete'
    )
  );
