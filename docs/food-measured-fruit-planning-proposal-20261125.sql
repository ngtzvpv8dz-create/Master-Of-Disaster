-- REVIEW ONLY. Read-only proposal, no actual reservation or plan mutation. Requires transactional reservation before activation.
-- Rollback-tested freshness, ambiguous lots, existing reservations and insufficient counts. Scope apple/avocado only.
CREATE FUNCTION public.food_propose_measured_fruit_pieces(p_inventory_id uuid,p_meal_date date,p_piece_count integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE u uuid:=auth.uid(); v_candidates jsonb; v_total numeric; v_count integer;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
 IF p_meal_date IS NULL OR p_meal_date<(now() AT TIME ZONE 'Europe/Berlin')::date OR p_piece_count IS NULL OR p_piece_count<1 OR p_piece_count>100 THEN RAISE EXCEPTION 'Ungültiger Planungstag oder Stückzahl'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.food_inventory f WHERE f.id=p_inventory_id AND f.user_id=u AND f.is_active AND f.family_name IN ('Apfel','Avocado') AND f.unit='Stück') THEN RAISE EXCEPTION 'Geeigneter Vorrat nicht gefunden'; END IF;
 WITH eligible AS (
 SELECT c.piece_id,c.lot_id,c.product_id,c.piece_index,c.gross_weight_g,l.purchased_on,l.best_before_date,l.opened_remaining_quantity,p.nutrition_per_100,
 row_number() over(order by least(l.purchased_on+2,coalesce(l.best_before_date,l.purchased_on+2)),case when coalesce(l.opened_remaining_quantity,0)>0 then 0 else 1 end,l.purchased_on,c.piece_index,c.piece_id) ord
 FROM public.food_available_measured_whole_pieces(p_inventory_id) c
 JOIN public.food_inventory_lots l ON l.id=c.lot_id AND l.user_id=u AND l.inventory_id=p_inventory_id
 JOIN public.shopping_products p ON p.id=c.product_id AND p.user_id=u AND p.active
 WHERE l.purchased_on IS NOT NULL AND p_meal_date BETWEEN l.purchased_on AND l.purchased_on+2
 AND (l.best_before_date IS NULL OR l.best_before_date>=p_meal_date)
 AND lower(coalesce(l.storage_location,'')) !~ '(gefrier|tiefkühl|freezer|frozen)'
 AND NOT EXISTS(SELECT 1 FROM public.food_freezer_portions x WHERE x.user_id=u AND x.frozen_lot_id=l.id AND x.status IN ('frozen','thawing','thawed'))
 AND NOT EXISTS(
 SELECT 1 FROM public.food_meal_ingredients i JOIN public.food_meals m ON m.id=i.meal_id AND m.user_id=i.user_id
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.allocation_override)='array' THEN i.allocation_override ELSE '[]'::jsonb END) a
 WHERE i.user_id=u AND m.status='planned' AND m.inventory_booked_at IS NULL AND a->>'piece_id'=c.piece_id::text)
 -- A quantity-only planned claim cannot be attributed to a specific fruit.
 AND NOT EXISTS(SELECT 1 FROM public.food_meal_ingredients i JOIN public.food_meals m ON m.id=i.meal_id AND m.user_id=i.user_id JOIN public.food_inventory f ON f.id=p_inventory_id AND f.user_id=u
 WHERE i.user_id=u AND m.status='planned' AND m.inventory_booked_at IS NULL AND i.quantity>0
 AND (i.inventory_id=f.id OR lower(btrim(i.name)) IN (lower(f.name),lower(f.family_name)))
 AND (i.allocation_override IS NULL OR i.allocation_override='[]'::jsonb OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.allocation_override)='array' THEN i.allocation_override ELSE '[]'::jsonb END) a WHERE a->>'inventory_id'=f.id::text AND nullif(a->>'piece_id','') IS NULL)))
 ), picked AS (SELECT * FROM eligible ORDER BY ord LIMIT p_piece_count)
 SELECT coalesce(jsonb_agg(jsonb_build_object('inventory_id',p_inventory_id,'piece_id',piece_id,'lot_id',lot_id,'product_id',product_id,'piece_index',piece_index,'quantity',1,'unit','Stück','gross_weight_g',gross_weight_g,'actual_weight_g',gross_weight_g,'nutrition_per_100',nutrition_per_100,'purchased_on',purchased_on) ORDER BY ord),'[]'::jsonb),coalesce(sum(gross_weight_g),0),count(*) INTO v_candidates,v_total,v_count FROM picked;
 IF v_count<>p_piece_count THEN RETURN jsonb_build_object('status','insufficient_verified_fresh_pieces','requested_pieces',p_piece_count,'available_candidates',v_count,'allocation','[]'::jsonb,'gross_g',NULL); END IF;
 RETURN jsonb_build_object('status','proposal_only','requested_pieces',p_piece_count,'gross_g',v_total,'allocation',v_candidates,'nutrition_weight_basis','gross_conservative');
END $fn$;
REVOKE ALL ON FUNCTION public.food_propose_measured_fruit_pieces(uuid,date,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.food_propose_measured_fruit_pieces(uuid,date,integer) TO authenticated;