-- Nicht bestandsgeführte, ausdrücklich nicht einkaufsrelevante Vorräte
-- blockieren den Mahlzeitenabschluss nicht.
-- Beispiel: frischer Basilikum vom Balkon mit offener Menge.

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

  create temporary table if not exists pg_temp.food_untracked_restore (
    ingredient_id uuid primary key,
    original_quantity_confirmed boolean not null
  ) on commit drop;

  truncate table pg_temp.food_whole_unit_restore;
  truncate table pg_temp.food_untracked_restore;

  insert into pg_temp.food_untracked_restore(
    ingredient_id,original_quantity_confirmed
  )
  select i.id,i.quantity_confirmed
  from public.food_meal_ingredients i
  join public.food_inventory f
    on f.id=i.inventory_id
   and f.user_id=v_user
   and f.is_active=true
  where i.meal_id=p_meal_id
    and i.user_id=v_user
    and i.quantity_confirmed=true
    and f.quantity is null
    and f.shopping_excluded=true;

  update public.food_meal_ingredients i
  set quantity_confirmed=false
  from pg_temp.food_untracked_restore r
  where i.id=r.ingredient_id;

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

  update public.food_meal_ingredients i
  set quantity_confirmed=r.original_quantity_confirmed
  from pg_temp.food_untracked_restore r
  where i.id=r.ingredient_id;

  return v_result;
end;
$$;

grant execute on function public.complete_food_meal(uuid) to authenticated;
