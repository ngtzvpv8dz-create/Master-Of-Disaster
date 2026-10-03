-- V627/V676 · Sport live workflow
-- Participant assignment per exercise and circuit-plan assignment per training day.

create table if not exists public.sport_session_exercise_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_exercise_id uuid not null references public.sport_session_exercises(id) on delete cascade,
  participant_name text not null,
  created_at timestamptz not null default now(),
  constraint sport_session_exercise_participants_name_nonempty check (length(trim(participant_name)) > 0),
  constraint sport_session_exercise_participants_name_length check (length(trim(participant_name)) <= 80),
  constraint sport_session_exercise_participants_unique unique (user_id, session_exercise_id, participant_name)
);

create index if not exists sport_session_exercise_participants_user_idx
  on public.sport_session_exercise_participants(user_id);

create index if not exists sport_session_exercise_participants_exercise_idx
  on public.sport_session_exercise_participants(session_exercise_id);

alter table public.sport_session_exercise_participants enable row level security;

revoke all on table public.sport_session_exercise_participants from anon, authenticated;
grant select, insert, delete on table public.sport_session_exercise_participants to authenticated;
grant select, insert, update, delete on table public.sport_session_exercise_participants to service_role;

drop policy if exists sport_session_exercise_participants_select_own on public.sport_session_exercise_participants;
create policy sport_session_exercise_participants_select_own
  on public.sport_session_exercise_participants
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists sport_session_exercise_participants_insert_own on public.sport_session_exercise_participants;
create policy sport_session_exercise_participants_insert_own
  on public.sport_session_exercise_participants
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists sport_session_exercise_participants_delete_own on public.sport_session_exercise_participants;
create policy sport_session_exercise_participants_delete_own
  on public.sport_session_exercise_participants
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.sport_session_circuit_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sport_sessions(id) on delete cascade,
  plan_id uuid not null references public.sport_circuit_plans(id) on delete cascade,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  constraint sport_session_circuit_plans_unique unique (user_id, session_id, plan_id)
);

create index if not exists sport_session_circuit_plans_user_idx
  on public.sport_session_circuit_plans(user_id);

create index if not exists sport_session_circuit_plans_session_idx
  on public.sport_session_circuit_plans(session_id, sort_order);

alter table public.sport_session_circuit_plans enable row level security;

revoke all on table public.sport_session_circuit_plans from anon, authenticated;
grant select, insert, update, delete on table public.sport_session_circuit_plans to authenticated;
grant select, insert, update, delete on table public.sport_session_circuit_plans to service_role;

drop policy if exists sport_session_circuit_plans_select_own on public.sport_session_circuit_plans;
create policy sport_session_circuit_plans_select_own
  on public.sport_session_circuit_plans
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists sport_session_circuit_plans_insert_own on public.sport_session_circuit_plans;
create policy sport_session_circuit_plans_insert_own
  on public.sport_session_circuit_plans
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists sport_session_circuit_plans_update_own on public.sport_session_circuit_plans;
create policy sport_session_circuit_plans_update_own
  on public.sport_session_circuit_plans
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists sport_session_circuit_plans_delete_own on public.sport_session_circuit_plans;
create policy sport_session_circuit_plans_delete_own
  on public.sport_session_circuit_plans
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
