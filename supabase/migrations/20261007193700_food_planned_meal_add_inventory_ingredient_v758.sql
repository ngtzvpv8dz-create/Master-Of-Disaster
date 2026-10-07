-- V758 · Zutaten aus dem vorhandenen Vorrat nur für eine konkrete geplante Mahlzeit ergänzen.
-- Das Grundrezept bleibt unverändert.

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
  v_inventory_id uuid;
  v_inventory public.food_inventory%rowtype;
  v_quantity numeric;
  v_unit text;
  v_remove boolean;
  v_add boolean;
  v_updated integer;
  v_sort_order smallint;
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
    raise exception 'Änderungen müssen als Liste übergeben werden';
  end if;

  for v_item in select value from jsonb_array_elements(p_quantities)
  loop
    v_add := coalesce((v_item->>'add')::boolean,false);

    if v_add then
      v_inventory_id := nullif(v_item->>'inventory_id','')::uuid;
      v_quantity := nullif(v_item->>'quantity','')::numeric;
      v_unit := nullif(trim(coalesce(v_item->>'unit','')),'');

      if v_inventory_id is null then raise exception 'Bitte eine Vorratszutat auswählen'; end if;
      if v_quantity is null or v_quantity <= 0 then raise exception 'Zutatenmengen müssen größer als 0 sein'; end if;

      select * into v_inventory
      from public.food_inventory
      where id=v_inventory_id and user_id=v_user and is_active=true;

      if not found then raise exception 'Die ausgewählte Vorratszutat ist nicht verfügbar'; end if;
      v_unit := coalesce(v_unit,nullif(trim(v_inventory.unit),''));
      if v_unit is null then raise exception 'Für die neue Zutat fehlt eine Einheit'; end if;

      select coalesce(max(sort_order),0)+1
      into v_sort_order
      from public.food_meal_ingredients
      where meal_id=p_meal_id and user_id=v_user;

      insert into public.food_meal_ingredients(
        user_id,meal_id,inventory_id,name,label,quantity,unit,quantity_confirmed,sort_order,allocation_override,thaw_started_at
      )
      values(
        v_user,p_meal_id,v_inventory.id,v_inventory.name,
        public.food_quantity_label(v_quantity,v_unit)||' '||v_inventory.name,
        v_quantity,v_unit,true,v_sort_order,null,null
      );
      continue;
    end if;

    v_ingredient_id := nullif(v_item->>'id','')::uuid;
    if v_ingredient_id is null then raise exception 'Zutat konnte nicht zugeordnet werden'; end if;
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

    v_quantity := nullif(v_item->>'quantity','')::numeric;
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
