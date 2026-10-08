-- V759: persistente, global eindeutige Nummern fuer jeden Denkfabrik-Eintrag.
-- Bereits angewendet auf Hauptdatenbank als Migration 20261008090809.
alter table public.project_brain add column reference_number integer;
create sequence public.project_brain_reference_number_seq as integer start with 1 increment by 1;
alter sequence public.project_brain_reference_number_seq owned by public.project_brain.reference_number;

with numbered as (
  select id, row_number() over (
    order by
      case when status in ('open','review','active','parked') then 0 when status='done' then 1 else 2 end,
      case area
        when 'denkfabrik' then 0 when 'global' then 1 when 'app' then 2 when 'food' then 3
        when 'sport' then 4 when 'shopping' then 5 when 'finance' then 6 when 'todo' then 7
        when 'kistology' then 8 when 'backup' then 9 when 'backstage' then 10
        when 'progress' then 11 when 'integration' then 12 when 'development' then 13
        else 14 end,
      priority desc nulls last, title, brain_key
  )::integer as seq
  from public.project_brain
)
update public.project_brain as brain
set reference_number = numbered.seq
from numbered
where brain.id = numbered.id;

select setval('public.project_brain_reference_number_seq', (select max(reference_number) from public.project_brain), true);

alter table public.project_brain
  alter column reference_number set default nextval('public.project_brain_reference_number_seq'::regclass),
  alter column reference_number set not null;
alter table public.project_brain add constraint project_brain_reference_number_unique unique (reference_number);
comment on column public.project_brain.reference_number is 'Unveraenderliche, global eindeutige Denkfabrik-Referenznummer; bleibt bei Status-, Bereichs- und Prioritaetsaenderungen stabil.';

create or replace view public.project_brain_current with (security_invoker=true) as
select id, user_id, brain_key, area, kind, status, title, details,
       effective_date, source_date, source_chat_nos, source_file, supersedes_note,
       priority, tags, needs_verification, verified_at, resolved_at, metadata,
       created_at, updated_at, reference_number
from public.project_brain
where status = any (array['active'::text,'open'::text,'parked'::text,'review'::text]);
