-- V857: Generic apples booked in whole pieces from apple family; nutrition remains gram-based.
-- Matches the live Supabase migration food_generic_apples_piece_booking_v857.
CREATE OR REPLACE FUNCTION public.complete_food_meal(p_meal_id uuid)
 RETURNS food_meals
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_result public.food_meals%rowtype;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- V839: no completed meal with silently skipped inventory-backed ingredients.
  if exists (
    select 1 from public.food_meal_ingredients i
    where i.meal_id=p_meal_id and i.user_id=v_user
      and i.quantity>0 and i.quantity_confirmed=false
      and (
        i.inventory_id is not null
        or (nullif(btrim(coalesce(i.name,'')),'') is not null and exists (
          select 1 from public.food_inventory f
          where f.user_id=v_user and f.is_active=true
            and (lower(btrim(f.name))=lower(btrim(i.name))
              or lower(btrim(coalesce(f.family_name,'')))=lower(btrim(i.name)))
        ))
      )
  ) then
    raise exception 'Zubereitung nicht gebucht: Nicht bestätigte Zutatenmengen im Vorrat. Bitte erst die Zutatenmengen bestätigen.';
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

  -- V857: apple recipes keep their original grams for nutrition;
  -- family stock (Pink Lady, Granny Smith) is consumed as whole pieces.
  create temporary table if not exists pg_temp.food_apple_piece_restore (
    ingredient_id uuid primary key,
    original_quantity numeric not null,
    original_unit text not null,
    piece_quantity numeric not null
  ) on commit drop;
  truncate table pg_temp.food_apple_piece_restore;

  insert into pg_temp.food_apple_piece_restore (
    ingredient_id,original_quantity,original_unit,piece_quantity
  )
  select i.id,i.quantity,i.unit,
         greatest(1,ceil(i.quantity/(ref.weight_g*1.1)-0.00000001))
  from public.food_meal_ingredients i
  join public.food_meals m on m.id=i.meal_id and m.user_id=v_user
  cross join lateral (
    select coalesce(
      nullif(p.product_data->>'edible_weight_per_piece_g','')::numeric,
      nullif(p.product_data->>'edible_weight_per_piece_estimated_g','')::numeric,
      nullif(p.product_data->>'piece_weight_g','')::numeric
    ) as weight_g
    from public.food_inventory f
    join public.shopping_products p on p.inventory_id=f.id
      and p.user_id=v_user and p.active=true
    where f.user_id=v_user and f.is_active=true
      and lower(btrim(coalesce(f.family_name,'')))='apfel'
      and f.unit='Stück'
    order by (case when f.quantity>0 then 0 else 1 end),
             f.quantity desc,f.sort_order nulls last
    limit 1
  ) ref
  where i.meal_id=p_meal_id and i.user_id=v_user
    and m.status='planned' and m.inventory_booked_at is null
    and i.inventory_id is null and i.allocation_override is null
    and i.quantity_confirmed=true and i.quantity>0
    and lower(btrim(coalesce(i.name,''))) in ('apfel','äpfel')
    and lower(btrim(coalesce(i.unit,'')))='g'
    and ref.weight_g>0;

  if (select coalesce(sum(piece_quantity),0) from pg_temp.food_apple_piece_restore)
     > (select coalesce(sum(greatest(0,quantity)),0)
        from public.food_inventory
        where user_id=v_user and is_active=true
          and lower(btrim(coalesce(family_name,'')))='apfel'
          and unit='Stück') then
    raise exception 'Nicht genug Äpfel im Stückvorrat für diese Mahlzeit';
  end if;

  update public.food_meal_ingredients i
  set quantity=r.piece_quantity,unit='Stück'
  from pg_temp.food_apple_piece_restore r
  where i.id=r.ingredient_id and i.user_id=v_user;

  v_result:=public.complete_food_meal_core_wholepack(p_meal_id);
  -- Restore recipe quantities/units exactly; only the stock change uses pieces.
  update public.food_meal_ingredients i
  set quantity=r.original_quantity,unit=r.original_unit
  from pg_temp.food_apple_piece_restore r
  where i.id=r.ingredient_id and i.user_id=v_user;


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
$function$

