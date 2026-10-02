-- Ganze Tütchen-/Portionseinheiten bei Mahlzeitenverbrauch
-- Beispiel: Trockenbackhefe 1 Päckchen = 7 g. Rezept bleibt in g sichtbar,
-- Vorrat wird beim Abschluss in ganzen Päckchen gebucht.

alter table public.food_inventory
  add column if not exists usage_content_quantity numeric,
  add column if not exists usage_content_unit text,
  add column if not exists consume_whole_unit boolean not null default false;

alter table public.food_inventory
  drop constraint if exists food_inventory_usage_content_quantity_check;

alter table public.food_inventory
  add constraint food_inventory_usage_content_quantity_check
  check (usage_content_quantity is null or usage_content_quantity > 0);

comment on column public.food_inventory.usage_content_quantity is
  'Inhalt einer Vorratseinheit für Rezept-/Mahlzeitmengen, z. B. 7 bei 1 Päckchen Trockenhefe = 7 g.';
comment on column public.food_inventory.usage_content_unit is
  'Einheit des Inhalts einer Vorratseinheit, z. B. g.';
comment on column public.food_inventory.consume_whole_unit is
  'Wenn true, werden Mahlzeitmengen in usage_content_unit auf ganze Vorratseinheiten aufgerundet.';

alter function public.complete_food_meal(uuid)
  rename to complete_food_meal_core_wholepack;

create or replace function public.complete_food_meal(p_meal_id uuid)
returns public.food_meals
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_result public.food_meals%rowtype;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  create temporary table if not exists pg_temp.food_whole_unit_restore (
    ingredient_id uuid primary key,
    original_quantity numeric not null,
    original_unit text
  ) on commit drop;

  truncate table pg_temp.food_whole_unit_restore;

  insert into pg_temp.food_whole_unit_restore(
    ingredient_id,original_quantity,original_unit
  )
  select i.id,i.quantity,i.unit
  from public.food_meal_ingredients i
  join public.food_inventory f
    on f.id=i.inventory_id
   and f.user_id=v_user
   and f.is_active=true
  where i.meal_id=p_meal_id
    and i.user_id=v_user
    and i.quantity is not null
    and i.quantity>0
    and i.quantity_confirmed=true
    and f.consume_whole_unit=true
    and f.usage_content_quantity is not null
    and f.usage_content_quantity>0
    and lower(coalesce(i.unit,''))=lower(coalesce(f.usage_content_unit,''))
    and lower(coalesce(f.unit,''))<>lower(coalesce(i.unit,''));

  update public.food_meal_ingredients i
  set quantity=ceil(i.quantity/f.usage_content_quantity),
      unit=f.unit
  from public.food_inventory f,
       pg_temp.food_whole_unit_restore r
  where i.id=r.ingredient_id
    and f.id=i.inventory_id
    and f.user_id=v_user;

  v_result:=public.complete_food_meal_core_wholepack(p_meal_id);

  update public.food_meal_ingredients i
  set quantity=r.original_quantity,
      unit=r.original_unit
  from pg_temp.food_whole_unit_restore r
  where i.id=r.ingredient_id;

  return v_result;
end;
$$;

grant execute on function public.complete_food_meal(uuid) to authenticated;

update public.food_inventory
set usage_content_quantity=7,
    usage_content_unit='g',
    consume_whole_unit=true,
    updated_at=now()
where lower(name)='trockenbackhefe'
  and lower(unit)='päckchen';

update public.food_inventory
set consume_whole_unit=true,
    updated_at=now()
where lower(name)='backpulver'
  and lower(unit)='päckchen';

update public.food_recipe_ingredients
set quantity=7,
    label='7 g Trockenbackhefe'
where lower(name)='trockenbackhefe'
  and lower(coalesce(unit,''))='g'
  and quantity is distinct from 7;

update public.food_meal_ingredients i
set quantity=7,
    label='7 g Trockenbackhefe'
from public.food_meals m
where m.id=i.meal_id
  and m.status<>'completed'
  and lower(i.name)='trockenbackhefe'
  and lower(coalesce(i.unit,''))='g'
  and i.quantity is distinct from 7;
