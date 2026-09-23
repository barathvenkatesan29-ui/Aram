-- Checkpoint 4C conversation management: archive without mutating intelligence.
-- persist_complete_initial_analysis and case_messages RPCs are unchanged.
--
-- Rollback:
--   1. revoke update (archived_at) on table public.cases from authenticated;
--   2. drop index if exists public.cases_user_id_archived_at_idx;
--   3. alter table public.cases drop column archived_at;

alter table public.cases
  add column archived_at timestamptz;

create index cases_user_id_archived_at_idx
  on public.cases (user_id, archived_at);

grant update (archived_at) on table public.cases to authenticated;
