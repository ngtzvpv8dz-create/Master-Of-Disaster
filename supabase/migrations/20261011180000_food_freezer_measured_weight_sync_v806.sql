-- V806: A measured freezer portion is the authoritative allocation for its planned meal.
-- A package shortage additionally reduces the source lot and global stock, but a
-- mere redistribution does NOT reduce stock. One transaction avoids drifting totals.
CREATE OR REPLACE FUNCTION public.correct_food_freezer_portion_weight(
  p_portion_id uuid,
  p_actual_quantity numeric,
  p_adjust_inventory boolean DEFAULT false,
  p_confirm_freezing boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_part public.food_freezer_portions%rowtype;
  v_inv public.food_inventory%rowtype;
  v_lot public.food_inventory_lots%rowtype;
  v_ing public.food_meal_ingredients%rowtype;
  v_meal public.food_meals%rowtype;
  v_delta numeric;
  v_meal_qty numeric;
  v_kcal100 numeric;
  v_protein100 numeric;
  v_base_calories numeric;
  v_portion_calorie_delta numeric;
  v_portion_protein_delta numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
  IF p_actual_quantity IS NULL OR p_actual_quantity<=0 OR p_actual_quantity>100000 THEN
    RAISE EXCEPTION 'Bitte eine positive gewogene Portionsmenge eingeben';
  END IF;
  SELECT * INTO v_part FROM public.food_freezer_portions
   WHERE id=p_portion_id AND user_id=v_user AND status='planned' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Diese Einfrierportion ist nicht mehr zur Bearbeitung offen'; END IF;
  IF v_part.quantity IS NULL OR v_part.quantity<=0 THEN RAISE EXCEPTION 'Ungueltige bisherige Portionsmenge'; END IF;
  v_delta:=p_actual_quantity-v_part.quantity;
  IF lower(coalesce(v_part.unit,'')) NOT IN ('g','kg','ml','l') THEN
    RAISE EXCEPTION 'Automatische Umrechnung fuer diese Einheit noch nicht verfuegbar';
  END IF;
  SELECT * INTO v_inv FROM public.food_inventory
   WHERE id=v_part.inventory_id AND user_id=v_user AND is_active=true FOR UPDATE;
  IF NOT FOUND OR v_inv.quantity IS NULL OR lower(coalesce(v_inv.unit,''))<>lower(v_part.unit) THEN
    RAISE EXCEPTION 'Vorratsmenge und Portion nicht kompatibel';
  END IF;
  SELECT * INTO v_lot FROM public.food_inventory_lots
   WHERE id=v_part.source_lot_id AND user_id=v_user AND inventory_id=v_inv.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quellcharge nicht mehr vorhanden'; END IF;
  IF v_lot.opened_remaining_quantity IS NULL OR lower(coalesce(v_lot.opened_remaining_unit,''))<>lower(v_part.unit) THEN
    RAISE EXCEPTION 'Bitte zuerst den Bestand der angebrochenen Quellcharge erfassen';
  END IF;
  IF v_lot.opened_remaining_quantity<p_actual_quantity THEN
    RAISE EXCEPTION 'Die Quellcharge reicht fuer die gewogene Portion nicht aus';
  END IF;
  IF p_adjust_inventory AND (v_inv.quantity+v_delta<0 OR v_lot.opened_remaining_quantity+v_delta<0) THEN
    RAISE EXCEPTION 'Die physische Mengenkorrektur wuerde einen negativen Vorrat ergeben';
  END IF;

  IF v_part.meal_ingredient_id IS NOT NULL THEN
    SELECT * INTO v_ing FROM public.food_meal_ingredients
      WHERE id=v_part.meal_ingredient_id AND user_id=v_user FOR UPDATE;
    IF NOT FOUND OR v_ing.inventory_id<>v_inv.id OR lower(coalesce(v_ing.unit,''))<>lower(v_part.unit)
      OR v_ing.quantity_confirmed IS DISTINCT FROM true OR v_ing.allocation_override IS NOT NULL THEN
      RAISE EXCEPTION 'Die geplante Zutat laesst sich nicht eindeutig synchronisieren';
    END IF;
    SELECT * INTO v_meal FROM public.food_meals
     WHERE id=v_ing.meal_id AND user_id=v_user FOR UPDATE;
    IF NOT FOUND OR v_meal.status<>'planned' OR v_meal.inventory_booked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Die zugeordnete Mahlzeit wurde bereits gebucht oder veraendert';
    END IF;
    v_meal_qty:=v_ing.quantity+v_delta;
    IF v_meal_qty<=0 THEN RAISE EXCEPTION 'Die geplante Zutat muss positiv bleiben'; END IF;
  END IF;

  SELECT nullif(coalesce(s.nutrition_per_100->>'energy_kcal',s.nutrition_per_100->>'calories_kcal'),'')::numeric,
     nullif(s.nutrition_per_100->>'protein_g','')::numeric
    INTO v_kcal100,v_protein100
    FROM public.shopping_products s WHERE s.id=v_lot.product_id AND s.user_id=v_user LIMIT 1;
  IF v_ing.id IS NOT NULL AND v_delta<>0 THEN
    UPDATE public.food_meal_ingredients SET quantity=v_meal_qty,
      label=trim(trailing '.' from trim(trailing '0' from
         to_char(v_meal_qty,'FM999999999999990.99'))) ||' '||v_ing.unit||' '||coalesce(v_ing.name,'Zutat')
      WHERE id=v_ing.id AND user_id=v_user;
    IF v_kcal100 IS NOT NULL AND v_meal.prepared_servings>0 THEN
      v_portion_calorie_delta:=v_delta*v_kcal100/100/v_meal.prepared_servings;
      v_portion_protein_delta:=v_delta*v_protein100/100/v_meal.prepared_servings;
      SELECT calories_kcal_per_serving INTO v_base_calories
        FROM public.food_recipes WHERE id=v_meal.recipe_id AND user_id=v_user;
      v_base_calories:=coalesce(v_meal.calories_kcal_per_serving_override,v_base_calories);
      UPDATE public.food_meals SET
        calories_kcal_per_serving_override=CASE WHEN v_base_calories IS NOT NULL
          THEN round(v_base_calories+v_portion_calorie_delta,2) ELSE NULL END,
        note=concat_ws(chr(10),note,'TK-Wiegung: '||v_part.quantity::text||' auf '||
          p_actual_quantity::text||' '||v_part.unit||
          '; spezifische Mahlzeit samt kcal/Protein angepasst, Grundrezept unveraendert.'),
        updated_at=now()
      WHERE id=v_meal.id AND user_id=v_user;
    ELSE
      UPDATE public.food_meals SET note=concat_ws(chr(10),note,
        'TK-Wiegung: Zutatenmenge korrigiert, dynamische Naehrwertberechnung erforderlich.'),
        updated_at=now()
      WHERE id=v_meal.id AND user_id=v_user;
    END IF;
  END IF;
  IF p_adjust_inventory AND v_delta<>0 THEN
    UPDATE public.food_inventory_lots SET
      opened_remaining_quantity=opened_remaining_quantity+v_delta,
      note=concat_ws(chr(10),note,'Physische Waagenabweichung bei TK-Aufteilung: '||v_delta::text||' '||v_part.unit),
      updated_at=now() WHERE id=v_lot.id AND user_id=v_user;
    UPDATE public.food_inventory SET quantity=quantity+v_delta,
      quantity_label=(quantity+v_delta)::text||' '||unit,
      updated_at=now() WHERE id=v_inv.id AND user_id=v_user;
    INSERT INTO public.food_inventory_movements
      (user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
    VALUES (v_user,v_inv.id,'adjust',v_delta,v_inv.quantity,v_inv.quantity+v_delta,
      'Wiegung am realen Gebinde, TK-Planmenge '||v_part.quantity::text||
      ' auf '||p_actual_quantity::text||' '||v_part.unit||' korrigiert; keine Mahlzeit gebucht.');
  END IF;
  IF v_delta<>0 THEN
    UPDATE public.food_freezer_portions SET quantity=p_actual_quantity,
      note=concat_ws(chr(10),note,'Tatsaechlich gewogen '||p_actual_quantity::text||
        ' '||v_part.unit||'; vorher geplant '||v_part.quantity::text||
        '; physische Bestandskorrektur: '||CASE WHEN p_adjust_inventory THEN 'ja' ELSE 'nein' END),
      updated_at=now()
    WHERE id=v_part.id AND user_id=v_user;
  END IF;
  IF p_confirm_freezing THEN
    PERFORM public.advance_food_freezer_portion(p_portion_id,'freeze');
  END IF;
  RETURN jsonb_build_object('portion_id',v_part.id,'old_quantity',v_part.quantity,
    'new_quantity',p_actual_quantity,'unit',v_part.unit,'inventory_delta',
    CASE WHEN p_adjust_inventory THEN v_delta ELSE 0 END,
    'inventory_after',v_inv.quantity+CASE WHEN p_adjust_inventory THEN v_delta ELSE 0 END,
    'meal_id',v_meal.id,'meal_ingredient_after',v_meal_qty,
    'kcal_delta_per_serving',v_portion_calorie_delta,
    'protein_delta_per_serving',v_portion_protein_delta,
    'freezing_confirmed',p_confirm_freezing);
END;
$$;
REVOKE ALL ON FUNCTION public.correct_food_freezer_portion_weight(uuid,numeric,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_food_freezer_portion_weight(uuid,numeric,boolean,boolean) TO authenticated;
