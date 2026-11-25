-- REVIEW ONLY: catalog editing with limited owner-scoped column privileges.
-- The imported catalog is canonical. Existing linked legacy preferences are synchronized only on explicit user changes; no blanket overwrite of the imported decisions.
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.record_food_ingredient_taste_feedback(uuid,uuid,text,text)'::regprocedure))<>'32977fb83cc3d36b746b6d71e16c69d1' THEN RAISE EXCEPTION 'Taste feedback source changed';END IF;END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES('record_food_ingredient_taste_feedback_pre_catalog_edit',pg_get_functiondef('public.record_food_ingredient_taste_feedback(uuid,uuid,text,text)'::regprocedure));
GRANT UPDATE(preference,desired_frequency,planning_excluded,whole_unit_policy,updated_at) ON public.food_catalog_ingredients TO authenticated;
GRANT UPDATE(whole_unit_policy) ON public.food_catalog_product_variants TO authenticated;
CREATE POLICY food_catalog_ingredients_update_own ON public.food_catalog_ingredients FOR UPDATE TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY food_catalog_variants_update_own ON public.food_catalog_product_variants FOR UPDATE TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
CREATE FUNCTION public.food_update_catalog_preferences(p_ingredient_id uuid,p_expected_updated_at timestamptz,p_preference text,p_frequency text,p_policy text,p_variant_id uuid DEFAULT NULL,p_expected_variant_policy text DEFAULT NULL,p_variant_policy text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE u uuid:=auth.uid(); c public.food_catalog_ingredients%rowtype; v public.food_catalog_product_variants%rowtype; old_link uuid; freq text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet';END IF;
 IF p_preference IS NULL OR p_preference NOT IN ('Sehr gern','Gern','Ab und zu','Nur wenn es passt','Würde ich probieren','Mag ich nicht','Nie','Noch testen') OR p_frequency IS NULL OR p_frequency NOT IN ('Alle 3–4 Tage','Nicht einplanen','Nur bei passenden Rezepten','Noch offen','Seltener','1× pro Monat','Alle 2 Wochen','Alle 1–2 Tage','1× pro Woche') OR p_policy IS NULL OR p_policy NOT IN ('flexible','prefer_whole_edible','whole_egg_required') THEN RAISE EXCEPTION 'Ungültige Zutatenregel';END IF;
 freq:=CASE WHEN p_preference IN ('Nie','Mag ich nicht') THEN 'Nicht einplanen' WHEN p_preference='Würde ich probieren' AND p_frequency<>'Nicht einplanen' THEN 'Noch offen' ELSE p_frequency END;
 SELECT existing_preference_id INTO old_link FROM public.food_catalog_ingredients WHERE id=p_ingredient_id AND user_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Zutat nicht gefunden';END IF;
 IF old_link IS NOT NULL THEN PERFORM id FROM public.food_ingredient_preferences WHERE id=old_link AND user_id=u FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Verknüpfte Vorliebe nicht eindeutig';END IF;END IF;
 SELECT * INTO c FROM public.food_catalog_ingredients WHERE id=p_ingredient_id AND user_id=u FOR UPDATE;
 IF NOT FOUND OR c.updated_at IS DISTINCT FROM p_expected_updated_at OR c.existing_preference_id IS DISTINCT FROM old_link THEN RAISE EXCEPTION 'Zutat wurde geändert; bitte neu laden';END IF;
 IF p_policy='whole_egg_required' AND lower(c.family_name) !~ '(^ei$|^eier$|hühnerei)' THEN RAISE EXCEPTION 'Ei-Regel nur für Eier';END IF;
 IF p_variant_id IS NOT NULL THEN
  SELECT * INTO v FROM public.food_catalog_product_variants WHERE id=p_variant_id AND user_id=u AND family_name=c.family_name FOR UPDATE;
  IF NOT FOUND OR v.whole_unit_policy IS DISTINCT FROM p_expected_variant_policy OR p_variant_policy IS NULL OR p_variant_policy NOT IN ('flexible','prefer_whole_edible','whole_egg_required') THEN RAISE EXCEPTION 'Variante oder Variantenregel wurde geändert';END IF;
  IF p_variant_policy='whole_egg_required' AND lower(v.family_name) !~ '(^ei$|^eier$|hühnerei)' THEN RAISE EXCEPTION 'Ei-Regel nur für Eier';END IF;
  UPDATE public.food_catalog_product_variants SET whole_unit_policy=p_variant_policy WHERE id=v.id AND user_id=u;
 END IF;
 UPDATE public.food_catalog_ingredients SET preference=p_preference,desired_frequency=freq,planning_excluded=(freq='Nicht einplanen'),whole_unit_policy=p_policy,updated_at=now() WHERE id=c.id AND user_id=u;
 IF old_link IS NOT NULL THEN UPDATE public.food_ingredient_preferences SET preference=p_preference,updated_at=now() WHERE id=old_link AND user_id=u;END IF;
 RETURN jsonb_build_object('ingredient_id',c.id,'preference',p_preference,'desired_frequency',freq,'whole_unit_policy',p_policy,'variant_id',p_variant_id);
END $fn$;
REVOKE ALL ON FUNCTION public.food_update_catalog_preferences(uuid,timestamptz,text,text,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.food_update_catalog_preferences(uuid,timestamptz,text,text,text,uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.record_food_ingredient_taste_feedback(p_preference_id uuid, p_meal_id uuid, p_new_preference text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_pref public.food_ingredient_preferences%rowtype;
  v_note text:=nullif(btrim(coalesce(p_note,'')),'');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
  IF p_new_preference NOT IN('Sehr gern','Gern','Ab und zu','Nur wenn es passt','Mag ich nicht','Nie') THEN
    RAISE EXCEPTION 'Ungültige Zutatenbewertung';
  END IF;
  IF length(coalesce(v_note,''))>500 THEN RAISE EXCEPTION 'Feedback zu lang (maximal 500 Zeichen)'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.food_meals
    WHERE id=p_meal_id AND user_id=v_user AND status='completed') THEN
    RAISE EXCEPTION 'Zutatenfeedback nur nach einer als gegessen bzw. zubereitet bestätigten Mahlzeit';
  END IF;
  SELECT * INTO v_pref FROM public.food_ingredient_preferences
  WHERE id=p_preference_id AND user_id=v_user AND is_current_selection=true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zutat nicht gefunden oder nicht mehr aktuell'; END IF;
  IF v_pref.preference<>'Würde ich probieren' THEN
    RAISE EXCEPTION 'Die Zutat ist bereits bewertet; bitte zuerst die aktuelle Einstufung prüfen';
  END IF;
  IF EXISTS(SELECT 1 FROM public.food_catalog_ingredients c WHERE c.existing_preference_id=v_pref.id AND c.user_id=v_user AND c.preference<>'Würde ich probieren') THEN
    RAISE EXCEPTION 'Die konsolidierte Zutatenbewertung ist bereits festgelegt. Bitte im Zutatenstamm bearbeiten.';
  END IF;
  UPDATE public.food_catalog_ingredients c
     SET preference=p_new_preference,
         desired_frequency=CASE WHEN p_new_preference IN ('Nie','Mag ich nicht') OR c.planning_excluded THEN 'Nicht einplanen' ELSE 'Noch offen' END,
         planning_excluded=(p_new_preference IN ('Nie','Mag ich nicht') OR c.planning_excluded),
         updated_at=now()
   WHERE c.existing_preference_id=v_pref.id AND c.user_id=v_user;
  UPDATE public.food_ingredient_preferences
  SET preference=p_new_preference,
      note=concat_ws(E'\n',nullif(note,''),
        'Tatsächlich probiert am '||to_char((now() AT TIME ZONE 'Europe/Berlin')::date,'DD.MM.YYYY')
        ||': '||p_new_preference||coalesce(' · '||v_note,'')),
      source_date=(now() AT TIME ZONE 'Europe/Berlin')::date,
      updated_at=now()
  WHERE id=v_pref.id AND user_id=v_user;
  INSERT INTO public.food_ingredient_taste_feedback(
    user_id,preference_id,meal_id,previous_preference,chosen_preference,user_note)
  VALUES(v_user,v_pref.id,p_meal_id,v_pref.preference,p_new_preference,v_note);
  RETURN jsonb_build_object('ingredient_id',v_pref.id,'ingredient',v_pref.ingredient_name,
     'previous',v_pref.preference,'current',p_new_preference,'stored',true);
END;
$function$
;
