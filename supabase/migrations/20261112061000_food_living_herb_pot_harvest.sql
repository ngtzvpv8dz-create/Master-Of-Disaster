-- Living edible herb pots are counted by plant, not by a fictional
-- remaining number of leaves. Harvests are recorded in grams per meal.
-- 2026-11-12: persist the proven V1 hotfix in GitHub migration history.
CREATE OR REPLACE FUNCTION public.food_mark_living_herb_pot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.food_inventory i
    WHERE i.id=NEW.inventory_id
      AND i.unit='Topf'
      AND lower(i.name) ~ '(basilikum|petersilie|schnittlauch|koriander|minze|rosmarin|thymian|oregano|salbei|dill)'
  ) THEN
    NEW.batch_data=coalesce(NEW.batch_data,'{}'::jsonb)
      ||jsonb_build_object('living_plant',true,'stock_tracking_mode','pot_presence_not_grams');
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS food_mark_living_herb_pot_before_insert ON public.food_inventory_lots;
CREATE TRIGGER food_mark_living_herb_pot_before_insert
BEFORE INSERT OR UPDATE OF inventory_id ON public.food_inventory_lots
FOR EACH ROW EXECUTE FUNCTION public.food_mark_living_herb_pot();

DO $migration$
DECLARE
  v_source text;
  v_anchor text:=E'    v_stock:=null;\n    v_isoclear_family_fallback:=false;';
  v_patch text:=$patch$

    -- Living herb leaves: gram harvest is nutrition input, NOT a deduction
    -- from the plant counted in pots. Store one harvest event per ingredient.
    IF v_ing.unit='g' AND v_ing.quantity>0
       AND v_ing.allocation_override IS NULL
       AND EXISTS (
         SELECT 1 FROM public.food_inventory f
         JOIN public.food_inventory_lots l ON l.inventory_id=f.id AND l.user_id=v_user
         WHERE f.user_id=v_user AND f.is_active=true AND f.unit='Topf'
           AND f.quantity>=1 AND l.batch_data->>'living_plant'='true'
           AND lower(f.name) LIKE '%'||lower(btrim(v_ing.name))||'%'
       )
    THEN
      UPDATE public.food_inventory_lots plant_lot
      SET batch_data=jsonb_set(
            coalesce(plant_lot.batch_data,'{}'::jsonb),
            '{harvest_events}',
            coalesce(plant_lot.batch_data->'harvest_events','[]'::jsonb)
              || jsonb_build_array(jsonb_build_object(
                   'meal_id',v_meal.id::text,
                   'ingredient_id',v_ing.id::text,
                   'quantity_g',v_ing.quantity,
                   'meal_date',v_meal.meal_date::text,
                   'recorded_at',now()::text)),true),
          updated_at=now()
      WHERE plant_lot.id=(
        SELECT l.id
        FROM public.food_inventory_lots l
        JOIN public.food_inventory f ON f.id=l.inventory_id
        WHERE f.user_id=v_user AND l.user_id=v_user AND f.is_active=true
          AND f.unit='Topf' AND f.quantity>=1
          AND l.batch_data->>'living_plant'='true'
          AND lower(f.name) LIKE '%'||lower(btrim(v_ing.name))||'%'
        ORDER BY l.purchased_on DESC NULLS LAST,l.created_at DESC
        LIMIT 1)
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            coalesce(plant_lot.batch_data->'harvest_events','[]'::jsonb)) previous
          WHERE previous->>'meal_id'=v_meal.id::text
            AND previous->>'ingredient_id'=v_ing.id::text
        );
      CONTINUE;
    END IF;
$patch$;
BEGIN
  SELECT pg_get_functiondef('public.complete_food_meal_core_wholepack(uuid)'::regprocedure)
    INTO v_source;
  IF position('Living herb leaves: gram harvest is nutrition input' IN v_source)>0
    OR position('Lebende Kräuterpflanzen: geerntete Blattgramm' IN v_source)>0
  THEN
    RAISE NOTICE 'Existing herb-pot harvest handler preserved';
  ELSIF position(v_anchor IN v_source)>0 THEN
    EXECUTE replace(v_source,v_anchor,v_anchor||v_patch);
  ELSE
    RAISE EXCEPTION 'Food completion core changed: herb-pot patch requires manual review';
  END IF;
END
$migration$;
