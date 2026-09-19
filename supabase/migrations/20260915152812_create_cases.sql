create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  status text not null default 'intake',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cases_description_length_check
    check (char_length(trim(description)) between 50 and 8000),
  constraint cases_status_phase3_check
    check (status = 'intake')
);

create index cases_user_id_created_at_idx
  on public.cases (user_id, created_at desc);

create function public.set_cases_updated_at()
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

create trigger cases_set_updated_at
before update on public.cases
for each row
execute function public.set_cases_updated_at();

alter table public.cases enable row level security;
alter table public.cases force row level security;

revoke all on table public.cases from public;
revoke all on table public.cases from anon, authenticated;

grant select, delete on table public.cases to authenticated;
grant insert (user_id, description) on table public.cases to authenticated;
grant update (description) on table public.cases to authenticated;

revoke all on function public.set_cases_updated_at() from public, anon, authenticated;

create policy cases_select_own
  on public.cases
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy cases_insert_own
  on public.cases
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy cases_update_own
  on public.cases
  for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy cases_delete_own
  on public.cases
  for delete
  to authenticated
  using ( (select auth.uid()) = user_id );
