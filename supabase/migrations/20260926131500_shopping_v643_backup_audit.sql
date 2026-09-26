-- V643 · Include central shopping items in the rolling 48h database audit.

drop trigger if exists mod_backup_audit_row_change on public.shopping_items;
create trigger mod_backup_audit_row_change
after insert or update or delete on public.shopping_items
for each row execute function backup_internal.capture_row_change();