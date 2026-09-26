-- Master of Disaster · Backup audit noise reduction
-- Keep the 48h safety net focused on changes that are useful for recovery.

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

  -- Pure archived_at refreshes are sync noise, not useful recovery points.
  if tg_table_schema = 'public'
     and tg_table_name = 'archive_entries'
     and tg_op = 'UPDATE'
     and (v_before - 'archived_at') = (v_after - 'archived_at') then
    return new;
  end if;

  -- Volatile segment tables are frequently rebuilt. Their INSERT side is redundant
  -- when DELETE/UPDATE information is still available for short-term recovery.
  if tg_op = 'INSERT'
     and tg_table_schema = 'public'
     and tg_table_name in ('archive_active_segments','task_active_segments','task_cooking_segments','weight_phases') then
    return new;
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
        and occurred_at < now() - interval '48 hours';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- These tables are already transient/history streams and do not need a history of their history.
drop trigger if exists mod_backup_audit_row_change on public.remote_commands;
drop trigger if exists mod_backup_audit_row_change on public.food_inventory_movements;

-- Remove already collected low-value noise from the current 48h window.
delete from public.backup_db_changes
where table_name in ('remote_commands','food_inventory_movements');

delete from public.backup_db_changes
where table_name='archive_entries'
  and operation='UPDATE'
  and (before_row - 'archived_at') = (after_row - 'archived_at');

delete from public.backup_db_changes
where operation='INSERT'
  and table_name in ('archive_active_segments','task_active_segments','task_cooking_segments','weight_phases');
