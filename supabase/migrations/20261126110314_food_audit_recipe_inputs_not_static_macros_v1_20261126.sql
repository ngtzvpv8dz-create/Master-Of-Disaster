CREATE OR REPLACE FUNCTION public.collect_food_audit_issues(p_user uuid, p_day date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with issues as (
 select 'meal_unconfirmed'::text as kind, 1 as priority,m.id as reference_id,
 m.title as label,
 ('Geplant, aber nicht bestätigt: '||m.title||'. Gegessen, verschoben oder ausgefallen?')::text as question
 from public.food_meals m
 where m.user_id=p_user and m.meal_date=p_day and m.status='planned'

 union all
 select 'meal_stock_unbooked',1,m.id,m.title,
 ('Vorratsabzug bei '||m.title||' nicht dokumentiert. Wurden die Zutaten verbraucht?')::text
 from public.food_meals m
 where m.user_id=p_user and m.meal_date=p_day and m.status='completed'
 and m.inventory_booked_at is null
 and exists (select 1 from public.food_meal_ingredients mi where mi.meal_id=m.id and mi.inventory_id is not null and not mi.eaten_only_extra)

 union all
 select 'ingredient_quantity',1,mi.id,mi.name,
 ('Menge noch unklar: '||coalesce(mi.name,mi.label)||' bei '||m.title||'. Was war die tatsächliche Menge?')::text
 from public.food_meals m join public.food_meal_ingredients mi on mi.meal_id=m.id
 where m.user_id=p_user and m.meal_date=p_day and m.status in ('completed','planned')
 and (mi.quantity is null or mi.quantity<=0 or not mi.quantity_confirmed)

 union all
 select 'ingredient_without_allocation',3,mi.id,coalesce(mi.name,mi.label),
 ('Zuordnung prüfen: '||coalesce(mi.name,mi.label)||' bei '||m.title||'. Aus Vorrat oder zusätzlich besorgt?')::text
 from public.food_meals m join public.food_meal_ingredients mi on mi.meal_id=m.id
 where m.user_id=p_user and m.meal_date=p_day and m.status='completed'
 and m.inventory_booked_at is not null and mi.inventory_id is null
 and mi.quantity>0 and not mi.eaten_only_extra
 and lower(trim(coalesce(mi.name,mi.label))) not in ('wasser','salz')
 and not exists (
   select 1 from public.food_inventory_movements mv
   join public.food_inventory stock on stock.id=mv.inventory_id and stock.user_id=mv.user_id
   where mv.meal_id=m.id and mv.user_id=m.user_id and mv.kind='consume'
     and lower(trim(coalesce(nullif(stock.family_name,''),stock.name)))=lower(trim(coalesce(mi.name,mi.label)))
     and lower(trim(stock.unit))=lower(trim(mi.unit))
   group by mv.meal_id
   having sum(abs(mv.delta)) >= mi.quantity - 0.001
 )

 union all
 select 'nutrition_product_incomplete',4,p.id,i.name,
 ('Nährwerte unvollständig: '||i.name||'. Packungsangaben für Kalorien und Makros prüfen?')::text
 from public.shopping_products p
 join public.food_inventory i on i.id=p.inventory_id and i.user_id=p.user_id
 where p.user_id=p_user and p.active and i.is_active and i.quantity>0
 and coalesce(p.category,'') not in ('Nahrungsergänzung','Kaffeekapseln','Gewürze','Drogerie')
 and exists (
   select 1 from unnest(array['energy_kcal','protein_g','fat_g','carbohydrates_g']) as nutrient(key)
   where public.food_nutrient_range_v1(p.nutrition_per_100,nutrient.key,1)->>'status'='unknown'
 )

 union all
 select 'stock_uncertain',2,i.id,i.name,
 ('Vorratsmenge offen: '||i.name||'. Was ist tatsächlich noch vorhanden?')::text
 from public.food_inventory i
 where i.user_id=p_user and i.is_active and (i.quantity is null or i.pending_weighing)

 union all
 select 'negative_stock',1,i.id,i.name,
 ('Negativer Vorratsbestand: '||i.name||'. Bitte Buchungen oder tatsächlichen Bestand prüfen.')::text
 from public.food_inventory i
 where i.user_id=p_user and i.is_active and i.quantity<0

 union all
 -- Static per-serving fields are optional legacy values. The FOOD module
 -- calculates actual calories and macros from ingredient and product sources.
 -- The SQL nightly audit checks the inputs it can verify; the existing
 -- collectNutritionAudit in food-nutrition-v711.js checks dynamic nutrition.
 select 'recipe_inputs_incomplete',4,r.id,r.title,
 ('Rezept-Zutaten unvollständig: '||r.title||'. Zutaten, Mengen und Einheiten prüfen.')::text
 from public.food_recipes r
 where r.user_id=p_user and r.active
 and (
   not exists(select 1 from public.food_recipe_ingredients ri where ri.recipe_id=r.id and ri.user_id=r.user_id)
   or exists(select 1 from public.food_recipe_ingredients ri
     where ri.recipe_id=r.id and ri.user_id=r.user_id
     and (ri.quantity is null or ri.quantity<=0 or ri.quantity>='Infinity'::numeric
       or nullif(btrim(ri.unit),'') is null or nullif(btrim(coalesce(ri.name,ri.label)),'') is null))
 )
 and exists(select 1 from public.food_meals m where m.recipe_id=r.id and m.user_id=p_user and m.meal_date=p_day and m.status in ('planned','completed'))

 union all
 select 'extra_nutrition_incomplete',2,e.id,e.title,
 ('Zusätzlicher Verzehr ohne vollständige Nährwerte: '||e.title||'. Packungsdaten ergänzen?')::text
 from public.food_extra_consumptions e
 where e.user_id=p_user and e.consumption_date=p_day
 and (e.calories_kcal is null or e.protein_g is null or e.carbohydrates_g is null or e.fat_g is null)

 union all
 select 'catalog_wrong_owner',1,p.id,p.product_name,
 ('Produkt-Zuordnung widersprüchlich: '||p.product_name||'. Welcher Vorratsartikel ist richtig?')::text
 from public.shopping_products p
 left join public.food_inventory i on i.id=p.inventory_id
 where p.user_id=p_user and p.active and p.inventory_id is not null
 and (i.id is null or i.user_id <> p.user_id)
)
select coalesce(jsonb_agg(jsonb_build_object(
 'kind',kind,'priority',priority,'reference_id',reference_id,
 'label',label,'question',question) order by priority,kind,label),'[]'::jsonb)
from issues;
$function$;
