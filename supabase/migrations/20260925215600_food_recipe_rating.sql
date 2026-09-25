-- V636 · FOOD Rezeptbewertung 1–5 Sterne
alter table public.food_recipes
  add column if not exists rating smallint,
  add column if not exists rating_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'food_recipes_rating_range'
      and conrelid = 'public.food_recipes'::regclass
  ) then
    alter table public.food_recipes
      add constraint food_recipes_rating_range
      check (rating is null or rating between 1 and 5);
  end if;
end $$;
