-- Master of Disaster · Project Brain
-- Persistent, user-owned project knowledge: decisions, rules, open points, parked ideas and verified completions.

create table if not exists public.project_brain (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brain_key text not null,
  area text not null,
  kind text not null,
  status text not null check (status in ('active','open','parked','review','done','superseded','historical')),
  title text not null,
  details text not null,
  effective_date date,
  source_date date,
  source_chat_nos integer[] not null default '{}',
  source_file text,
  supersedes_note text,
  priority smallint check (priority between 1 and 5),
  tags text[] not null default '{}',
  needs_verification boolean not null default false,
  verified_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_brain_user_key_unique unique (user_id, brain_key)
);

comment on table public.project_brain is
  'Bereinigter Master-of-Disaster-Projektstand: Entscheidungen, Regeln, Architektur, offene Punkte, geparkte Ideen und verifizierte Erledigungen. Fach-/Tagesdaten bleiben in ihren jeweiligen Tabellen.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='project_brain_user_id_fkey'
      and conrelid='public.project_brain'::regclass
  ) then
    alter table public.project_brain
      add constraint project_brain_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists project_brain_user_status_idx
  on public.project_brain (user_id, status);

create index if not exists project_brain_user_area_idx
  on public.project_brain (user_id, area);

create index if not exists project_brain_tags_gin_idx
  on public.project_brain using gin (tags);

alter table public.project_brain enable row level security;

revoke all on table public.project_brain from anon;
grant select, insert, update, delete on table public.project_brain to authenticated;

drop policy if exists "project_brain_select_own" on public.project_brain;
create policy "project_brain_select_own"
  on public.project_brain
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "project_brain_insert_own" on public.project_brain;
create policy "project_brain_insert_own"
  on public.project_brain
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "project_brain_update_own" on public.project_brain;
create policy "project_brain_update_own"
  on public.project_brain
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "project_brain_delete_own" on public.project_brain;
create policy "project_brain_delete_own"
  on public.project_brain
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace view public.project_brain_current
with (security_invoker = true)
as
select *
from public.project_brain
where status in ('active','open','parked','review');

revoke all on table public.project_brain_current from anon;
grant select on table public.project_brain_current to authenticated;

drop trigger if exists mod_backup_audit_row_change on public.project_brain;
create trigger mod_backup_audit_row_change
  after insert or update or delete on public.project_brain
  for each row execute function backup_internal.capture_row_change();
