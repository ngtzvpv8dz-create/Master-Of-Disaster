-- V639 · persistenter Einkaufswagenstatus für abgeleitete FOOD-Einkaufspositionen
create table if not exists public.food_shopping_cart_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shopping_key text not null,
  added_at timestamptz not null default now(),
  constraint food_shopping_cart_state_key_not_blank check (length(btrim(shopping_key)) > 0),
  constraint food_shopping_cart_state_user_key_unique unique (user_id, shopping_key)
);

alter table public.food_shopping_cart_state enable row level security;

grant select, insert, update, delete on public.food_shopping_cart_state to authenticated;
grant select, insert, update, delete on public.food_shopping_cart_state to service_role;

drop policy if exists "food_shopping_cart_state_select_own" on public.food_shopping_cart_state;
create policy "food_shopping_cart_state_select_own"
on public.food_shopping_cart_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "food_shopping_cart_state_insert_own" on public.food_shopping_cart_state;
create policy "food_shopping_cart_state_insert_own"
on public.food_shopping_cart_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "food_shopping_cart_state_update_own" on public.food_shopping_cart_state;
create policy "food_shopping_cart_state_update_own"
on public.food_shopping_cart_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "food_shopping_cart_state_delete_own" on public.food_shopping_cart_state;
create policy "food_shopping_cart_state_delete_own"
on public.food_shopping_cart_state
for delete
to authenticated
using ((select auth.uid()) = user_id);
