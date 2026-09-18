-- V544 FOOD controls: explicit completion, inventory movements, editable stock and multi-day planning.
begin;

alter table public.food_meals
  add column if not exists inventory_booked_at timestamptz,
  add column if not exists recipe_id uuid;

alter table public.food_meal_ingredients
  add column if not exists inventory_id uuid;

alter table public.food_inventory
  add column if not exists is_active boolean not null default true,
  add column if not exists opened boolean not null default false,
  add column if not exists use_priority text not null default 'later',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

alter table public.food_meal_ingredients
  drop constraint if exists food_meal_ingredients_inventory_id_fkey;
alter table public.food_meal_ingredients
  add constraint food_meal_ingredients_inventory_id_fkey
  foreign key (inventory_id) references public.food_inventory(id) on delete set null;

alter table public.food_meals
  drop constraint if exists food_meals_status_check;
alter table public.food_inventory
  drop constraint if exists food_inventory_use_priority_check;
alter table public.food_inventory
  add constraint food_inventory_use_priority_check check (use_priority in ('tomorrow','three_days','later'));

create table if not exists public.food_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid not null references public.food_inventory(id) on delete cascade,
  meal_id uuid references public.food_meals(id) on delete set null,
  kind text not null check (kind in ('consume','adjust','add','remove','spoilage')),
  delta numeric not null default 0,
  quantity_before numeric,
  quantity_after numeric,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.food_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  meal_type text not null check (meal_type in ('breakfast','snack','lunch','dinner')),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,title)
);

create table if not exists public.food_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.food_recipes(id) on delete cascade,
  inventory_id uuid references public.food_inventory(id) on delete set null,
  label text not null,
  quantity numeric,
  unit text,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.food_shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  quantity numeric,
  unit text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.food_meals
  drop constraint if exists food_meals_recipe_id_fkey;
alter table public.food_meals
  add constraint food_meals_recipe_id_fkey
  foreign key (recipe_id) references public.food_recipes(id) on delete set null;

create unique index if not exists food_meals_user_date_type_uidx
  on public.food_meals(user_id, meal_date, meal_type);

update public.food_inventory
set name='Putenbrust-Aufschnitt'
where name='Putenbrust';

update public.food_inventory
set name='Granny Smith'
where name='Äpfel grün';

update public.food_inventory
set name='Mandeln naturbelassen'
where name='Mandeln natur';

update public.food_inventory
set opened=true, use_priority='tomorrow'
where name in ('Hähnchenbrustfilet','Brokkoli','Skyr Natur','Frischkäse Balance','Roggen-Vollkornbrot');

update public.food_inventory
set use_priority='three_days'
where name in ('Gurke','Tomaten · Fruchtig & Süß');

update public.food_inventory
set use_priority='later'
where name in ('Kartoffeln','Magerquark','Granny Smith','Mandeln naturbelassen','Zarte Haferflocken','Hackfleisch gemischt','Pepsi Zero Cherry','Bananen','Putenbrust-Aufschnitt');

update public.food_meal_ingredients i
set inventory_id = v.id
from public.food_inventory v
where i.user_id=v.user_id
  and (
    i.label ilike '%Skyr%' and v.name='Skyr Natur'
    or i.label ilike '%Banane%' and v.name='Bananen'
    or i.label ilike '%Haferflocken%' and v.name='Zarte Haferflocken'
    or i.label ilike '%Apfel%' and v.name='Granny Smith'
    or i.label ilike '%Mandeln%' and v.name='Mandeln naturbelassen'
    or i.label ilike '%Roggen%' and v.name='Roggen-Vollkornbrot'
    or i.label ilike '%Putenbrust%' and v.name='Putenbrust-Aufschnitt'
    or i.label ilike '%Frischkäse%' and v.name='Frischkäse Balance'
    or i.label ilike '%Gurke%' and v.name='Gurke'
    or i.label ilike '%Tomaten%' and v.name='Tomaten · Fruchtig & Süß'
    or i.label ilike '%Hähnchen%' and v.name='Hähnchenbrustfilet'
    or i.label ilike '%Kartoffeln%' and v.name='Kartoffeln'
    or i.label ilike '%Brokkoli%' and v.name='Brokkoli'
    or i.label ilike '%Magerquark%' and v.name='Magerquark'
  );

-- The first meal and lunch were already deducted in the V543 data snapshot.
update public.food_meals
set status='completed', inventory_booked_at=coalesce(inventory_booked_at, now()), note=null
where meal_date='2026-09-18' and meal_type in ('breakfast','lunch');

update public.food_meals
set status='planned', inventory_booked_at=null, note=null
where meal_date='2026-09-18' and meal_type='snack';

update public.food_meals
set note=null
where meal_date='2026-09-18' and meal_type='dinner';

alter table public.food_meals
  add constraint food_meals_status_check check (status in ('planned','completed'));

insert into public.food_recipes(user_id,title,meal_type,description)
select m.user_id,m.title,m.meal_type,'Aus dem heutigen Startplan übernommen.'
from public.food_meals m
on conflict (user_id,title) do nothing;

insert into public.food_recipe_ingredients(user_id,recipe_id,inventory_id,label,quantity,unit,sort_order)
select i.user_id,r.id,i.inventory_id,i.label,i.quantity,i.unit,i.sort_order
from public.food_meal_ingredients i
join public.food_meals m on m.id=i.meal_id
join public.food_recipes r on r.user_id=m.user_id and r.title=m.title
where not exists (
  select 1 from public.food_recipe_ingredients ri
  where ri.recipe_id=r.id and ri.label=i.label
);

create or replace view public.food_inventory_overview
with (security_invoker=true)
as
select id,user_id,name,quantity_label,forecast_label,tone,note,sort_order,
       quantity,unit,is_active,opened,use_priority
from public.food_inventory
where is_active=true;

alter table public.food_inventory_movements enable row level security;
alter table public.food_recipes enable row level security;
alter table public.food_recipe_ingredients enable row level security;
alter table public.food_shopping_items enable row level security;

drop policy if exists food_inventory_movements_owner_all on public.food_inventory_movements;
create policy food_inventory_movements_owner_all on public.food_inventory_movements
for all to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

drop policy if exists food_recipes_owner_all on public.food_recipes;
create policy food_recipes_owner_all on public.food_recipes
for all to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

drop policy if exists food_recipe_ingredients_owner_all on public.food_recipe_ingredients;
create policy food_recipe_ingredients_owner_all on public.food_recipe_ingredients
for all to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

drop policy if exists food_shopping_items_owner_all on public.food_shopping_items;
create policy food_shopping_items_owner_all on public.food_shopping_items
for all to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

grant select,insert,update,delete on public.food_inventory_movements to authenticated;
grant select,insert,update,delete on public.food_recipes to authenticated;
grant select,insert,update,delete on public.food_recipe_ingredients to authenticated;
grant select,insert,update,delete on public.food_shopping_items to authenticated;
revoke all on public.food_inventory_movements from anon;
revoke all on public.food_recipes from anon;
revoke all on public.food_recipe_ingredients from anon;
revoke all on public.food_shopping_items from anon;

create or replace function public.food_quantity_label(p_quantity numeric,p_unit text)
returns text
language sql
immutable
set search_path=public,pg_temp
as $$
  select case
    when p_quantity is null then 'Menge offen'
    when p_unit is null or p_unit='' then trim(to_char(p_quantity,'FM999999990D##'))
    else trim(to_char(p_quantity,'FM999999990D##')) || ' ' || p_unit
  end;
$$;

create or replace function public.complete_food_meal(p_meal_id uuid)
returns public.food_meals
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_meal public.food_meals%rowtype;
  v_ing record;
  v_stock public.food_inventory%rowtype;
  v_before numeric;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  select * into v_meal from public.food_meals
  where id=p_meal_id and user_id=v_user
  for update;
  if not found then raise exception 'Mahlzeit nicht gefunden'; end if;
  if v_meal.inventory_booked_at is not null or v_meal.status='completed' then
    return v_meal;
  end if;

  for v_ing in
    select * from public.food_meal_ingredients
    where meal_id=v_meal.id and user_id=v_user
      and inventory_id is not null and quantity is not null and quantity_confirmed=true
    order by sort_order
  loop
    select * into v_stock from public.food_inventory
    where id=v_ing.inventory_id and user_id=v_user and is_active=true
    for update;
    if not found then raise exception 'Vorratsposition fehlt'; end if;
    if v_stock.quantity is null then raise exception 'Menge von "%" ist offen',v_stock.name; end if;
    if v_stock.unit is distinct from v_ing.unit then raise exception 'Einheit von "%" passt nicht',v_stock.name; end if;
    if v_stock.quantity < v_ing.quantity then raise exception 'Nicht genug "%" vorhanden',v_stock.name; end if;
    v_before:=v_stock.quantity;
    update public.food_inventory
    set quantity=v_stock.quantity-v_ing.quantity,
        quantity_label=public.food_quantity_label(v_stock.quantity-v_ing.quantity,v_stock.unit),
        forecast_label=null,
        tone=case when v_stock.quantity-v_ing.quantity <= 0 then 'empty' else v_stock.tone end,
        updated_at=now()
    where id=v_stock.id;
    insert into public.food_inventory_movements(user_id,inventory_id,meal_id,kind,delta,quantity_before,quantity_after,note)
    values(v_user,v_stock.id,v_meal.id,'consume',-v_ing.quantity,v_before,v_stock.quantity-v_ing.quantity,'Mahlzeit als erledigt markiert');
  end loop;

  update public.food_meals
  set status='completed',inventory_booked_at=now(),note=null,updated_at=now()
  where id=v_meal.id
  returning * into v_meal;
  return v_meal;
end;
$$;

create or replace function public.adjust_food_inventory(
  p_inventory_id uuid,
  p_new_quantity numeric,
  p_reason text default 'adjustment',
  p_note text default null
)
returns public.food_inventory
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_old public.food_inventory%rowtype;
  v_new public.food_inventory%rowtype;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_new_quantity is null or p_new_quantity < 0 then raise exception 'Menge muss 0 oder größer sein'; end if;
  select * into v_old from public.food_inventory
  where id=p_inventory_id and user_id=v_user and is_active=true
  for update;
  if not found then raise exception 'Vorrat nicht gefunden'; end if;
  update public.food_inventory
  set quantity=p_new_quantity,
      quantity_label=public.food_quantity_label(p_new_quantity,unit),
      forecast_label=null,
      tone=case when p_new_quantity=0 then 'empty' else case when tone='empty' then 'stock' else tone end end,
      note=coalesce(p_note,note),
      updated_at=now()
  where id=p_inventory_id
  returning * into v_new;
  insert into public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
  values(v_user,p_inventory_id,'adjust',p_new_quantity-coalesce(v_old.quantity,0),v_old.quantity,p_new_quantity,coalesce(p_reason,'Menge geändert'));
  return v_new;
end;
$$;

create or replace function public.archive_food_inventory(p_inventory_id uuid,p_reason text default 'remove')
returns public.food_inventory
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.food_inventory%rowtype;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  update public.food_inventory
  set is_active=false,archived_at=now(),archived_reason=p_reason,updated_at=now()
  where id=p_inventory_id and user_id=v_user and is_active=true
  returning * into v_row;
  if not found then raise exception 'Vorrat nicht gefunden'; end if;
  insert into public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
  values(v_user,p_inventory_id,case when lower(coalesce(p_reason,'')) like '%schlecht%' then 'spoilage' else 'remove' end,0,v_row.quantity,v_row.quantity,p_reason);
  return v_row;
end;
$$;

create or replace function public.schedule_food_recipe(
  p_recipe_id uuid,
  p_meal_date date,
  p_meal_type text
)
returns public.food_meals
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_recipe public.food_recipes%rowtype;
  v_meal public.food_meals%rowtype;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_meal_type not in ('breakfast','snack','lunch','dinner') then raise exception 'Ungültige Mahlzeit'; end if;
  select * into v_recipe from public.food_recipes where id=p_recipe_id and user_id=v_user and active=true;
  if not found then raise exception 'Rezept nicht gefunden'; end if;

  insert into public.food_meals(user_id,meal_date,meal_type,title,status,sort_order,note,recipe_id)
  values(v_user,p_meal_date,p_meal_type,v_recipe.title,'planned',
         case p_meal_type when 'breakfast' then 1 when 'snack' then 2 when 'lunch' then 3 else 4 end,
         null,v_recipe.id)
  on conflict (user_id,meal_date,meal_type)
  do update set title=excluded.title,status='planned',inventory_booked_at=null,
                note=null,recipe_id=excluded.recipe_id,updated_at=now()
  returning * into v_meal;

  delete from public.food_meal_ingredients where meal_id=v_meal.id and user_id=v_user;
  insert into public.food_meal_ingredients(user_id,meal_id,inventory_id,label,quantity,unit,quantity_confirmed,sort_order)
  select v_user,v_meal.id,inventory_id,label,quantity,unit,true,sort_order
  from public.food_recipe_ingredients
  where recipe_id=v_recipe.id and user_id=v_user
  order by sort_order;
  return v_meal;
end;
$$;

revoke all on function public.complete_food_meal(uuid) from public,anon;
revoke all on function public.adjust_food_inventory(uuid,numeric,text,text) from public,anon;
revoke all on function public.archive_food_inventory(uuid,text) from public,anon;
revoke all on function public.schedule_food_recipe(uuid,date,text) from public,anon;
grant execute on function public.complete_food_meal(uuid) to authenticated;
grant execute on function public.adjust_food_inventory(uuid,numeric,text,text) to authenticated;
grant execute on function public.archive_food_inventory(uuid,text) to authenticated;
grant execute on function public.schedule_food_recipe(uuid,date,text) to authenticated;

commit;
