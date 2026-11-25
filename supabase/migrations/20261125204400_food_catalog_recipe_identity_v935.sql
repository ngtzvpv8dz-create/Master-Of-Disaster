-- V935: canonical identity is additive; keep original booking keys, quantities and historical snapshots.
-- No source ingredient or product rows are modified. An unresolved variant is never silently guessed.
create or replace view public.food_catalog_recipe_identity_v1 with (security_invoker=true) as
with source_rows as (
  select user_id,inventory_id,coalesce(nullif(btrim(name),''),label) as source_name from public.food_recipe_ingredients
  union all
  select user_id,inventory_id,coalesce(nullif(btrim(name),''),label) from public.food_meal_ingredients
), source_keys as (
  select user_id,inventory_id,source_name,count(*) as position_count from source_rows group by user_id,inventory_id,source_name
), aliases(source_name,target_name) as (values ('Spinat TK','Blattspinat, tiefgekühlt'),
('TK Spinat','Blattspinat, tiefgekühlt'),
('Blattspinat TK','Blattspinat, tiefgekühlt'),
('Spinat frisch','Blattspinat, frisch'),
('Babyspinat frisch','Blattspinat, frisch'),
('Spinat','Blattspinat, Zustand offen'),
('Blattspinat','Blattspinat, Zustand offen'),
('Mango (essbar)','Mango, frisch'),
('Mango frisch','Mango, frisch'),
('Apfel','Äpfel'),
('Ayran Natur','Ayran'),
('Batate','Süßkartoffeln, frisch'),
('Beerenmischung TK','Beerenmix, tiefgekühlt'),
('Blaubeeren','Heidelbeeren'),
('Blaubeeren frisch','Heidelbeeren'),
('Brokkoli TK','Brokkoli, tiefgekühlt'),
('Buschbohnen frisch','Grüne Bohnen, frisch'),
('Chia Samen','Chiasamen'),
('Edamame TK ohne Schote','Sojabohnen, Edamame/Mukimame, ausgelöst, tiefgekühlt'),
('Griechischer Joghurt 2 %','Joghurt, griechisch, natur, 2 % Fett'),
('Griechischer Joghurt 9,4 %','Joghurt, griechischer Art, natur, 9,4 % Fett'),
('Grüne Bohnen TK','Grüne Bohnen, tiefgekühlt'),
('Karotten / Möhren','Möhren'),
('Kichererbsen abgetropft','Kichererbsen, Konserve/Glas'),
('Kreuzkümmel gemahlen','Kreuzkümmel'),
('Mais abgetropft','Mais Dose'),
('Mandarinen/Clementinen','Mandarine'),
('Minze getrocknet','Minze, getrocknet'),
('Paprika orange','Paprika, orange, frisch'),
('Paprika TK bunt','Paprika, bunt, tiefgekühlt, Streifen'),
('Pita','Pitabrot'),
('Quinoa weiß','Quinoa, weiß'),
('Rinderhackfleisch Light','Rinderhack, mager, etwa 5 % Fett'),
('Thunfisch im eigenen Saft','Thunfisch, eigener Saft, Konserve'),
('TK-Erbsen','Erbsen, tiefgekühlt'),
('Zimt gemahlen','Zimt'),
('Zwiebeln TK','Zwiebeln, tiefgekühlt'),
('Zwiebeln TK gewürfelt','Zwiebeln, tiefgekühlt'),
('Zwiebeln TK in Scheiben','Zwiebeln, tiefgekühlt'),
('ELO Frost Zwiebelwürfel TK','Zwiebeln, tiefgekühlt'),
('Tortilla Wraps Vollkorn','Tortilla-Wraps Vollkorn'),
('Bananen','Banane'),
('Basilikum frisch (Balkon)','Basilikum, frisch'),
('Cashews','Cashewkerne, natur'),
('Chio Dip Mild Salsa','Salsa mild'),
('Chio Dip Hot Salsa','Salsa scharf'),
('Frischkäse leicht','Frischkäse, natur, fettreduziert'),
('Frischkäse Balance','Frischkäse, natur, fettreduziert'),
('Hackfleisch gemischt','Gemischtes Hack'),
('Körniger Frischkäse','Frischkäse, körnig'),
('Naturjoghurt 1,5 %','Joghurt, natur, 1,5 % Fett'),
('Paprika gelb','Paprika, gelb, frisch'),
('Paprika rot','Paprika, rot, frisch'),
('Blockpaprika grün','Paprika, grün, frisch'),
('Blockpaprika orange','Paprika, orange, frisch'),
('Paprikapulver edelsüß','Paprikapulver, edelsüß'),
('Pfeffer schwarz','Pfeffer, schwarz'),
('Roggen-Vollkornbrot','Roggenvollkornbrot'),
('Zarte Haferflocken','Haferflocken zart'),
('Teriyaki-Sauce','Teriyaki-soße'),
('Hokkaido-Kürbisbrot','Kürbisbrot'),
('Mini Pflaumentomaten','Mini-Pflaumentomaten, frisch'),
('Mozzarella Light','Mozzarella, fettreduziert, Milchart offen'),
('Quinoa','Quinoa, Farbe offen'),
('Joghurt griechischer Art Pur · 9,4 % Fett','Joghurt, griechischer Art, natur, 9,4 % Fett'),
('Rote-Bete-Wraps · EDEKA Herzstücke','Wraps, Rote Bete'),
('Sonnenmais Konserve','Mais Dose'),
('Spitzpaprika Kapia Sweet','Spitzpaprika, Kapia, frisch'),
('Wild-Heidelbeeren','Heidelbeeren, tiefgekühlt')),
family_aliases(source_name,target_family) as (values ('Wasser','Wasser'),
('Mandu TK','Gefüllte Teigwaren'),
('Hokkaido-Kürbis TK','Kürbis'),
('TK-Kirschen','Kirschen'),
('Wraps','Wraps und Tortillas'),
('Feta / Hirtenkäse','Käse'),
('Feta / Hirtenkäse leicht','Käse'),
('Schnittkäse','Käse'),
('Sojasauce','Soßen'),
('Tomatensalsa','Soßen'),
('Chio Dip Salsa','Soßen'),
('Kiwi','Kiwi'),
('Champignons','Champignons'),
('Kaki','Kaki'),
('Blattsalat','Blattsalat'),
('Blattsalat roh','Blattsalat'),
('Kokosmilch light','Kokosmilch'),
('Sesamkörner','Sesam'),
('Mandelmus','Mandeln'),
('Mageres Rindfleisch','Rind'),
('Pide-Fladenbrot','Fladenbrote'),
('Öl','Speiseöle'),
('Erdnussbutter crunchy','Erdnussaufstriche'),
('Leinsamen geschrotet braun','Leinsamen'),
('Putenbrustfilet','Pute'),
('Knoblauchzehen','Knoblauch')),
catalog as (
 select user_id,id as catalog_ingredient_id,null::uuid as product_variant_id,name as canonical_name,family_name,catalog_role,source_details
 from public.food_catalog_ingredients
 union all
 select user_id,null::uuid,id,variant_name,family_name,'Produktvariante'::text,'{}'::jsonb
 from public.food_catalog_product_variants
)
select s.user_id,s.inventory_id,s.source_name,s.position_count,
case when c.candidate_count=1 then c.canonical_name else s.source_name end as canonical_name,
case when c.candidate_count=1 then c.family_name else coalesce(fa.target_family,pl.family_name,nullif(i.family_name,''),t.family_name) end as family_name,
case when c.candidate_count=1 then c.catalog_ingredient_id end as catalog_ingredient_id,
case when c.candidate_count=1 then c.product_variant_id end as product_variant_id,
case when c.candidate_count=1 and c.catalog_role='Zuordnung offen' then 'variant_open'
when c.candidate_count=1 then 'matched'
when c.candidate_count>1 then 'ambiguous'
when coalesce(fa.target_family,pl.family_name,nullif(i.family_name,''),t.family_name) is not null then 'family_only'
else 'unmapped' end as resolution
from source_keys s
left join aliases a on lower(btrim(s.source_name))=lower(btrim(a.source_name))
left join family_aliases fa on lower(btrim(s.source_name))=lower(btrim(fa.source_name))
left join lateral (
 with matches as (
  select c.catalog_ingredient_id,c.product_variant_id,c.canonical_name,c.family_name,c.catalog_role,
    case when a.target_name is not null and lower(btrim(c.canonical_name))=lower(btrim(a.target_name)) then 1
    when lower(btrim(c.canonical_name))=lower(btrim(s.source_name)) then 2
    when exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(c.source_details->'original_names')='array' then c.source_details->'original_names' else '[]'::jsonb end) j(n) where lower(btrim(j.n))=lower(btrim(s.source_name))) then 3
    when exists(select 1 from public.shopping_products p join public.food_catalog_product_links l on l.product_id=p.id and l.user_id=s.user_id where p.user_id=s.user_id and p.inventory_id=s.inventory_id and (c.catalog_ingredient_id=l.catalog_ingredient_id or c.product_variant_id=l.product_variant_id)) then 4 end as priority
  from catalog c where c.user_id=s.user_id
 ), best as (select distinct * from matches where priority=(select min(priority) from matches))
 select min(canonical_name) as canonical_name,min(family_name) as family_name,min(catalog_role) as catalog_role,
 (array_agg(distinct catalog_ingredient_id) filter(where catalog_ingredient_id is not null))[1] as catalog_ingredient_id,
 (array_agg(distinct product_variant_id) filter(where product_variant_id is not null))[1] as product_variant_id,
 count(distinct canonical_name) as candidate_count from best
) c on true
left join public.food_inventory i on i.id=s.inventory_id and i.user_id=s.user_id
left join lateral (select case when count(distinct l.proposed_family_name)=1 then min(l.proposed_family_name) end as family_name from public.shopping_products p join public.food_catalog_product_links l on l.product_id=p.id and l.user_id=s.user_id where p.user_id=s.user_id and p.inventory_id=s.inventory_id) pl on true
left join lateral (select case when count(distinct f.name)=1 then min(f.name) end as family_name from public.food_ingredient_family_terms ft join public.food_ingredient_families f on f.id=ft.family_id and f.user_id=s.user_id where ft.user_id=s.user_id and lower(btrim(ft.term))=lower(btrim(s.source_name))) t on true;
revoke all on public.food_catalog_recipe_identity_v1 from public, anon;
grant select on public.food_catalog_recipe_identity_v1 to authenticated;
comment on view public.food_catalog_recipe_identity_v1 is 'Canonical ingredient names and families for recipe and meal source keys; unresolved identity remains explicit. Uses invoker RLS.';
