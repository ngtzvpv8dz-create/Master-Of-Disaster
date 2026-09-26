alter table public.shopping_items
  add column if not exists return_status text null
  check (return_status in ('now','later'));