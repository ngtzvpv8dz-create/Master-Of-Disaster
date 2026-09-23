create or replace function public.update_food_planned_meal_quantities(
  p_meal_id uuid,
  p_quantities jsonb
)
returns public.food_meals
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_meal public.food_meals%rowtype;
  v_item jsonb;
  v_ingredient_id uuid;
  v_quantity numeric;
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
    v_quantity := (v_item->>'quantity')::numeric;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Zutatenmengen müssen größer als 0 sein';
    end if;

    update public.food_meal_ingredients
    set quantity=v_quantity,
        quantity_confirmed=true,
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
  set updated_at=now()
  where id=p_meal_id
  returning * into v_meal;

  return v_meal;
end;
$function$;
