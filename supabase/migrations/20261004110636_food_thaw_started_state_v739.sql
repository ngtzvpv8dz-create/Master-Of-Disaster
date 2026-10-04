alter table public.food_meal_ingredients
  add column if not exists thaw_started_at timestamptz;

comment on column public.food_meal_ingredients.thaw_started_at is
  'Zeitpunkt, an dem die konkret geplante TK-Zutat zum Auftauen aus dem Tiefkühler genommen wurde. Null = noch nicht bestätigt.';

create index if not exists idx_food_meal_ingredients_thaw_started
  on public.food_meal_ingredients(user_id,thaw_started_at)
  where thaw_started_at is not null;
