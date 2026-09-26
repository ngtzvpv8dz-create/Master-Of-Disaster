-- V646b · historische Hähnchen-Kürbisbrot-Mahlzeit bewahren
-- Das alte Rezept bleibt als inaktive Historie. Die erledigte Mahlzeit behält ihre damals gegessenen Meal-Zutaten.
-- Ein neues aktives Standardrezept ohne Kürbisbrot wird daraus abgeleitet.

update public.food_recipes
set title='Hähnchen-Gemüse-Reispfanne mit Kürbisbrot',
    description='Schnelle Hähnchen-Reispfanne mit Brokkoli, Zucchini und Paprika; dazu Hokkaido-Kürbisbrot.',
    active=false,
    instructions='1. 70 g Reis mit 140 ml Wasser garen. Währenddessen Hähnchen und Gemüse vorbereiten.
2. Hähnchenbrust trocken tupfen und in mundgerechte Stücke schneiden. Brokkoli in kleine Röschen teilen, Zucchini und Paprika würfeln, Zwiebel schneiden und Knoblauch fein hacken.
3. 5 g Olivenöl in einer großen beschichteten Pfanne erhitzen. Hähnchen bei mittlerer bis hoher Hitze rundherum anbraten und mit 2 g Salz, 0,5 g schwarzem Pfeffer und 2 g Paprikapulver edelsüß würzen. Kurz aus der Pfanne nehmen.
4. Zwiebel, Brokkoli, Zucchini und Paprika in derselben Pfanne anbraten. 30 ml Wasser zugeben und den Brokkoli mit Deckel einige Minuten bissfest garen.
5. Knoblauch kurz mitbraten. Das Hähnchen wieder dazugeben und alles gut vermengen.
6. Den gegarten Reis unterheben. Mit weiteren 0,5 g Salz und 0,25 g schwarzem Pfeffer würzen und 1–2 Minuten gemeinsam heiß werden lassen.
7. Pfanne auf einen Teller geben und Scheibe 5 des Hokkaido-Kürbisbrots dazu servieren.',
    display_note='Historisches Rezept vom 25.09.2026. Nicht als Standardrezept verwenden; Kürbisbrot nur bei bewusstem Neu-Backen.',
    updated_at=now()
where id='f4bbcc7e-43a9-4faf-8e07-45a0bb1047ec';

insert into public.food_recipes(
  user_id,title,meal_type,description,active,prep_minutes,difficulty,servings,
  calories_kcal_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,
  instructions,source_label,display_note,rating,rating_updated_at
)
select
  user_id,
  'Hähnchen-Gemüse-Reispfanne',
  meal_type,
  'Schnelle Hähnchen-Reispfanne mit Brokkoli, Zucchini und Paprika.',
  true,
  prep_minutes,difficulty,servings,
  calories_kcal_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,
  '1. 70 g Reis mit 140 ml Wasser garen. Währenddessen Hähnchen und Gemüse vorbereiten.
2. Hähnchenbrust trocken tupfen und in mundgerechte Stücke schneiden. Brokkoli in kleine Röschen teilen, Zucchini und Paprika würfeln, Zwiebel schneiden und Knoblauch fein hacken.
3. 5 g Olivenöl in einer großen beschichteten Pfanne erhitzen. Hähnchen bei mittlerer bis hoher Hitze rundherum anbraten und mit 2 g Salz, 0,5 g schwarzem Pfeffer und 2 g Paprikapulver edelsüß würzen. Kurz aus der Pfanne nehmen.
4. Zwiebel, Brokkoli, Zucchini und Paprika in derselben Pfanne anbraten. 30 ml Wasser zugeben und den Brokkoli mit Deckel einige Minuten bissfest garen.
5. Knoblauch kurz mitbraten. Das Hähnchen wieder dazugeben und alles gut vermengen.
6. Den gegarten Reis unterheben. Mit weiteren 0,5 g Salz und 0,25 g schwarzem Pfeffer würzen und 1–2 Minuten gemeinsam heiß werden lassen.
7. Direkt heiß servieren.',
  source_label,
  'Standardrezept ohne Kürbisbrot.',
  rating,rating_updated_at
from public.food_recipes
where id='f4bbcc7e-43a9-4faf-8e07-45a0bb1047ec'
on conflict (user_id,title) do update
set description=excluded.description,
    active=true,
    prep_minutes=excluded.prep_minutes,
    difficulty=excluded.difficulty,
    servings=excluded.servings,
    calories_kcal_per_serving=excluded.calories_kcal_per_serving,
    protein_g_per_serving=excluded.protein_g_per_serving,
    carbs_g_per_serving=excluded.carbs_g_per_serving,
    fat_g_per_serving=excluded.fat_g_per_serving,
    instructions=excluded.instructions,
    source_label=excluded.source_label,
    display_note=excluded.display_note,
    updated_at=now();

delete from public.food_recipe_ingredients
where recipe_id=(
  select id from public.food_recipes
  where user_id='2e6ae782-e9b6-4412-97e8-d88d54d75604'
    and title='Hähnchen-Gemüse-Reispfanne'
);

insert into public.food_recipe_ingredients(
  user_id,recipe_id,inventory_id,label,quantity,unit,sort_order,name
)
select
  old.user_id,
  new.id,
  old.inventory_id,
  old.label,
  old.quantity,
  old.unit,
  case when old.sort_order>8 then old.sort_order-1 else old.sort_order end,
  old.name
from public.food_recipe_ingredients old
join public.food_recipes new
  on new.user_id=old.user_id and new.title='Hähnchen-Gemüse-Reispfanne'
where old.recipe_id='f4bbcc7e-43a9-4faf-8e07-45a0bb1047ec';
