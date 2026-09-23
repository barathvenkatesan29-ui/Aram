-- Checkpoint 4C chat: short descriptions, user-only messages, atomic create/append.
-- persist_complete_initial_analysis is unchanged.
--
-- Rollback (do not drop public.cases or 4B objects except the additive unique):
--   1. drop function public.append_pre_understanding_message(uuid, text);
--   2. drop function public.create_case_with_first_message(text);
--   3. drop table public.case_messages;
--   4. alter table public.case_questions drop constraint case_questions_id_case_user_key;
--   5. alter table public.cases drop column title;
--   6. alter table public.cases drop constraint cases_description_length_check;
--      alter table public.cases add constraint cases_description_length_check
--        check (char_length(trim(description)) between 50 and 8000);

alter table public.cases
  drop constraint cases_description_length_check;

alter table public.cases
  add constraint cases_description_length_check
  check (char_length(trim(description)) between 1 and 8000);

alter table public.cases
  add column title text;

alter table public.cases
  add constraint cases_title_length_check
  check (
    title is null
    or char_length(trim(title)) between 1 and 80
  );

grant update (title) on table public.cases to authenticated;

alter table public.case_questions
  add constraint case_questions_id_case_user_key unique (id, case_id, user_id);

create table public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  user_id uuid not null,
  body text not null,
  source text not null default 'text',
  question_id uuid,
  created_at timestamptz not null default now(),
  constraint case_messages_case_owner_fk
    foreign key (case_id, user_id)
    references public.cases (id, user_id)
    on delete cascade,
  constraint case_messages_question_owner_fk
    foreign key (question_id, case_id, user_id)
    references public.case_questions (id, case_id, user_id),
  constraint case_messages_body_length_check
    check (char_length(trim(body)) between 1 and 8000),
  constraint case_messages_source_check
    check (source = 'text')
);

create index case_messages_case_id_created_at_id_idx
  on public.case_messages (case_id, created_at asc, id asc);

alter table public.case_messages enable row level security;
alter table public.case_messages force row level security;

revoke all on table public.case_messages from public;
revoke all on table public.case_messages from anon, authenticated;

grant select on table public.case_messages to authenticated;
grant insert (
  case_id,
  user_id,
  body,
  source,
  question_id
) on table public.case_messages to authenticated;

create policy case_messages_select_own
  on public.case_messages
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy case_messages_insert_own
  on public.case_messages
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
    and (
      question_id is null
      or exists (
        select 1
        from public.case_questions as owned_question
        where owned_question.id = question_id
          and owned_question.case_id = case_messages.case_id
          and owned_question.user_id = (select auth.uid())
      )
    )
  );

create function public.create_case_with_first_message(p_body text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_body text;
  v_case_id uuid;
  v_message_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_body is null then
    raise exception 'message body is required';
  end if;

  v_body := trim(both from p_body);

  if char_length(v_body) < 1 or char_length(v_body) > 8000 then
    raise exception 'message body must be between 1 and 8000 characters';
  end if;

  insert into public.cases (user_id, description)
  values (v_user_id, v_body)
  returning id into v_case_id;

  insert into public.case_messages (case_id, user_id, body, source)
  values (v_case_id, v_user_id, v_body, 'text')
  returning id into v_message_id;

  return jsonb_build_object(
    'case_id', v_case_id,
    'message_id', v_message_id
  );
end;
$$;

create function public.append_pre_understanding_message(
  p_case_id uuid,
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
  v_message_id uuid;
  v_narrative text;
  v_locked_case_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_case_id is null then
    raise exception 'case id is required';
  end if;

  if p_body is null then
    raise exception 'message body is required';
  end if;

  v_body := trim(both from p_body);

  if char_length(v_body) < 1 or char_length(v_body) > 8000 then
    raise exception 'message body must be between 1 and 8000 characters';
  end if;

  select owned_case.id
    into v_locked_case_id
  from public.cases as owned_case
  where owned_case.id = p_case_id
    and owned_case.user_id = v_user_id
  for update;

  if v_locked_case_id is null then
    raise exception 'case not found';
  end if;

  insert into public.case_messages (case_id, user_id, body, source)
  values (p_case_id, v_user_id, v_body, 'text')
  returning id into v_message_id;

  select trim(both from coalesce(
    string_agg(
      trim(both from message.body),
      E'\n\n'
      order by message.created_at asc, message.id asc
    ),
    ''
  ))
    into v_narrative
  from public.case_messages as message
  where message.case_id = p_case_id
    and message.user_id = v_user_id
    and message.question_id is null;

  if char_length(v_narrative) < 1 then
    raise exception 'message body must be between 1 and 8000 characters';
  end if;

  if char_length(v_narrative) > 8000 then
    raise exception 'situation narrative exceeds 8000 characters'
      using errcode = '23514';
  end if;

  update public.cases
  set description = v_narrative
  where id = p_case_id
    and user_id = v_user_id;

  return v_message_id;
end;
$$;

revoke all on function public.create_case_with_first_message(text)
  from public, anon;
revoke all on function public.append_pre_understanding_message(uuid, text)
  from public, anon;

grant execute on function public.create_case_with_first_message(text)
  to authenticated;
grant execute on function public.append_pre_understanding_message(uuid, text)
  to authenticated;
