-- V760: Trennung von Projektwissen, Ideen und umzusetzen­den Aufgaben.
-- Im produktiven Supabase angewendet als Migration 20261008092915.
alter table public.project_brain
  add column record_role text,
  add column implementation_state text;

update public.project_brain
set record_role = case
  when kind = 'idea' then 'idea'
  when kind in ('rule','decision','reference','vocabulary','boundary','exception','collaboration','sequencing','workflow')
    then case when kind = 'decision' and status = 'review' then 'task' else 'reference' end
  when kind = 'architecture' then case when status in ('open','review') then 'task' else 'reference' end
  when kind = 'design' then case when status = 'active' then 'reference' else 'task' end
  else 'task'
end;

alter table public.project_brain
  alter column record_role set not null,
  add constraint project_brain_record_role_check
    check (record_role in ('reference','task','idea')),
  add constraint project_brain_implementation_state_check
    check (implementation_state is null or implementation_state in
      ('not_started','in_progress','implemented_unverified','verified'));

comment on column public.project_brain.record_role is
  'Einordnung unabhaengig vom Status: reference=Regel/Beschluss/Konzept; task=Umsetzung/Fehler/Pruefung; idea=unverbindliche Idee.';
comment on column public.project_brain.implementation_state is
  'Optionaler ausdruecklich bestaetigter Umsetzungsstand fuer technische Aufgaben. NULL heisst nicht nachgewiesen, keinesfalls automatisch umgesetzt.';

create function public.project_brain_assign_record_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.record_role is null then
    new.record_role := case
      when new.kind = 'idea' then 'idea'
      when new.kind in ('rule','decision','reference','vocabulary','boundary','exception','collaboration','sequencing','workflow') then 'reference'
      when new.kind = 'architecture' and new.status not in ('open','review') then 'reference'
      when new.kind = 'design' and new.status = 'active' then 'reference'
      else 'task'
    end;
  end if;
  return new;
end;
$$;

create trigger project_brain_assign_record_role_before_insert
before insert on public.project_brain
for each row execute function public.project_brain_assign_record_role();

update public.project_brain
set implementation_state='not_started'
where record_role='task' and status='active'
and metadata->>'implementation' = 'not_started';

create or replace view public.project_brain_current with (security_invoker=true) as
select id, user_id, brain_key, area, kind, status, title, details,
       effective_date, source_date, source_chat_nos, source_file, supersedes_note,
       priority, tags, needs_verification, verified_at, resolved_at, metadata,
       created_at, updated_at, reference_number, record_role, implementation_state
from public.project_brain
where status = any (array['active'::text,'open'::text,'parked'::text,'review'::text]);
