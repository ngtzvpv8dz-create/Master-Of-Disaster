-- FOOD: ratings for non-recipe meals (recipe ratings remain on food_recipes).
-- Nullable to preserve all historical meal records and existing rating choices.
alter table public.food_meals
  add column if not exists rating smallint,
  add column if not exists rating_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.food_meals'::regclass
      and conname='food_meals_rating_range'
  ) then
    alter table public.food_meals
      add constraint food_meals_rating_range
      check (rating is null or rating between 1 and 5);
  end if;
end $$;
