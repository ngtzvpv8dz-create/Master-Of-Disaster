-- V644 · Shopping product master + receipt review queue
-- Concrete products are separated from receipt labels. Unknown receipt lines remain reviewable instead of being guessed.

create table if not exists public.shopping_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  retailer text null,
  brand text null,
  product_name text not null,
  variant text null,
  category text null,
  package_quantity numeric null,
  package_unit text null,
  barcode text null,
  inventory_id uuid null references public.food_inventory(id) on delete set null,
  nutrition_per_100 jsonb not null default '{}'::jsonb,
  product_data jsonb not null default '{}'::jsonb,
  notes text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_products_name_nonempty check (length(trim(product_name)) > 0)
);

create unique index if not exists shopping_products_identity_uq
on public.shopping_products (
  user_id,
  coalesce(lower(retailer),''),
  coalesce(lower(brand),''),
  lower(product_name),
  coalesce(lower(variant),''),
  coalesce(package_quantity,-1),
  coalesce(lower(package_unit),'')
);

create index if not exists shopping_products_user_active_idx
  on public.shopping_products(user_id,active,retailer,product_name);

create table if not exists public.shopping_receipt_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  retailer text not null,
  receipt_label text not null,
  normalized_label text not null,
  product_id uuid not null references public.shopping_products(id) on delete cascade,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_receipt_aliases_retailer_nonempty check (length(trim(retailer)) > 0),
  constraint shopping_receipt_aliases_label_nonempty check (length(trim(receipt_label)) > 0),
  constraint shopping_receipt_aliases_normalized_nonempty check (length(trim(normalized_label)) > 0)
);

create unique index if not exists shopping_receipt_aliases_product_uq
  on public.shopping_receipt_aliases(user_id,lower(retailer),normalized_label,product_id);

create unique index if not exists shopping_receipt_aliases_default_uq
  on public.shopping_receipt_aliases(user_id,lower(retailer),normalized_label)
  where is_default=true and active=true;

create index if not exists shopping_receipt_aliases_lookup_idx
  on public.shopping_receipt_aliases(user_id,lower(retailer),normalized_label,active);

create table if not exists public.shopping_receipt_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  finance_item_id uuid not null references public.finance_items(id) on delete cascade,
  retailer text not null,
  receipt_label text not null,
  normalized_label text not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','new_product_pending','ignored')),
  product_id uuid null references public.shopping_products(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint shopping_receipt_reviews_label_nonempty check (length(trim(receipt_label)) > 0),
  unique(user_id,finance_item_id)
);

create index if not exists shopping_receipt_reviews_queue_idx
  on public.shopping_receipt_reviews(user_id,status,created_at desc);

alter table public.shopping_products enable row level security;
alter table public.shopping_receipt_aliases enable row level security;
alter table public.shopping_receipt_reviews enable row level security;

drop policy if exists shopping_products_owner_all on public.shopping_products;
create policy shopping_products_owner_all on public.shopping_products
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

drop policy if exists shopping_receipt_aliases_owner_all on public.shopping_receipt_aliases;
create policy shopping_receipt_aliases_owner_all on public.shopping_receipt_aliases
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

drop policy if exists shopping_receipt_reviews_owner_all on public.shopping_receipt_reviews;
create policy shopping_receipt_reviews_owner_all on public.shopping_receipt_reviews
  for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

grant select,insert,update,delete on public.shopping_products to authenticated;
grant select,insert,update,delete on public.shopping_receipt_aliases to authenticated;
grant select,insert,update,delete on public.shopping_receipt_reviews to authenticated;

drop trigger if exists mod_backup_audit_row_change on public.shopping_products;
create trigger mod_backup_audit_row_change
after insert or update or delete on public.shopping_products
for each row execute function backup_internal.capture_row_change();

drop trigger if exists mod_backup_audit_row_change on public.shopping_receipt_aliases;
create trigger mod_backup_audit_row_change
after insert or update or delete on public.shopping_receipt_aliases
for each row execute function backup_internal.capture_row_change();

drop trigger if exists mod_backup_audit_row_change on public.shopping_receipt_reviews;
create trigger mod_backup_audit_row_change
after insert or update or delete on public.shopping_receipt_reviews
for each row execute function backup_internal.capture_row_change();
