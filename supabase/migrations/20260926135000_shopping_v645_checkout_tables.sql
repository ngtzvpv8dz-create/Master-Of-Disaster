-- V645 · Checkout workflow foundation
alter table public.food_inventory
  add column if not exists shopping_excluded boolean not null default false;

update public.food_inventory
set shopping_excluded=true,
    updated_at=now(),
    note=concat_ws(' · ',note,'Nicht automatisch nachkaufen: selbstgemachtes Kürbisbrot, Restbestand verdorben.')
where name='Hokkaido-Kürbisbrot';

create table if not exists public.shopping_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  finance_transaction_id uuid null references public.finance_transactions(id) on delete set null,
  status text not null default 'review' check (status in ('review','done')),
  retailer text null,
  total_amount numeric null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_checkout_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_id uuid not null references public.shopping_checkouts(id) on delete cascade,
  shopping_key text not null,
  label text not null,
  quantity numeric null,
  unit text null,
  source text not null default 'food',
  created_at timestamptz not null default now()
);

create unique index if not exists shopping_checkout_items_key_uq on public.shopping_checkout_items(checkout_id,shopping_key);
create index if not exists shopping_checkouts_user_status_idx on public.shopping_checkouts(user_id,status,completed_at desc);

alter table public.shopping_receipt_reviews
  add column if not exists checkout_id uuid null references public.shopping_checkouts(id) on delete set null;
alter table public.shopping_receipt_reviews
  add column if not exists inventory_applied_at timestamptz null;

alter table public.shopping_checkouts enable row level security;
alter table public.shopping_checkout_items enable row level security;

drop policy if exists shopping_checkouts_owner_all on public.shopping_checkouts;
create policy shopping_checkouts_owner_all on public.shopping_checkouts for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

drop policy if exists shopping_checkout_items_owner_all on public.shopping_checkout_items;
create policy shopping_checkout_items_owner_all on public.shopping_checkout_items for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

grant select,insert,update,delete on public.shopping_checkouts to authenticated;
grant select,insert,update,delete on public.shopping_checkout_items to authenticated;

drop trigger if exists mod_backup_audit_row_change on public.shopping_checkouts;
create trigger mod_backup_audit_row_change after insert or update or delete on public.shopping_checkouts
for each row execute function backup_internal.capture_row_change();

drop trigger if exists mod_backup_audit_row_change on public.shopping_checkout_items;
create trigger mod_backup_audit_row_change after insert or update or delete on public.shopping_checkout_items
for each row execute function backup_internal.capture_row_change();