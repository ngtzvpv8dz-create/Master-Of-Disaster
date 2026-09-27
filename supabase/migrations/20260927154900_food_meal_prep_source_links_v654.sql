alter table public.food_meals
  add column if not exists source_meal_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.food_meals'::regclass
      and conname='food_meals_source_meal_id_fkey'
  ) then
    alter table public.food_meals
      add constraint food_meals_source_meal_id_fkey
      foreign key (source_meal_id) references public.food_meals(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.food_meals'::regclass
      and conname='food_meals_source_meal_not_self_check'
  ) then
    alter table public.food_meals
      add constraint food_meals_source_meal_not_self_check
      check (source_meal_id is null or source_meal_id <> id);
  end if;
end
$$;

create index if not exists food_meals_source_meal_id_idx
  on public.food_meals(source_meal_id)
  where source_meal_id is not null;

create or replace function public.schedule_food_recipe(
  p_recipe_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_prepared_servings numeric,
  p_eaten_servings numeric
)
returns public.food_meals
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_recipe public.food_recipes%rowtype;
  v_meal public.food_meals%rowtype;
  v_existing public.food_meals%rowtype;
  v_scale numeric;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_meal_type not in ('breakfast','snack','lunch','dinner') then raise exception 'Ungültige Mahlzeit'; end if;
  if p_prepared_servings is null or p_prepared_servings <= 0 then raise exception 'Ungültige Portionszahl'; end if;
  if p_eaten_servings is null or p_eaten_servings <= 0 or p_eaten_servings > p_prepared_servings then
    raise exception 'Portionen für den Tag müssen zwischen 0 und den zubereiteten Portionen liegen';
  end if;

  select * into v_recipe
  from public.food_recipes
  where id=p_recipe_id and user_id=v_user and active=true;

  if not found then raise exception 'Rezept nicht gefunden'; end if;

  v_scale := p_prepared_servings / greatest(v_recipe.servings,1);

  select * into v_existing
  from public.food_meals
  where user_id=v_user and meal_date=p_meal_date and meal_type=p_meal_type
  for update;

  if found and v_existing.status='completed' then
    raise exception 'Eine bereits erledigte Mahlzeit kann nicht überschrieben werden';
  end if;

  if found and v_existing.leftover_id is not null then
    update public.food_leftovers
    set available_servings=available_servings+v_existing.eaten_servings,
        status='available',
        updated_at=now()
    where id=v_existing.leftover_id and user_id=v_user;
  end if;

  insert into public.food_meals(
    user_id,meal_date,meal_type,title,status,sort_order,note,recipe_id,
    prepared_servings,eaten_servings,leftover_id,source_meal_id
  )
  values(
    v_user,p_meal_date,p_meal_type,v_recipe.title,'planned',
    case p_meal_type when 'breakfast' then 1 when 'snack' then 2 when 'lunch' then 3 else 4 end,
    null,v_recipe.id,p_prepared_servings,p_eaten_servings,null,null
  )
  on conflict (user_id,meal_date,meal_type)
  do update set
    title=excluded.title,
    status='planned',
    inventory_booked_at=null,
    note=null,
    recipe_id=excluded.recipe_id,
    prepared_servings=excluded.prepared_servings,
    eaten_servings=excluded.eaten_servings,
    leftover_id=null,
    source_meal_id=null,
    updated_at=now()
  returning * into v_meal;

  delete from public.food_meal_ingredients
  where meal_id=v_meal.id and user_id=v_user;

  insert into public.food_meal_ingredients(
    user_id,meal_id,inventory_id,name,label,quantity,unit,quantity_confirmed,sort_order
  )
  select
    v_user,
    v_meal.id,
    inventory_id,
    name,
    label,
    case when quantity is null then null else round(quantity * v_scale,3) end,
    unit,
    true,
    sort_order
  from public.food_recipe_ingredients
  where recipe_id=v_recipe.id and user_id=v_user
  order by sort_order;

  return v_meal;
end;
$function$;

create or replace function public.schedule_food_leftover(
  p_leftover_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_servings numeric
)
returns public.food_meals
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_leftover public.food_leftovers%rowtype;
  v_recipe public.food_recipes%rowtype;
  v_meal public.food_meals%rowtype;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_meal_type not in ('breakfast','snack','lunch','dinner') then raise exception 'Ungültige Mahlzeit'; end if;
  if p_servings is null or p_servings <= 0 then raise exception 'Ungültige Portionszahl'; end if;

  select * into v_leftover
  from public.food_leftovers
  where id=p_leftover_id and user_id=v_user and status='available'
  for update;

  if not found then raise exception 'Restportion nicht gefunden'; end if;
  if v_leftover.available_servings < p_servings then raise exception 'Nicht genug Restportionen vorhanden'; end if;

  if exists(
    select 1 from public.food_meals
    where user_id=v_user and meal_date=p_meal_date and meal_type=p_meal_type
  ) then
    raise exception 'Für diesen Tag und diese Mahlzeit ist bereits etwas eingeplant';
  end if;

  select * into v_recipe
  from public.food_recipes
  where id=v_leftover.recipe_id and user_id=v_user;

  insert into public.food_meals(
    user_id,meal_date,meal_type,title,status,sort_order,note,recipe_id,
    prepared_servings,eaten_servings,leftover_id,source_meal_id
  )
  values(
    v_user,p_meal_date,p_meal_type,v_recipe.title,'planned',
    case p_meal_type when 'breakfast' then 1 when 'snack' then 2 when 'lunch' then 3 else 4 end,
    'Meal Prep · bereits zubereitet · aus vorhandener Meal-Prep-Portion eingeplant',
    v_recipe.id,p_servings,p_servings,v_leftover.id,v_leftover.source_meal_id
  )
  returning * into v_meal;

  update public.food_leftovers
  set available_servings=available_servings-p_servings,
      status=case when available_servings-p_servings <= 0 then 'exhausted' else 'available' end,
      updated_at=now()
  where id=v_leftover.id;

  return v_meal;
end;
$function$;

create or replace function public.complete_food_meal(p_meal_id uuid)
returns public.food_meals
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid:=auth.uid();
  v_meal public.food_meals%rowtype;
  v_source public.food_meals%rowtype;
  v_ing record;
  v_stock public.food_inventory%rowtype;
  v_before numeric;
  v_after numeric;
  v_leftover numeric;
  v_reserved numeric:=0;
  v_available numeric:=0;
  v_leftover_id uuid;
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
$function$;
