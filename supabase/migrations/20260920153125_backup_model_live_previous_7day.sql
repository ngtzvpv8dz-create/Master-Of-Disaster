-- Master of Disaster · Unified Backup Model
-- Applied to Supabase as migration 20260920153125.
-- LIVE/PREVIOUS remains in legacy_metadata; these tables hold the rolling 7-day safety net.

create table if not exists public.backup_recovery_points (
  user_id uuid not null references auth.users(id) on delete cascade,
  point_id text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, point_id)
);

create index if not exists backup_recovery_points_user_time_idx
  on public.backup_recovery_points(user_id, occurred_at desc);

alter table public.backup_recovery_points enable row level security;

drop policy if exists backup_recovery_points_owner_select on public.backup_recovery_points;
create policy backup_recovery_points_owner_select
  on public.backup_recovery_points for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists backup_recovery_points_owner_insert on public.backup_recovery_points;
create policy backup_recovery_points_owner_insert
  on public.backup_recovery_points for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists backup_recovery_points_owner_update on public.backup_recovery_points;
create policy backup_recovery_points_owner_update
  on public.backup_recovery_points for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists backup_recovery_points_owner_delete on public.backup_recovery_points;
create policy backup_recovery_points_owner_delete
  on public.backup_recovery_points for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.backup_recovery_points from anon;
grant select, insert, update, delete on public.backup_recovery_points to authenticated;


create table if not exists public.backup_log_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_id text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, log_id)
);

create index if not exists backup_log_entries_user_time_idx
  on public.backup_log_entries(user_id, occurred_at desc);

alter table public.backup_log_entries enable row level security;

drop policy if exists backup_log_entries_owner_select on public.backup_log_entries;
create policy backup_log_entries_owner_select
  on public.backup_log_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists backup_log_entries_owner_insert on public.backup_log_entries;
create policy backup_log_entries_owner_insert
  on public.backup_log_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists backup_log_entries_owner_update on public.backup_log_entries;
create policy backup_log_entries_owner_update
  on public.backup_log_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists backup_log_entries_owner_delete on public.backup_log_entries;
create policy backup_log_entries_owner_delete
  on public.backup_log_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.backup_log_entries from anon;
grant select, insert, update, delete on public.backup_log_entries to authenticated;


create table if not exists public.backup_db_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  schema_name text not null,
  table_name text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  row_key jsonb not null default '{}'::jsonb,
  before_row jsonb,
  after_row jsonb
);

create index if not exists backup_db_changes_user_time_idx
  on public.backup_db_changes(user_id, occurred_at desc);

alter table public.backup_db_changes enable row level security;

drop policy if exists backup_db_changes_owner_select on public.backup_db_changes;
create policy backup_db_changes_owner_select
  on public.backup_db_changes for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.backup_db_changes from anon, authenticated;
grant select on public.backup_db_changes to authenticated;


create schema if not exists backup_internal;
revoke all on schema backup_internal from public, anon, authenticated;

create or replace function backup_internal.capture_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_user uuid;
  v_key jsonb;
begin
  if tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := null;
  end if;

  begin
    v_user := coalesce(
      nullif(v_after->>'user_id','')::uuid,
      nullif(v_before->>'user_id','')::uuid,
      auth.uid()
    );
  exception when invalid_text_representation then
    v_user := auth.uid();
  end;

  if v_user is not null then
    v_key := jsonb_strip_nulls(jsonb_build_object(
      'id', coalesce(v_after->'id', v_before->'id'),
      'code', coalesce(v_after->'code', v_before->'code'),
      'inventory_id', coalesce(v_after->'inventory_id', v_before->'inventory_id'),
      'legacy_task_id', coalesce(v_after->'legacy_task_id', v_before->'legacy_task_id'),
      'archive_number', coalesce(v_after->'archive_number', v_before->'archive_number')
    ));

    insert into public.backup_db_changes(
      user_id, schema_name, table_name, operation, row_key, before_row, after_row
    ) values (
      v_user, tg_table_schema, tg_table_name, tg_op, coalesce(v_key,'{}'::jsonb), v_before, v_after
    );

    delete from public.backup_db_changes
      where user_id = v_user
        and occurred_at < now() - interval '7 days';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function backup_internal.capture_row_change() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.column_name = 'user_id'
      and c.table_schema in ('public','mega_sortierung')
      and c.table_name not in (
        'legacy_metadata',
        'backup_recovery_points',
        'backup_log_entries',
        'backup_db_changes',
        'health_sync_keys'
      )
    group by c.table_schema, c.table_name
  loop
    execute format('drop trigger if exists mod_backup_audit_row_change on %I.%I', r.table_schema, r.table_name);
    execute format(
      'create trigger mod_backup_audit_row_change after insert or update or delete on %I.%I for each row execute function backup_internal.capture_row_change()',
      r.table_schema, r.table_name
    );
  end loop;
end $$;
