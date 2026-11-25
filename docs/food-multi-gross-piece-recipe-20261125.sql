-- REVIEW ONLY; requires tested food-verified-piece-booking-20261125.sql first, not automatic deployment.
-- Rollback tests: 293g exact selection, 151g single piece, ordinary meal; wrong total, duplicate, missing weight, wrong weight rejected. Original recipe grams restored and inventory unchanged after test.
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.complete_food_meal(uuid)'::regprocedure))<>'10c0f89f1e263a1aab9483e1dcce47a5' THEN RAISE EXCEPTION 'Live source changed; review and retest'; END IF;
 IF position('v_piece_selection boolean' in pg_get_functiondef('public.consume_food_inventory_lots_for_meal(uuid,numeric,text,uuid)'::regprocedure))=0 THEN RAISE EXCEPTION 'Verified-piece booking prerequisite missing';END IF;
END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES('complete_food_meal_pre_multi_gross_pieces',pg_get_functiondef('public.complete_food_meal(uuid)'::regprocedure));
CREATE OR REPLACE FUNCTION public.complete_food_meal(p_meal_id uuid)
 RETURNS food_meals
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_result public.food_meals%rowtype;
  v_multi record; v_multi_count int; v_multi_distinct int; v_multi_gross numeric; v_multi_valid boolean;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- V862: explicit meal completion accepts numeric planned quantities.
  -- The user's "Abschließen" action confirms the displayed positive plan
  -- quantities in ONE step; the inventory, unit, lot, and piece guards in the
  -- core still reject missing/mismatching actual stocks atomically.
  -- No recipe or kitchen quantity is changed by this action.
  IF EXISTS (
    SELECT 1 FROM public.food_meals m
    WHERE m.id=p_meal_id AND m.user_id=v_user
      AND m.status='planned' AND m.inventory_booked_at IS NULL
  ) THEN
    UPDATE public.food_meal_ingredients i
    SET quantity_confirmed=true
    WHERE i.meal_id=p_meal_id AND i.user_id=v_user
      AND i.quantity_confirmed=false
      AND i.quantity IS NOT NULL AND i.quantity>0
      AND NULLIF(BTRIM(COALESCE(i.name,'')),'') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(i.unit,'')),'') IS NOT NULL;
  END IF;
  -- No positive, named food ingredient may be silently skipped.
  IF EXISTS (
    SELECT 1 FROM public.food_meal_ingredients i
    WHERE i.meal_id=p_meal_id AND i.user_id=v_user
      AND i.quantity>0 AND i.quantity_confirmed=false
      AND NULLIF(BTRIM(COALESCE(i.name,'')),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Zubereitung nicht gebucht: Bitte nicht bestätigte oder unvollständige Mengen prüfen.';
  END IF;

  create temporary table if not exists pg_temp.food_whole_unit_restore (
    ingredient_id uuid primary key,
    original_quantity numeric not null,
    original_unit text
  ) on commit drop;

  create temporary table if not exists pg_temp.food_untracked_restore (
    ingredient_id uuid primary key,
    original_quantity_confirmed boolean not null
  ) on commit drop;

  truncate table pg_temp.food_whole_unit_restore;
  truncate table pg_temp.food_untracked_restore;

  insert into pg_temp.food_untracked_restore(
    ingredient_id,original_quantity_confirmed
  )
  select i.id,i.quantity_confirmed
  from public.food_meal_ingredients i
  join public.food_inventory f
    on f.id=i.inventory_id
   and f.user_id=v_user
   and f.is_active=true
  where i.meal_id=p_meal_id
    and i.user_id=v_user
    and i.quantity_confirmed=true
    and f.quantity is null
    and f.shopping_excluded=true;

  update public.food_meal_ingredients i
  set quantity_confirmed=false
  from pg_temp.food_untracked_restore r
  where i.id=r.ingredient_id;

  insert into pg_temp.food_whole_unit_restore(
    ingredient_id,original_quantity,original_unit
  )
  select i.id,i.quantity,i.unit
  from public.food_meal_ingredients i
  join public.food_inventory f
    on f.id=i.inventory_id
   and f.user_id=v_user
   and f.is_active=true
  where i.meal_id=p_meal_id
    and i.user_id=v_user
    and i.quantity is not null
    and i.quantity>0
    and i.quantity_confirmed=true
    and f.consume_whole_unit=true
    and f.usage_content_quantity is not null
    and f.usage_content_quantity>0
    and lower(coalesce(i.unit,''))=lower(coalesce(f.usage_content_unit,''))
    and lower(coalesce(f.unit,''))<>lower(coalesce(i.unit,''));

  update public.food_meal_ingredients i
  set quantity=ceil(i.quantity/f.usage_content_quantity),
      unit=f.unit
  from public.food_inventory f,
       pg_temp.food_whole_unit_restore r
  where i.id=r.ingredient_id
    and f.id=i.inventory_id
    and f.user_id=v_user;

  -- V857: apple recipes keep their original grams for nutrition;
  -- family stock (Pink Lady, Granny Smith) is consumed as whole pieces.
  create temporary table if not exists pg_temp.food_apple_piece_restore (
    ingredient_id uuid primary key,
    original_quantity numeric not null,
    original_unit text not null,
    piece_quantity numeric not null
  ) on commit drop;
  truncate table pg_temp.food_apple_piece_restore;

  insert into pg_temp.food_apple_piece_restore (
    ingredient_id,original_quantity,original_unit,piece_quantity
  )
  select i.id,i.quantity,i.unit,
         greatest(1,ceil(i.quantity/(ref.weight_g*1.1)-0.00000001))
  from public.food_meal_ingredients i
  join public.food_meals m on m.id=i.meal_id and m.user_id=v_user
  cross join lateral (
    select coalesce(
      nullif(p.product_data->>'edible_weight_per_piece_g','')::numeric,
      nullif(p.product_data->>'edible_weight_per_piece_estimated_g','')::numeric,
      nullif(p.product_data->>'piece_weight_g','')::numeric
    ) as weight_g
    from public.food_inventory f
    join public.shopping_products p on p.inventory_id=f.id
      and p.user_id=v_user and p.active=true
    where f.user_id=v_user and f.is_active=true
      and lower(btrim(coalesce(f.family_name,'')))='apfel'
      and f.unit='Stück'
    order by (case when f.quantity>0 then 0 else 1 end),
             f.quantity desc,f.sort_order nulls last
    limit 1
  ) ref
  where i.meal_id=p_meal_id and i.user_id=v_user
    and m.status='planned' and m.inventory_booked_at is null
    and i.inventory_id is null and i.allocation_override is null
    and i.quantity_confirmed=true and i.quantity>0
    and lower(btrim(coalesce(i.name,''))) in ('apfel','äpfel')
    and lower(btrim(coalesce(i.unit,'')))='g'
    and ref.weight_g>0;

  if (select coalesce(sum(piece_quantity),0) from pg_temp.food_apple_piece_restore)
     > (select coalesce(sum(greatest(0,quantity)),0)
        from public.food_inventory
        where user_id=v_user and is_active=true
          and lower(btrim(coalesce(family_name,'')))='apfel'
          and unit='Stück') then
    raise exception 'Nicht genug Äpfel im Stückvorrat für diese Mahlzeit';
  end if;

  update public.food_meal_ingredients i
  set quantity=r.piece_quantity,unit='Stück'
  from pg_temp.food_apple_piece_restore r
  where i.id=r.ingredient_id and i.user_id=v_user;


  -- Measured produce: grams for nutrition, whole pieces for stock booking.
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.food_measured_piece_restore (
    ingredient_id uuid PRIMARY KEY, original_quantity numeric NOT NULL,
    original_unit text NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.food_measured_piece_restore;
  INSERT INTO pg_temp.food_measured_piece_restore(ingredient_id,original_quantity,original_unit)
  SELECT i.id,i.quantity,i.unit
  FROM public.food_meal_ingredients i
  WHERE i.meal_id=p_meal_id AND i.user_id=v_user
    AND i.quantity_confirmed=true AND lower(i.unit)='g'
    AND jsonb_typeof(i.allocation_override)='array'
    AND jsonb_array_length(i.allocation_override)=1
    AND lower(i.allocation_override->0->>'unit')='stück'
    AND (i.allocation_override->0->>'actual_weight_g')::numeric=i.quantity
    AND (i.allocation_override->0->>'quantity')::numeric>0
    AND EXISTS(SELECT 1 FROM public.food_inventory f
      WHERE f.id=(i.allocation_override->0->>'inventory_id')::uuid
        AND f.user_id=v_user AND f.unit='Stück' AND f.is_active=true);
  -- Multiple whole apples/avocados in gram-based recipes: use only exact
  -- per-piece gross weights. Do not modify the gram recipe permanently.
  FOR v_multi IN
    SELECT i.id,i.quantity,i.unit,i.allocation_override
    FROM public.food_meal_ingredients i JOIN public.food_meals m ON m.id=i.meal_id AND m.user_id=i.user_id
    WHERE i.meal_id=p_meal_id AND i.user_id=v_user AND m.status='planned' AND m.inventory_booked_at IS NULL
      AND i.quantity_confirmed=true AND lower(i.unit)='g'
      AND jsonb_typeof(i.allocation_override)='array'
      AND jsonb_array_length(i.allocation_override)>1
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(i.allocation_override) a
        JOIN public.food_inventory f ON f.id::text=a->>'inventory_id' AND f.user_id=v_user
        WHERE f.family_name IN ('Apfel','Avocado','Banane','Mango','Limette') AND lower(a->>'unit')='stück')
  LOOP
    SELECT count(*),count(DISTINCT a->>'piece_id'),coalesce(sum(c.gross_weight_g),0),
      coalesce(bool_and(c.piece_id IS NOT NULL AND a->>'unit'='Stück' AND a->>'quantity'='1'
        AND a->>'product_id'=c.product_id::text
        AND COALESCE(a->>'gross_weight_g',a->>'actual_weight_g',a->>'piece_weight_g') ~ '^[0-9]+([.][0-9]+)?$'
        AND CASE WHEN COALESCE(a->>'gross_weight_g',a->>'actual_weight_g',a->>'piece_weight_g') ~ '^[0-9]+([.][0-9]+)?$'
          THEN COALESCE(a->>'gross_weight_g',a->>'actual_weight_g',a->>'piece_weight_g')::numeric=c.gross_weight_g ELSE false END
      ),false)
      INTO v_multi_count,v_multi_distinct,v_multi_gross,v_multi_valid
    FROM jsonb_array_elements(v_multi.allocation_override) a
    LEFT JOIN public.food_inventory f ON f.id::text=a->>'inventory_id' AND f.user_id=v_user AND f.family_name IN ('Apfel','Avocado','Banane','Mango','Limette') AND f.is_active
    LEFT JOIN LATERAL public.food_available_measured_whole_pieces(f.id) c ON c.piece_id::text=a->>'piece_id' AND c.lot_id::text=a->>'lot_id';
    IF NOT v_multi_valid OR v_multi_count<>v_multi_distinct OR v_multi_gross IS DISTINCT FROM v_multi.quantity THEN
      RAISE EXCEPTION 'Mehrstück-Rezept: Stückauswahl und gesamtes Bruttogewicht stimmen nicht überein';
    END IF;
    INSERT INTO pg_temp.food_measured_piece_restore(ingredient_id,original_quantity,original_unit)
    VALUES(v_multi.id,v_multi.quantity,v_multi.unit);
  END LOOP;
  UPDATE public.food_meal_ingredients i
  SET quantity=(SELECT sum((a->>'quantity')::numeric) FROM jsonb_array_elements(i.allocation_override) a),unit='Stück'
  FROM pg_temp.food_measured_piece_restore r WHERE i.id=r.ingredient_id;

  v_result:=public.complete_food_meal_core_wholepack(p_meal_id);
  UPDATE public.food_meal_ingredients i
  SET quantity=r.original_quantity,unit=r.original_unit
  FROM pg_temp.food_measured_piece_restore r WHERE i.id=r.ingredient_id;

  -- Restore recipe quantities/units exactly; only the stock change uses pieces.
  update public.food_meal_ingredients i
  set quantity=r.original_quantity,unit=r.original_unit
  from pg_temp.food_apple_piece_restore r
  where i.id=r.ingredient_id and i.user_id=v_user;


  update public.food_meal_ingredients i
  set quantity=r.original_quantity,
      unit=r.original_unit
  from pg_temp.food_whole_unit_restore r
  where i.id=r.ingredient_id;

  update public.food_meal_ingredients i
  set quantity_confirmed=r.original_quantity_confirmed
  from pg_temp.food_untracked_restore r
  where i.id=r.ingredient_id;

  return v_result;
end;
$function$
;
