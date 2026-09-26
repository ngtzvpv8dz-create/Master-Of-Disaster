-- Master of Disaster · Backup retention cleanup
-- 26.09.2026: rolling safety net reduced from 7 days to 48 hours.
-- Current app data remains untouched. Historical one-off backup schemas are removed.

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
        and occurred_at < now() - interval '48 hours';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

delete from public.backup_db_changes
where occurred_at < now() - interval '48 hours';

delete from public.backup_recovery_points
where occurred_at < now() - interval '48 hours';

delete from public.backup_log_entries
where occurred_at < now() - interval '48 hours';

drop schema if exists backup_food_reconcile_20260920_1024 cascade;
drop schema if exists backup_hyper_20260920_1531 cascade;
drop schema if exists backup_pre_food_ux_20260919_1812 cascade;
drop schema if exists backup_pre_sport_items_20260920_1214 cascade;
drop schema if exists backup_pre_todo_design_20260918_1958 cascade;
drop schema if exists backup_pre_xtraining_20260919_1918 cascade;
