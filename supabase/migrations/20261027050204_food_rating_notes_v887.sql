-- V887: Persistent qualitative food feedback, separate from operational meal notes.
-- Existing rating values and notes are untouched.
alter table public.food_meals
  add column if not exists rating_note text;
alter table public.food_recipes
  add column if not exists rating_note text;
comment on column public.food_meals.rating_note is
  'Optional user feedback for this particular planned/prepared meal; retain for historical and future planning review.';
comment on column public.food_recipes.rating_note is
  'Optional user feedback for the recipe; planning should consult this before repeating or scaling the recipe.';
