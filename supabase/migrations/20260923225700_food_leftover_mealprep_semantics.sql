create or replace function public.schedule_food_leftover(
  p_leftover_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_servings numeric
)
returns public.food_meals
language plpgsql
set search_path to 'public','pg_temp'
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
    prepared_servings,eaten_servings,leftover_id
  )
  values(
    v_user,p_meal_date,p_meal_type,v_recipe.title,'planned',
    case p_meal_type when 'breakfast' then 1 when 'snack' then 2 when 'lunch' then 3 else 4 end,
    'Meal Prep · bereits zubereitet · aus vorhandener Restportion eingeplant',
    v_recipe.id,p_servings,p_servings,v_leftover.id
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
