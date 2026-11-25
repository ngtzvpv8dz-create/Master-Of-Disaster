-- REVIEW CANDIDATE: do not apply until the app's explicit whole-piece selection is integrated and tested.
-- Verified against current v1 using rollback-only tests: selected 151g avocado, wrong weight and missing selection rejected, actual stock restored.
-- Scope: meal completion with individually measured Avocado/Apfel rows. Other paths preserved.
-- Additional rollback tests 2026-11-25 09:29 Europe/Berlin: two whole pieces in one ingredient (151+142 g), same lot and a synthetic second lot; both leave exactly two pieces and capture 293 g, 468.8 kcal gross estimate in the actual candidate nutrition JS. Duplicate selection, consumed piece, wrong lot and wrong product all rejected atomically; original rows and function hash verified unchanged.
-- Open: cross-owner and direct-RPC bypass checks, manual inventory consumption, UI integration, multi-piece gram recipe conversion (current wrapper only converts a single allocation). Do not deploy yet.
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.consume_food_inventory_lots_for_meal(uuid,numeric,text,uuid)'::regprocedure))<>'1c936136680a913bf30def1ebf529b60' THEN RAISE EXCEPTION 'Live source changed; review and retest'; END IF;
END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES('consume_food_inventory_lots_for_meal_pre_verified_pieces',pg_get_functiondef('public.consume_food_inventory_lots_for_meal(uuid,numeric,text,uuid)'::regprocedure));
CREATE OR REPLACE FUNCTION public.consume_food_inventory_lots_for_meal(p_inventory_id uuid, p_quantity numeric, p_unit text, p_ingredient_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE x record; pending numeric:=p_quantity; remainder numeric; extra jsonb:='{}'::jsonb;
  v_owner uuid:=auth.uid(); v_meal_id uuid; v_before jsonb:='[]'::jsonb;
  v_sources jsonb:='[]'::jsonb; v_tracked numeric:=0; v_result jsonb;
  v_unit text:=lower(btrim(coalesce(p_unit,''))); v_expected numeric;
  v_capture boolean:=false;
  v_selected_piece public.food_inventory_pieces%rowtype; v_selected_lot public.food_inventory_lots%rowtype;
  v_piece_alloc jsonb; v_piece_candidate record; v_piece_selection boolean:=false; v_gross numeric;
  v_alloc_count int; v_active_lots int;

BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet';END IF;
 
  IF p_ingredient_id IS NOT NULL AND p_quantity>0 AND v_unit<>'' THEN
    SELECT i.meal_id INTO v_meal_id FROM public.food_meal_ingredients i
      JOIN public.food_meals m ON m.id=i.meal_id AND m.user_id=i.user_id
      WHERE i.id=p_ingredient_id AND i.user_id=v_owner
      AND m.status='planned' AND m.inventory_booked_at IS NULL;
    v_capture:=FOUND;
  END IF;
  IF v_capture THEN
    -- The existing completion routine holds the inventory lock. Use the
    -- same lock before inspecting lots; no FIFO or freezer rules changed.
    PERFORM 1 FROM public.food_inventory WHERE id=p_inventory_id AND user_id=v_owner FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vorratsquelle nicht gefunden'; END IF;
    PERFORM l.id FROM public.food_inventory_lots l
      WHERE l.inventory_id=p_inventory_id AND l.user_id=v_owner ORDER BY l.id FOR UPDATE;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
       'lot_id',l.id,'product_id',l.product_id,
       'quantity',case when lower(coalesce(l.package_unit,''))=v_unit then coalesce(l.unopened_packages,0)*coalesce(l.package_quantity,0) else 0 end
         +case when lower(coalesce(l.opened_remaining_unit,''))=v_unit then coalesce(l.opened_remaining_quantity,0) else 0 end,
       'nutrition_per_100',case when measured.ok then r.nutrition_per_100 else p.nutrition_per_100 end,
       'nutrition_reference_only',case when measured.ok then 'true'::jsonb else coalesce(p.product_data->'nutrition_reference_only','false'::jsonb) end,
       'nutrition_reference_pending_edible_weight',case when measured.ok then 'false'::jsonb else coalesce(p.product_data->'nutrition_reference_pending_edible_weight','false'::jsonb) end,
       'nutrition_reference_source',case when measured.ok then r.source_name else p.product_data->>'nutrition_source' end,
       'nutrition_reference_url',case when measured.ok then r.source_url else p.product_data->>'nutrition_source_url' end,
       'derived_from_lot_id',case when measured.ok then l.batch_data->>'derived_from_lot_id' else null end,
       'product_name',p.product_name,'brand',p.brand,
       'package_unit',p.package_unit,
       'gross_weight_per_piece_g',case when v_unit='stück' AND l.package_unit='Stück' AND l.package_quantity=1
        AND l.unopened_packages+coalesce(l.opened_remaining_quantity,0)=1
        AND l.batch_data->>'weight_kind' IN ('gross_including_peel','gross_including_peel_stone','gross_including_core')
        AND coalesce(l.batch_data->>'reported_weight_gross_g','') ~ '^[0-9]+([.][0-9]+)?$'
        AND p.product_data->>'nutrition_weight_basis'='gross_conservative'
        THEN (l.batch_data->>'reported_weight_gross_g')::numeric ELSE NULL END,
       'nutrition_weight_basis',p.product_data->>'nutrition_weight_basis',
       'product_variant',p.variant,
       'lot_purchased_on',l.purchased_on
      ) ORDER BY l.id),'[]'::jsonb) INTO v_before
      FROM public.food_inventory_lots l
      LEFT JOIN public.shopping_products p ON p.id=l.product_id AND p.user_id=v_owner
      LEFT JOIN public.food_standard_nutrition_references r ON r.family_key=p.product_data->>'nutrition_reference_family_key'
       AND lower(r.eligible_product_name)=lower(p.product_name)
      CROSS JOIN LATERAL (SELECT coalesce(v_unit='g' AND lower(l.package_unit)='g' AND l.batch_data->>'weight_kind'='measured_edible'
       AND l.batch_data->>'derived_from_lot_id' IS NOT NULL AND r.nutrition_per_100 IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.food_inventory_lots origin WHERE origin.id::text=l.batch_data->>'derived_from_lot_id' AND origin.user_id=v_owner AND origin.product_id=l.product_id AND origin.batch_data->>'converted_edible_lot_id'=l.id::text),false) AS ok) measured
      WHERE l.inventory_id=p_inventory_id AND l.user_id=v_owner;
  END IF;
  -- For explicitly selected, individually weighed apples and avocados,
  -- book precisely that physical piece and its lot, not an unrelated FIFO lot.
  IF v_capture AND v_unit='stück' AND EXISTS (
    SELECT 1 FROM public.food_inventory f
    WHERE f.id=p_inventory_id AND f.user_id=v_owner AND f.family_name IN ('Avocado','Apfel')
  ) AND EXISTS (
    SELECT 1 FROM public.food_inventory_pieces p JOIN public.food_inventory_lots l ON l.id=p.lot_id AND l.user_id=p.user_id AND l.inventory_id=p.inventory_id
    WHERE p.user_id=v_owner AND p.inventory_id=p_inventory_id AND (l.unopened_packages>0 OR coalesce(l.opened_remaining_quantity,0)>0)
  ) THEN
    -- Each call in the core processes one explicit allocation. Until the
    -- planning UI supplies IDs, refuse an ambiguous selection rather than
    -- silently consuming a different fruit.
    PERFORM p.id FROM public.food_inventory_pieces p WHERE p.user_id=v_owner AND p.inventory_id=p_inventory_id ORDER BY p.id FOR UPDATE;
    SELECT count(*) INTO v_alloc_count
    FROM public.food_meal_ingredients i CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.allocation_override)='array' THEN i.allocation_override ELSE '[]'::jsonb END) a
    WHERE i.id=p_ingredient_id AND i.user_id=v_owner AND a->>'inventory_id'=p_inventory_id::text;
    IF p_quantity<>1 OR v_alloc_count<1 THEN RAISE EXCEPTION 'Bitte eine eindeutig gewogene ganze Frucht je Zutatenaufteilung auswählen'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.food_meal_ingredients i CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.allocation_override)='array' THEN i.allocation_override ELSE '[]'::jsonb END) a
      WHERE i.id=p_ingredient_id AND i.user_id=v_owner AND a->>'inventory_id'=p_inventory_id::text
        AND (nullif(a->>'piece_id','') IS NULL OR a->>'unit' IS DISTINCT FROM 'Stück' OR a->>'quantity' IS DISTINCT FROM '1')
    ) THEN RAISE EXCEPTION 'Jede ausgewählte Frucht muss eine eindeutige Stück-ID haben'; END IF;
    IF (SELECT count(distinct a->>'piece_id') FROM public.food_meal_ingredients i CROSS JOIN LATERAL jsonb_array_elements(i.allocation_override) a WHERE i.id=p_ingredient_id AND i.user_id=v_owner AND a->>'inventory_id'=p_inventory_id::text)<>v_alloc_count THEN RAISE EXCEPTION 'Doppelte Stückauswahl'; END IF;
    SELECT a.item INTO v_piece_alloc
    FROM public.food_meal_ingredients i CROSS JOIN LATERAL jsonb_array_elements(i.allocation_override) WITH ORDINALITY a(item,ord)
    WHERE i.id=p_ingredient_id AND i.user_id=v_owner AND a.item->>'inventory_id'=p_inventory_id::text
      AND NOT EXISTS (SELECT 1 FROM public.food_meal_consumption_evidence e CROSS JOIN LATERAL jsonb_array_elements(e.lot_sources) ls WHERE e.user_id=v_owner AND e.meal_id=v_meal_id AND e.ingredient_id=p_ingredient_id AND e.inventory_id=p_inventory_id AND ls->>'piece_id'=a.item->>'piece_id')
    ORDER BY a.ord LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Keine weitere eindeutig gewählte Frucht verfügbar'; END IF;
    SELECT * INTO v_piece_candidate FROM public.food_available_measured_whole_pieces(p_inventory_id) c WHERE c.piece_id::text=v_piece_alloc->>'piece_id' AND c.lot_id::text=v_piece_alloc->>'lot_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'Stückbestand oder Chargenzuordnung unklar; gewählte Frucht nicht buchbar'; END IF;
    IF v_piece_alloc ? 'product_id' AND v_piece_alloc->>'product_id' IS DISTINCT FROM v_piece_candidate.product_id::text THEN RAISE EXCEPTION 'Stück und Handelsartikel widersprechen sich'; END IF;
    v_gross:=v_piece_candidate.gross_weight_g;
    IF (v_piece_alloc ? 'actual_weight_g' AND (v_piece_alloc->>'actual_weight_g')::numeric IS DISTINCT FROM v_gross)
      OR (v_piece_alloc ? 'gross_weight_g' AND (v_piece_alloc->>'gross_weight_g')::numeric IS DISTINCT FROM v_gross)
      OR (v_piece_alloc ? 'piece_weight_g' AND (v_piece_alloc->>'piece_weight_g')::numeric IS DISTINCT FROM v_gross)
    THEN RAISE EXCEPTION 'Geplantes Bruttogewicht und gewählte Frucht widersprechen sich'; END IF;
    SELECT * INTO STRICT v_selected_piece FROM public.food_inventory_pieces WHERE id=v_piece_candidate.piece_id AND user_id=v_owner AND inventory_id=p_inventory_id FOR UPDATE;
    SELECT * INTO STRICT v_selected_lot FROM public.food_inventory_lots WHERE id=v_piece_candidate.lot_id AND user_id=v_owner AND inventory_id=p_inventory_id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.food_freezer_portions f WHERE f.user_id=v_owner AND f.frozen_lot_id=v_selected_lot.id AND f.status IN ('frozen','thawing','thawed')) THEN RAISE EXCEPTION 'Charge hat eine Gefrierreservierung'; END IF;
    IF coalesce(v_selected_lot.opened_remaining_quantity,0)>=1 THEN
      UPDATE public.food_inventory_lots SET opened_remaining_quantity=nullif(opened_remaining_quantity-1,0),
        opened_remaining_unit=CASE WHEN opened_remaining_quantity=1 THEN NULL ELSE opened_remaining_unit END,
        opened_packages=CASE WHEN opened_remaining_quantity=1 THEN 0 ELSE opened_packages END,updated_at=now()
      WHERE id=v_selected_lot.id AND user_id=v_owner;
    ELSIF v_selected_lot.unopened_packages>=1 THEN
      UPDATE public.food_inventory_lots SET unopened_packages=unopened_packages-1,
        opened_remaining_quantity=nullif(package_quantity-1,0),
        opened_remaining_unit=CASE WHEN package_quantity=1 THEN NULL ELSE 'Stück' END,
        opened_packages=CASE WHEN package_quantity=1 THEN 0 ELSE 1 END,updated_at=now()
      WHERE id=v_selected_lot.id AND user_id=v_owner;
    ELSE RAISE EXCEPTION 'Ausgewählte Charge ist leer'; END IF;
    v_piece_selection:=true;
    v_result:=jsonb_build_object('tracked_consumed',1,'untracked_consumed',0);
  ELSIF p_ingredient_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.food_freezer_portions WHERE user_id=auth.uid() AND inventory_id=p_inventory_id AND meal_ingredient_id=p_ingredient_id AND status IN ('frozen','thawing','thawed')) THEN
    v_result:=public.consume_food_inventory_lots(p_inventory_id,p_quantity,p_unit);
  ELSE
 FOR x IN SELECT f.id AS task_id,f.quantity,f.status,l.id AS lot_id,
   l.opened_remaining_quantity AS open_qty,l.unopened_packages AS packs,l.package_quantity AS pack_qty,
   l.opened_remaining_unit AS open_unit,l.package_unit AS pack_unit
 FROM public.food_freezer_portions f JOIN public.food_inventory_lots l ON l.id=f.frozen_lot_id
 WHERE f.user_id=auth.uid() AND f.meal_ingredient_id=p_ingredient_id AND f.inventory_id=p_inventory_id
 AND f.status IN ('frozen','thawing','thawed') ORDER BY f.id FOR UPDATE OF f,l LOOP
   IF x.status='frozen' THEN RAISE EXCEPTION 'Zugeordnetes TK-Stück liegt noch im Tiefkühler';END IF;
   IF x.open_qty>=x.quantity AND lower(x.open_unit)=lower(p_unit) THEN
     remainder:=x.open_qty-x.quantity;
     IF remainder=0 AND x.packs=0 THEN UPDATE public.food_inventory_lots
          SET unopened_packages=0,
              opened_packages=0,
              opened_remaining_quantity=NULL,
              opened_remaining_unit=NULL,
              updated_at=now()
          WHERE id=x.lot_id;
     ELSE UPDATE public.food_inventory_lots SET
       opened_remaining_quantity=CASE WHEN remainder=0 THEN NULL ELSE remainder END,
       opened_remaining_unit=CASE WHEN remainder=0 THEN NULL ELSE p_unit END,
       opened_packages=CASE WHEN remainder=0 THEN 0 ELSE 1 END,updated_at=now() WHERE id=x.lot_id; END IF;
   ELSIF x.packs=1 AND x.pack_qty=x.quantity AND lower(x.pack_unit)=lower(p_unit) THEN
     UPDATE public.food_inventory_lots
          SET unopened_packages=0,
              opened_packages=0,
              opened_remaining_quantity=NULL,
              opened_remaining_unit=NULL,
              updated_at=now()
          WHERE id=x.lot_id;
   ELSE RAISE EXCEPTION 'Physische Portion und Charge passen nicht überein: %',x.task_id;
   END IF;
   UPDATE public.food_freezer_portions SET origin_lot_snapshot=origin_lot_snapshot||
     jsonb_build_object('consumed_ingredient_id',p_ingredient_id,'consumed_g',x.quantity,'consumed_at',now()),
     updated_at=now() WHERE id=x.task_id;
   pending:=pending-x.quantity;
 END LOOP;
 IF pending<-.000001 THEN RAISE EXCEPTION 'Mehr Teilstücke verknüpft als Rezeptmenge';END IF;
 IF pending>.000001 THEN extra:=public.consume_food_inventory_lots(p_inventory_id,pending,p_unit);END IF;
 
  v_result:=jsonb_build_object('linked_consumed',p_quantity-pending,'other',extra);
  END IF;
  IF v_capture THEN
    WITH previous AS (
      SELECT b.value AS item,(b.value->>'quantity')::numeric AS before_qty
      FROM jsonb_array_elements(v_before) b
    ), diffs AS (
      SELECT b.item,b.before_qty-coalesce(
        case when lower(coalesce(l.package_unit,''))=v_unit then coalesce(l.unopened_packages,0)*coalesce(l.package_quantity,0) else 0 end+
        case when lower(coalesce(l.opened_remaining_unit,''))=v_unit then coalesce(l.opened_remaining_quantity,0) else 0 end,0) AS used
      FROM previous b LEFT JOIN public.food_inventory_lots l
        ON l.id::text=b.item->>'lot_id' AND l.user_id=v_owner AND l.inventory_id=p_inventory_id
    )
    SELECT coalesce(sum(used),0),coalesce(jsonb_agg(
      (item-'quantity')||jsonb_build_object('quantity',used,'unit',p_unit,
       'resolution',case when item->>'product_id' is null or item->>'product_name' is null then 'missing_product'
        when item->'nutrition_per_100' is null or item->'nutrition_per_100' in ('null'::jsonb,'{}'::jsonb) then 'missing_nutrition'
        when item->'nutrition_reference_pending_edible_weight'='true'::jsonb then 'edible_weight_required'
        else 'profile_captured' end)
      ORDER BY item->>'lot_id'),'[]'::jsonb)
    INTO v_tracked,v_sources FROM diffs WHERE used>0;
    IF v_tracked>p_quantity+0.000001 THEN
      -- Do not change legacy booking behaviour; explicitly identify a
      -- discrepancy rather than report a verified nutrition assignment.
      v_sources:=v_sources||jsonb_build_array(jsonb_build_object('resolution','quantity_mismatch','quantity',v_tracked-p_quantity,'unit',p_unit));
    ELSIF p_quantity-v_tracked>0.000001 THEN
      v_sources:=v_sources||jsonb_build_array(jsonb_build_object('resolution','untracked_stock','quantity',p_quantity-v_tracked,'unit',p_unit));
    END IF;
    IF v_piece_selection THEN
      IF v_tracked<>1 OR jsonb_array_length(v_sources)<>1 OR v_sources->0->>'lot_id' IS DISTINCT FROM v_selected_lot.id::text THEN RAISE EXCEPTION 'Stückentnahme und tatsächliche Charge widersprechen sich'; END IF;
      UPDATE public.food_inventory_pieces SET status='consumed',remaining_weight_g=0,consumed_at=now(),updated_at=now(),
        note=concat_ws(E'\n',note,'Ganze Frucht mit ursprünglichem Bruttogewicht verbucht. [meal:'||v_meal_id::text||']')
      WHERE id=v_selected_piece.id AND user_id=v_owner AND status='whole';
      IF NOT FOUND THEN RAISE EXCEPTION 'Gewählte Frucht ist nicht mehr verfügbar'; END IF;
      v_sources:=jsonb_build_array((v_sources->0)||jsonb_build_object('piece_id',v_selected_piece.id,'piece_index',v_selected_piece.piece_index,'gross_weight_per_piece_g',v_gross,'nutrition_weight_basis','gross_conservative'));
    END IF;
    INSERT INTO public.food_meal_consumption_evidence(user_id,meal_id,ingredient_id,inventory_id,stock_quantity,stock_unit,tracked_quantity,lot_sources)
      VALUES(v_owner,v_meal_id,p_ingredient_id,p_inventory_id,p_quantity,p_unit,v_tracked,v_sources);
  END IF;
  RETURN v_result;
END $function$
;
