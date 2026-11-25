-- REVIEW ONLY, not automatic deployment. Requires verified piece selection UI.
-- Tested with rollback: consume/remove/spoilage, duplicate, stale, wrong piece, invalid reason, reserved, other owner, ambiguous apples.
-- Legacy consume/adjust and extra snack undo paths still need coordinated protection; no activation yet.
CREATE FUNCTION public.food_withdraw_measured_whole_pieces(p_inventory_id uuid,p_piece_ids uuid[],p_expected_quantity numeric,p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE u uuid:=auth.uid(); f public.food_inventory%rowtype; l public.food_inventory_lots%rowtype; selected record; chosen jsonb; result jsonb:='[]'; n int; remaining numeric; after_qty numeric;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('consume','remove','spoilage') THEN RAISE EXCEPTION 'Ungültiger Abgangsgrund'; END IF;
 n:=cardinality(p_piece_ids);
 IF n IS NULL OR n<1 OR array_ndims(p_piece_ids)<>1 OR n<>(SELECT count(DISTINCT x) FROM unnest(p_piece_ids) x) THEN RAISE EXCEPTION 'Eindeutige Stückauswahl erforderlich'; END IF;
 SELECT * INTO f FROM public.food_inventory WHERE id=p_inventory_id AND user_id=u AND is_active AND unit='Stück' AND family_name IN ('Avocado','Apfel') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Geeigneter Vorrat nicht gefunden'; END IF;
 IF f.quantity IS NULL OR f.quantity IS DISTINCT FROM p_expected_quantity OR f.quantity<n THEN RAISE EXCEPTION 'Bestand geändert oder nicht ausreichend'; END IF;
 PERFORM id FROM public.food_inventory_lots WHERE inventory_id=f.id AND user_id=u ORDER BY id FOR UPDATE;
 PERFORM id FROM public.food_inventory_pieces WHERE inventory_id=f.id AND user_id=u ORDER BY id FOR UPDATE;
 SELECT jsonb_agg(to_jsonb(c) ORDER BY c.lot_id,c.piece_index,c.piece_id) INTO chosen FROM public.food_available_measured_whole_pieces(f.id) c WHERE c.piece_id=ANY(p_piece_ids);
 IF coalesce(jsonb_array_length(chosen),0)<>n THEN RAISE EXCEPTION 'Stück oder Charge nicht eindeutig verfügbar'; END IF;
 IF EXISTS (
 SELECT 1 FROM public.food_meal_ingredients i JOIN public.food_meals m ON m.id=i.meal_id AND m.user_id=i.user_id
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.allocation_override)='array' THEN i.allocation_override ELSE '[]'::jsonb END) a
 WHERE i.user_id=u AND m.status='planned' AND m.inventory_booked_at IS NULL AND a->>'piece_id' IN (SELECT x::text FROM unnest(p_piece_ids) x)
 ) THEN RAISE EXCEPTION 'Stück für geplante Mahlzeit reserviert; zuerst Planung korrigieren'; END IF;
 FOR selected IN SELECT * FROM jsonb_to_recordset(chosen) AS c(piece_id uuid,lot_id uuid,product_id uuid,piece_index int,gross_weight_g numeric) LOOP
 SELECT * INTO STRICT l FROM public.food_inventory_lots WHERE id=selected.lot_id AND inventory_id=f.id AND user_id=u FOR UPDATE;
 IF EXISTS (SELECT 1 FROM public.food_freezer_portions x WHERE x.user_id=u AND x.frozen_lot_id=l.id AND x.status IN ('frozen','thawing','thawed')) THEN RAISE EXCEPTION 'Charge hat eine Gefrierreservierung'; END IF;
 IF coalesce(l.opened_remaining_quantity,0)>=1 THEN
 UPDATE public.food_inventory_lots SET opened_remaining_quantity=nullif(opened_remaining_quantity-1,0),opened_remaining_unit=CASE WHEN opened_remaining_quantity=1 THEN NULL ELSE opened_remaining_unit END,opened_packages=CASE WHEN opened_remaining_quantity=1 THEN 0 ELSE opened_packages END,updated_at=now() WHERE id=l.id AND user_id=u;
 ELSIF l.unopened_packages>=1 THEN
 UPDATE public.food_inventory_lots SET unopened_packages=unopened_packages-1,opened_remaining_quantity=nullif(package_quantity-1,0),opened_remaining_unit=CASE WHEN package_quantity=1 THEN NULL ELSE 'Stück' END,opened_packages=CASE WHEN package_quantity=1 THEN 0 ELSE 1 END,updated_at=now() WHERE id=l.id AND user_id=u;
 ELSE RAISE EXCEPTION 'Charge leer'; END IF;
 UPDATE public.food_inventory_pieces SET status='consumed',remaining_weight_g=0,consumed_at=CASE WHEN p_kind='consume' THEN now() ELSE NULL END,updated_at=now(),note=concat_ws(E'\n',note,'Manueller Bestandsabgang: '||p_kind||'; Bruttogewicht '||selected.gross_weight_g||' g. Keine Mahlzeitenbuchung.') WHERE id=selected.piece_id AND user_id=u AND status='whole';
 IF NOT FOUND THEN RAISE EXCEPTION 'Stück nicht verfügbar'; END IF;
 result:=result||jsonb_build_array(to_jsonb(selected));
 END LOOP;
 after_qty:=f.quantity-n;
 UPDATE public.food_inventory SET quantity=after_qty,quantity_label=public.food_inventory_lot_label(id,after_qty,unit),forecast_label=NULL,tone=CASE WHEN after_qty=0 THEN 'empty' ELSE tone END,opened=true,updated_at=now() WHERE id=f.id AND user_id=u;
 SELECT coalesce(sum(coalesce(unopened_packages,0)*package_quantity+coalesce(opened_remaining_quantity,0)),0) INTO remaining FROM public.food_inventory_lots WHERE inventory_id=f.id AND user_id=u AND package_unit='Stück';
 IF remaining<>after_qty OR (SELECT count(*) FROM public.food_available_measured_whole_pieces(f.id))<>after_qty THEN RAISE EXCEPTION 'Stück- und Chargenbestand nach Abgang inkonsistent'; END IF;
 INSERT INTO public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note) VALUES(u,f.id,p_kind,-n,f.quantity,after_qty,'Manueller Stückabgang · '||result::text);
 RETURN jsonb_build_object('inventory_id',f.id,'kind',p_kind,'remaining_pieces',after_qty,'withdrawn_pieces',result);
END $fn$;
REVOKE ALL ON FUNCTION public.food_withdraw_measured_whole_pieces(uuid,uuid[],numeric,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.food_withdraw_measured_whole_pieces(uuid,uuid[],numeric,text) TO authenticated;
COMMENT ON FUNCTION public.food_withdraw_measured_whole_pieces(uuid,uuid[],numeric,text) IS 'Explicit manually selected measured apple/avocado stock withdrawal; not a calorie diary entry. For non-consumption removals the existing consumed status means unavailable; reason preserved in movement and note.';