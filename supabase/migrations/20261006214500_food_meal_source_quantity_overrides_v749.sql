-- V749: Allow planned family ingredients to keep a user-adjusted source split.
-- The ingredient total stays the sum of its concrete inventory sources.
alter table public.food_meal_ingredients
  add column if not exists allocation_override jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='food_meal_ingredients_allocation_override_array_chk'
      and conrelid='public.food_meal_ingredients'::regclass
  ) then
    alter table public.food_meal_ingredients
      add constraint food_meal_ingredients_allocation_override_array_chk
      check (
        allocation_override is null
        or jsonb_typeof(allocation_override)='array'
      );
  end if;
end
$$;

create or replace function public.set_food_meal_ingredient_allocation(
  p_ingredient_id uuid,
  p_allocations jsonb
)
returns public.food_meals
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid:=auth.uid();
  v_meal public.food_meals%rowtype;
  v_ing public.food_meal_ingredients%rowtype;
  v_item jsonb;
  v_stock public.food_inventory%rowtype;
  v_inventory_id uuid;
  v_quantity numeric;
  v_total numeric:=0;
  v_inventory_total numeric;
  v_normalized jsonb:='[]'::jsonb;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_allocations is null or jsonb_typeof(p_allocations)<>'array' then
    raise exception 'Aufteilung muss als Liste übergeben werden';
  end if;

  select i.* into v_ing
  from public.food_meal_ingredients i
  where i.id=p_ingredient_id
    and i.user_id=v_user
  for update;

  if not found then raise exception 'Zutat nicht gefunden'; end if;

  select * into v_meal
  from public.food_meals
  where id=v_ing.meal_id
    and user_id=v_user
  for update;

  if not found then raise exception 'Mahlzeit nicht gefunden'; end if;
  if v_meal.status='completed' or v_meal.inventory_booked_at is not null then
    raise exception 'Bereits gebuchte Mahlzeiten können nicht nachträglich geändert werden';
  end if;

  for v_item in select value from jsonb_array_elements(p_allocations)
  loop
    v_inventory_id:=nullif(v_item->>'inventory_id','')::uuid;
    v_quantity:=nullif(v_item->>'quantity','')::numeric;

    -- 0 means that this source is intentionally removed from the split.
    if v_quantity is not null and v_quantity=0 then
      continue;
    end if;

    if v_inventory_id is null or v_quantity is null or v_quantity<0 then
      raise exception 'Ungültige Quellenmenge';
    end if;

    select * into v_stock
    from public.food_inventory
    where id=v_inventory_id
      and user_id=v_user
      and is_active=true;

    if not found then raise exception 'Vorratsquelle nicht gefunden'; end if;
    if v_stock.quantity is null then raise exception 'Menge von "%" ist offen',v_stock.name; end if;
    if v_stock.unit is distinct from v_ing.unit then
      raise exception 'Einheit von "%" passt nicht zur Zutat',v_stock.name;
    end if;

    v_total:=v_total+v_quantity;
    v_normalized:=v_normalized||jsonb_build_array(
      jsonb_build_object(
        'inventory_id',v_inventory_id,
        'quantity',round(v_quantity,3),
        'unit',v_ing.unit,
        'label',coalesce(nullif(v_item->>'label',''),v_stock.variant_label,v_stock.name),
        'frozen',coalesce((v_item->>'frozen')::boolean,false)
      )
    );
  end loop;

  if v_total<=0 or jsonb_array_length(v_normalized)=0 then
    raise exception 'Mindestens eine Quellenmenge muss größer als 0 sein';
  end if;

  for v_inventory_id in
    select distinct (value->>'inventory_id')::uuid
    from jsonb_array_elements(v_normalized)
  loop
    select coalesce(sum((value->>'quantity')::numeric),0)
      into v_inventory_total
    from jsonb_array_elements(v_normalized)
    where (value->>'inventory_id')::uuid=v_inventory_id;

    select * into v_stock
    from public.food_inventory
    where id=v_inventory_id
      and user_id=v_user
      and is_active=true;

    if not found then raise exception 'Vorratsquelle nicht gefunden'; end if;
    if v_stock.quantity<v_inventory_total then
      raise exception 'Nicht genug "%" vorhanden',v_stock.name;
    end if;
  end loop;

  update public.food_meal_ingredients
  set quantity=round(v_total,3),
      quantity_confirmed=true,
      label=public.food_quantity_label(round(v_total,3),unit)||' '||name,
      allocation_override=v_normalized
  where id=v_ing.id
    and user_id=v_user;

  update public.food_meals
  set calories_kcal_per_serving_override=null,
      updated_at=now()
  where id=v_meal.id
  returning * into v_meal;

  return v_meal;
end;
$function$;

-- A direct edit of the overall ingredient amount intentionally returns the
-- ingredient to automatic allocation. Source-level edits use the RPC above.
create or replace function public.update_food_planned_meal_quantities(p_meal_id uuid, p_quantities jsonb)
returns public.food_meals
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_meal public.food_meals%rowtype;
  v_item jsonb;
  v_ingredient_id uuid;
  v_quantity numeric;
  v_remove boolean;
  v_updated integer;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_meal
  from public.food_meals
  where id=p_meal_id and user_id=v_user
  for update;

  if not found then raise exception 'Mahlzeit nicht gefunden'; end if;
  if v_meal.recipe_id is null then raise exception 'Diese Funktion ist nur für eingeplante Rezepte gedacht'; end if;
  if v_meal.leftover_id is not null then raise exception 'Restportionen können hier nicht geändert werden'; end if;
  if v_meal.status='completed' or v_meal.inventory_booked_at is not null then
    raise exception 'Bereits gebuchte Mahlzeiten können nicht nachträglich geändert werden';
  end if;
  if p_quantities is null or jsonb_typeof(p_quantities) <> 'array' then
    raise exception 'Mengen müssen als Liste übergeben werden';
  end if;

  for v_item in select value from jsonb_array_elements(p_quantities)
  loop
    v_ingredient_id := (v_item->>'id')::uuid;
    v_remove := coalesce((v_item->>'remove')::boolean,false);

    if v_remove then
      delete from public.food_meal_ingredients
      where id=v_ingredient_id
        and meal_id=p_meal_id
        and user_id=v_user;

      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception 'Eine Zutat konnte nicht eindeutig entfernt werden';
      end if;
      continue;
    end if;

    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Zutatenmengen müssen größer als 0 sein';
    end if;

    update public.food_meal_ingredients
    set quantity=v_quantity,
        quantity_confirmed=true,
        allocation_override=null,
        label=public.food_quantity_label(v_quantity,unit)||' '||name
    where id=v_ingredient_id
      and meal_id=p_meal_id
      and user_id=v_user;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'Eine Zutat konnte nicht eindeutig aktualisiert werden';
    end if;
  end loop;

  update public.food_meals
  set calories_kcal_per_serving_override=null,
      updated_at=now()
  where id=p_meal_id
  returning * into v_meal;

  return v_meal;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_food_meal_core_wholepack(p_meal_id uuid)
 RETURNS food_meals
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_meal public.food_meals%rowtype;
  v_source public.food_meals%rowtype;
  v_ing record;
  v_stock public.food_inventory%rowtype;
  v_family_stock public.food_inventory%rowtype;
  v_before numeric;
  v_after numeric;
  v_leftover numeric;
  v_reserved numeric:=0;
  v_available numeric:=0;
  v_leftover_id uuid;
  v_remaining numeric;
  v_take numeric;
  v_family_found boolean;
  v_override jsonb;
  v_override_inventory_id uuid;
  v_override_quantity numeric;
  v_override_unit text;
  v_override_sum numeric;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_meal
  from public.food_meals
  where id=p_meal_id and user_id=v_user
  for update;

  if not found then raise exception 'Mahlzeit nicht gefunden'; end if;

  if v_meal.inventory_booked_at is not null or v_meal.status='completed' then
    if v_meal.prepared_at is null then
      update public.food_meals
      set prepared_at=coalesce(v_meal.inventory_booked_at,now()),
          updated_at=now()
      where id=v_meal.id
      returning * into v_meal;
    end if;
    return v_meal;
  end if;

  if v_meal.source_meal_id is not null then
    select * into v_source
    from public.food_meals
    where id=v_meal.source_meal_id and user_id=v_user;

    if not found then raise exception 'Meal-Prep-Quelle nicht gefunden'; end if;
    if v_source.status <> 'completed' or v_source.prepared_at is null then
      raise exception 'Die Meal-Prep-Portion wurde noch nicht zubereitet';
    end if;
  end if;

  for v_ing in
    select * from public.food_meal_ingredients
    where meal_id=v_meal.id and user_id=v_user
      and quantity is not null
      and quantity_confirmed=true
    order by sort_order
  loop
    v_stock:=null;

    if v_ing.allocation_override is not null
       and jsonb_typeof(v_ing.allocation_override)='array'
       and jsonb_array_length(v_ing.allocation_override)>0 then
      v_override_sum:=0;

      for v_override in
        select value from jsonb_array_elements(v_ing.allocation_override)
      loop
        v_override_inventory_id:=nullif(v_override->>'inventory_id','')::uuid;
        v_override_quantity:=nullif(v_override->>'quantity','')::numeric;
        v_override_unit:=coalesce(nullif(v_override->>'unit',''),v_ing.unit);

        if v_override_inventory_id is null
           or v_override_quantity is null
           or v_override_quantity<=0 then
          raise exception 'Ungültige gespeicherte Zutatenaufteilung für "%"',v_ing.name;
        end if;

        select * into v_family_stock
        from public.food_inventory
        where id=v_override_inventory_id
          and user_id=v_user
          and is_active=true
        for update;

        if not found then
          raise exception 'Vorratsquelle für "%" wurde nicht gefunden',v_ing.name;
        end if;
        if v_family_stock.quantity is null then
          raise exception 'Menge von "%" ist offen',v_family_stock.name;
        end if;
        if v_family_stock.unit is distinct from v_override_unit
           or v_override_unit is distinct from v_ing.unit then
          raise exception 'Einheit von "%" passt nicht',v_family_stock.name;
        end if;
        if v_family_stock.quantity<v_override_quantity then
          raise exception 'Nicht genug "%" vorhanden',v_family_stock.name;
        end if;

        v_before:=v_family_stock.quantity;
        v_after:=v_family_stock.quantity-v_override_quantity;

        perform public.consume_food_inventory_lots(
          v_family_stock.id,
          v_override_quantity,
          v_family_stock.unit
        );

        update public.food_inventory
        set quantity=v_after,
            quantity_label=public.food_inventory_lot_label(id,v_after,unit),
            forecast_label=null,
            tone=case when v_after<=0 then 'empty' else v_family_stock.tone end,
            opened=true,
            updated_at=now()
        where id=v_family_stock.id;

        insert into public.food_inventory_movements(
          user_id,inventory_id,meal_id,kind,delta,quantity_before,quantity_after,note
        )
        values(
          v_user,v_family_stock.id,v_meal.id,'consume',-v_override_quantity,
          v_before,v_after,'Mahlzeit als zubereitet markiert · manuelle Zutatenaufteilung '||coalesce(v_ing.name,'')
        );

        v_override_sum:=v_override_sum+v_override_quantity;
      end loop;

      if abs(v_override_sum-v_ing.quantity)>0.001 then
        raise exception 'Gesamtmenge der gespeicherten Zutatenaufteilung stimmt bei "%" nicht',v_ing.name;
      end if;

      continue;
    end if;

    if v_ing.inventory_id is not null then
      select * into v_stock
      from public.food_inventory
      where id=v_ing.inventory_id and user_id=v_user and is_active=true
      for update;
    elsif v_ing.name is not null then
      select * into v_stock
      from public.food_inventory
      where user_id=v_user
        and is_active=true
        and lower(btrim(name))=lower(btrim(v_ing.name))
      order by sort_order
      limit 1
      for update;

      if v_stock.id is not null then
        update public.food_meal_ingredients
        set inventory_id=v_stock.id
        where id=v_ing.id and user_id=v_user;
      end if;
    end if;

    -- Generische Zutatenfamilie, z. B. "Tomaten":
    -- passende Varianten werden nach Verbrauchspriorität aufgeteilt.
    if v_stock.id is null
       and v_ing.inventory_id is null
       and v_ing.name is not null then
      v_remaining:=v_ing.quantity;
      v_family_found:=false;

      for v_family_stock in
        select *
        from public.food_inventory
        where user_id=v_user
          and is_active=true
          and lower(btrim(coalesce(family_name,'')))=lower(btrim(v_ing.name))
          and unit is not distinct from v_ing.unit
          and quantity is not null
          and quantity>0
        order by
          case
            when lower(coalesce(name,'')||' '||coalesce(variant_label,'')) ~ '(^|[[:space:]])(tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)([[:space:]]|$)'
              then 1
            else 0
          end,
          coalesce(
            (
              select min(l.purchased_on)
              from public.food_inventory_lots l
              where l.inventory_id=food_inventory.id
                and (
                  coalesce(l.unopened_packages,0)>0
                  or coalesce(l.opened_remaining_quantity,0)>0
                )
            ),
            food_inventory.created_at::date,
            date '9999-12-31'
          ),
          case use_priority
            when 'tomorrow' then 1
            when 'three_days' then 2
            else 3
          end,
          opened desc,
          sort_order,
          id
        for update
      loop
        v_family_found:=true;
        exit when v_remaining<=0;

        v_take:=least(v_family_stock.quantity,v_remaining);
        v_before:=v_family_stock.quantity;
        v_after:=v_family_stock.quantity-v_take;

        perform public.consume_food_inventory_lots(v_family_stock.id,v_take,v_family_stock.unit);

        update public.food_inventory
        set quantity=v_after,
            quantity_label=public.food_inventory_lot_label(id,v_after,unit),
            forecast_label=null,
            tone=case when v_after<=0 then 'empty' else v_family_stock.tone end,
            opened=true,
            updated_at=now()
        where id=v_family_stock.id;

        insert into public.food_inventory_movements(
          user_id,inventory_id,meal_id,kind,delta,quantity_before,quantity_after,note
        )
        values(
          v_user,v_family_stock.id,v_meal.id,'consume',-v_take,
          v_before,v_after,'Mahlzeit als zubereitet markiert · Zutatenfamilie '||v_ing.name
        );

        v_remaining:=v_remaining-v_take;
      end loop;

      if v_family_found then
        if v_remaining>0 then
          raise exception 'Nicht genug "%" vorhanden',v_ing.name;
        end if;
        continue;
      end if;
    end if;

    if v_stock.id is null then continue; end if;
    if v_stock.quantity is null then raise exception 'Menge von "%" ist offen',v_stock.name; end if;
    if v_stock.unit is distinct from v_ing.unit then raise exception 'Einheit von "%" passt nicht',v_stock.name; end if;
    if v_stock.quantity<v_ing.quantity then raise exception 'Nicht genug "%" vorhanden',v_stock.name; end if;

    v_before:=v_stock.quantity;
    v_after:=v_stock.quantity-v_ing.quantity;

    perform public.consume_food_inventory_lots(v_stock.id,v_ing.quantity,v_stock.unit);

    update public.food_inventory
    set quantity=v_after,
        quantity_label=public.food_inventory_lot_label(id,v_after,unit),
        forecast_label=null,
        tone=case when v_after<=0 then 'empty' else v_stock.tone end,
        opened=true,
        updated_at=now()
    where id=v_stock.id;

    insert into public.food_inventory_movements(
      user_id,inventory_id,meal_id,kind,delta,quantity_before,quantity_after,note
    )
    values(
      v_user,v_stock.id,v_meal.id,'consume',-v_ing.quantity,
      v_before,v_after,'Mahlzeit als zubereitet markiert'
    );
  end loop;

  v_leftover:=greatest(v_meal.prepared_servings-v_meal.eaten_servings,0);

  if v_leftover>0
     and v_meal.recipe_id is not null
     and v_meal.leftover_id is null
     and v_meal.source_meal_id is null then

    select coalesce(sum(eaten_servings),0)
      into v_reserved
    from public.food_meals
    where user_id=v_user
      and source_meal_id=v_meal.id
      and status='planned';

    if v_reserved>v_leftover then
      raise exception 'Mehr Meal-Prep-Portionen eingeplant (%) als beim Kochen entstehen (%)',v_reserved,v_leftover;
    end if;

    v_available:=v_leftover-v_reserved;

    insert into public.food_leftovers(
      user_id,recipe_id,source_meal_id,available_servings,original_servings,status,note
    )
    values(
      v_user,v_meal.recipe_id,v_meal.id,v_available,v_leftover,
      case when v_available<=0 then 'exhausted' else 'available' end,
      case when v_reserved>0
        then 'Beim Zubereiten entstanden · '||v_reserved||' Portion(en) bereits im Plan reserviert'
        else 'Beim Zubereiten der Mahlzeit entstanden'
      end
    )
    on conflict (source_meal_id)
    do update set
      available_servings=excluded.available_servings,
      original_servings=excluded.original_servings,
      status=excluded.status,
      note=excluded.note,
      updated_at=now()
    returning id into v_leftover_id;

    update public.food_meals
    set leftover_id=v_leftover_id,
        updated_at=now()
    where user_id=v_user
      and source_meal_id=v_meal.id
      and status='planned';
  end if;

  update public.food_meals
  set status='completed',
      inventory_booked_at=now(),
      prepared_at=now(),
      updated_at=now()
  where id=v_meal.id
  returning * into v_meal;

  return v_meal;
end;
$function$

