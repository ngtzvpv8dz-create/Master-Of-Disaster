-- V544 follow-up: cover new foreign keys and avoid a duplicate meal index.
begin;

drop index if exists public.food_meals_user_date_type_uidx;

create index if not exists food_inventory_movements_user_idx on public.food_inventory_movements(user_id);
create index if not exists food_inventory_movements_inventory_idx on public.food_inventory_movements(inventory_id);
create index if not exists food_inventory_movements_meal_idx on public.food_inventory_movements(meal_id);
create index if not exists food_meal_ingredients_inventory_idx on public.food_meal_ingredients(inventory_id);
create index if not exists food_meals_recipe_idx on public.food_meals(recipe_id);
create index if not exists food_recipe_ingredients_user_idx on public.food_recipe_ingredients(user_id);
create index if not exists food_recipe_ingredients_recipe_idx on public.food_recipe_ingredients(recipe_id);
create index if not exists food_recipe_ingredients_inventory_idx on public.food_recipe_ingredients(inventory_id);
create index if not exists food_shopping_items_user_idx on public.food_shopping_items(user_id);

commit;
