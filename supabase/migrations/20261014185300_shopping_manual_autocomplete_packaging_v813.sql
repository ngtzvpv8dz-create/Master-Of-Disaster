-- V813: manual shopping entries can point to a real catalogue product and
-- retain purchase-specific package structure without inflating stock quantities.
alter table public.shopping_items
  add column if not exists product_id uuid references public.shopping_products(id) on delete set null,
  add column if not exists purchase_data jsonb not null default '{}'::jsonb;
comment on column public.shopping_items.product_id is
  'Optional explicit known-product choice for a manually entered shopping item.';
comment on column public.shopping_items.purchase_data is
  'Extra purchase metadata: piece_count, estimated_total_weight_g, outer_package_count, inner_units_per_outer, inner_units_total, inner_unit_quantity, inner_unit_unit. Not additional stock.';
create index if not exists shopping_items_product_id_idx
  on public.shopping_items(user_id,product_id) where product_id is not null;
