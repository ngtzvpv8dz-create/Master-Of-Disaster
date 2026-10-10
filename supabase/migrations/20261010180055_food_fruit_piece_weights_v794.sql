-- V794 · Fruit piece weights. Applied to Supabase as migration 20261010180055.
-- Nutrition uses weight per piece from shopping_products; historical gram quantities still book reliably.

CREATE OR REPLACE FUNCTION public.food_piece_weight_g(p_inventory_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    nullif(p.product_data->>'edible_weight_per_piece_g','')::numeric,
    nullif(p.product_data->>'piece_weight_g','')::numeric
  )
  from public.shopping_products p
  where p.inventory_id=p_inventory_id
    and p.user_id=auth.uid()
    and p.active=true
    and (
      coalesce(nullif(p.product_data->>'edible_weight_per_piece_g','')::numeric,0)>0
      or coalesce(nullif(p.product_data->>'piece_weight_g','')::numeric,0)>0
    )
  order by p.updated_at desc,p.id
  limit 1
$function$
;

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
  v_effective_quantity numeric;
  v_piece_weight_g numeric;
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
    v_effective_quantity:=v_ing.quantity;
    v_piece_weight_g:=null;
    if v_stock.unit='Stück' and v_ing.unit='g' then
      v_piece_weight_g:=public.food_piece_weight_g(v_stock.id);
      if v_piece_weight_g>0 then
        v_effective_quantity:=round(v_ing.quantity/v_piece_weight_g,6);
      end if;
    end if;
    if v_stock.quantity is null then raise exception 'Menge von "%" ist offen',v_stock.name; end if;
    if v_stock.unit is distinct from v_ing.unit and v_piece_weight_g is null then raise exception 'Einheit von "%" passt nicht',v_stock.name; end if;
    if v_stock.quantity<v_effective_quantity then raise exception 'Nicht genug "%" vorhanden',v_stock.name; end if;

    v_before:=v_stock.quantity;
    v_after:=v_stock.quantity-v_effective_quantity;

    perform public.consume_food_inventory_lots(v_stock.id,v_effective_quantity,v_stock.unit);

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
      v_user,v_stock.id,v_meal.id,'consume',-v_effective_quantity,
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
;
