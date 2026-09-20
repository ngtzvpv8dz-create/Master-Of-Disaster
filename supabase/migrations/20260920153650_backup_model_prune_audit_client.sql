-- Allow the signed-in owner to prune seven-day database audit rows.
drop policy if exists backup_db_changes_owner_delete on public.backup_db_changes;
create policy backup_db_changes_owner_delete
  on public.backup_db_changes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant delete on public.backup_db_changes to authenticated;
