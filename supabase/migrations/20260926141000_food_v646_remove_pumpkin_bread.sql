-- V646 · Hokkaido-Kürbisbrot aus Standardplanung entfernen
-- Historische erledigte Mahlzeiten bleiben unverändert.

update public.food_inventory
set quantity=0,
    quantity_label='0 Scheiben',
    tone='empty',
    is_active=false,
    shopping_excluded=true,
    archived_at=coalesce(archived_at,now()),
    archived_reason='Restbestand am 26.09.2026 verschimmelt und entsorgt; kein Standard-Nachkauf, nur bei erneutem Backen wieder aktivieren.',
    updated_at=now()
where id='b894261a-c83b-4d8a-b911-dbcfae8376aa';

update public.food_recipes
set active=false,
    display_note='Spezialrezept pausiert. Nur wieder aktivieren, wenn Hokkaido-Kürbisbrot bewusst neu gebacken wurde.'
where id in (
  '2ea30f84-b7fc-40e4-ad95-c6a6f9865e98',
  '68b536ca-625a-45a1-b5db-b8f378ce2b79'
);

update public.food_recipes
set title='Hähnchen-Gemüse-Reispfanne',
    description='Schnelle Hähnchen-Reispfanne mit Brokkoli, Zucchini und Paprika.',
    instructions='1. 70 g Reis mit 140 ml Wasser garen. Währenddessen Hähnchen und Gemüse vorbereiten.
2. Hähnchenbrust trocken tupfen und in mundgerechte Stücke schneiden. Brokkoli in kleine Röschen teilen, Zucchini und Paprika würfeln, Zwiebel schneiden und Knoblauch fein hacken.
3. 5 g Olivenöl in einer großen beschichteten Pfanne erhitzen. Hähnchen bei mittlerer bis hoher Hitze rundherum anbraten und mit 2 g Salz, 0,5 g schwarzem Pfeffer und 2 g Paprikapulver edelsüß würzen. Kurz aus der Pfanne nehmen.
4. Zwiebel, Brokkoli, Zucchini und Paprika in derselben Pfanne anbraten. 30 ml Wasser zugeben und den Brokkoli mit Deckel einige Minuten bissfest garen.
5. Knoblauch kurz mitbraten. Das Hähnchen wieder dazugeben und alles gut vermengen.
6. Den gegarten Reis unterheben. Mit weiteren 0,5 g Salz und 0,25 g schwarzem Pfeffer würzen und 1–2 Minuten gemeinsam heiß werden lassen.
7. Direkt heiß servieren.',
    display_note='Standardrezept ohne Kürbisbrot.'
where id='f4bbcc7e-43a9-4faf-8e07-45a0bb1047ec';

delete from public.food_recipe_ingredients
where recipe_id='f4bbcc7e-43a9-4faf-8e07-45a0bb1047ec'
  and inventory_id='b894261a-c83b-4d8a-b911-dbcfae8376aa';

update public.food_recipes
set title='Vollkorn-Wrap mit Ei, Tomate & Salsa',
    description='Schnelles Mittagessen mit Vollkorn-Wrap, Ei, Tomate und etwas Mild Salsa.',
    calories_kcal_per_serving=373,
    instructions='1. Eier kochen oder braten.
2. Tomaten waschen und klein schneiden.
3. Vollkorn-Wrap kurz erwärmen und mit Tomaten und Ei belegen.
4. Mild Salsa darübergeben, Wrap einrollen und direkt servieren.',
    display_note='Samstagmittag: 1 Vollkorn-Wrap, 2 Eier, 60 g Tomaten Mix und 20 ml Mild Salsa.'
where id='7b175b58-d706-49f3-b685-068ec2a6d0ef';

update public.food_recipe_ingredients
set name='Tortilla Wraps Vollkorn',
    label='1 Vollkorn-Wrap',
    quantity=1,
    unit='Stück',
    inventory_id='c54b9f3b-aa7c-4cf4-9bd0-8474165fc0bd'
where id='d964cf2f-92b9-44e6-b751-1290ed58e585';

update public.food_recipe_ingredients
set name='Tomaten Mix',
    label='60 g Tomaten Mix',
    inventory_id='add6e557-e4b2-4d50-9f05-62bd75928ee5'
where id='ab51a5b5-778c-427e-b47b-5bcee2f62d30';

update public.food_meals
set title='Vollkorn-Wrap mit Ei, Tomate & Salsa',
    note='Kürbisbrot ist verschimmelt und entsorgt. Mittagessen auf 1 Vollkorn-Wrap + 2 Eier + 60 g Tomaten Mix + 20 ml Mild Salsa umgestellt.'
where id='2ea74294-2e08-418c-8ed7-9e0aeba2b4d9';

update public.food_meal_ingredients
set name='Tortilla Wraps Vollkorn',
    label='1 Vollkorn-Wrap',
    quantity=1,
    unit='Stück',
    inventory_id='c54b9f3b-aa7c-4cf4-9bd0-8474165fc0bd'
where id='7cfd1bf5-f4cb-44ff-97b7-e000b5c75253';

update public.food_meal_ingredients
set name='Tomaten Mix',
    label='60 g Tomaten Mix',
    inventory_id='add6e557-e4b2-4d50-9f05-62bd75928ee5'
where id='d1def2e8-06cf-440b-8a58-d6a532a102e0';

update public.food_recipes
set title='Zucchini-Hack-Paprika-Pfanne',
    description='Resteverwertungs-Pfanne für Zucchini, Paprika und offenes Hackfleisch.',
    calories_kcal_per_serving=449,
    instructions='1. Zwiebel würfeln, Knoblauch fein hacken, Zucchini und Paprika in mundgerechte Stücke schneiden.
2. 5 g Olivenöl in einer großen beschichteten Pfanne erhitzen. Hackfleisch krümelig und kräftig anbraten.
3. Zwiebel und Knoblauch dazugeben und kurz mitbraten.
4. Zucchini und Paprika zufügen und bei mittlerer bis hoher Hitze bissfest garen.
5. 20 ml Mild Salsa unterrühren. Mit 1,5 g Salz, 0,4 g schwarzem Pfeffer und 1,5 g Paprikapulver edelsüß würzen.
6. Direkt heiß servieren.',
    display_note='Kleinere Abendportion ohne Brot. 150 g Zucchini und 90 g Paprika am Samstag; die restlichen offenen Gemüseanteile gehen Sonntagabend in die Wokpfanne.'
where id='51750b39-7577-4534-b075-55f64f125894';

delete from public.food_recipe_ingredients
where id='cd30ebed-0f7d-444c-aca0-98a9b30f0a7f';

update public.food_recipe_ingredients
set sort_order=sort_order-1
where recipe_id='51750b39-7577-4534-b075-55f64f125894'
  and sort_order>7;

update public.food_meals
set title='Zucchini-Hack-Paprika-Pfanne',
    note='Kürbisbrot ist verschimmelt und entsorgt. Abendessen bleibt als Zucchini-Hack-Paprika-Pfanne ohne Brot bestehen.'
where id='6e4fff7f-d84b-4b3f-867e-98ad9661cfc7';

delete from public.food_meal_ingredients
where id='e56cbcda-479d-40d3-ba71-dd13e8675e6c';

update public.food_meal_ingredients
set sort_order=sort_order-1
where meal_id='6e4fff7f-d84b-4b3f-867e-98ad9661cfc7'
  and sort_order>7;
