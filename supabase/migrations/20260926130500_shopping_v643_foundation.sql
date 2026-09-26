-- V643 · General Shopping Foundation
-- Dedicated central shopping list. Food-derived demand stays dynamic and is not duplicated here.

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  quantity numeric null,
  unit text null,
  category text not null default 'Sonstiges',
  status text not null default 'now' check (status in ('now','later','cart','done')),
  source text not null default 'manual',
  source_key text null,
  needed_by date null,
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint shopping_items_label_nonempty check (length(trim(label)) > 0)
);

create index if not exists shopping_items_user_status_idx
  on public.shopping_items(user_id,status,sort_order,created_at);

create index if not exists shopping_items_user_category_idx
  on public.shopping_items(user_id,category);

create unique index if not exists shopping_items_source_key_uq
  on public.shopping_items(user_id,source,source_key)
  where source_key is not null;

alter table public.shopping_items enable row level security;

drop policy if exists shopping_items_owner_all on public.shopping_items;
create policy shopping_items_owner_all
  on public.shopping_items
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select,insert,update,delete on public.shopping_items to authenticated;
