-- REVIEW ONLY. Requires measured-fruit availability, exact withdrawal and legacy guards.
-- Exact piece and nutrition evidence; corrections must undo then rebook.
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.undo_food_planned_extra_v1(uuid)'::regprocedure))<>'4e17eba5f54fb002f207ae567320beab' THEN RAISE EXCEPTION 'Extra undo source changed';END IF;END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES('undo_food_planned_extra_pre_measured_fruit',pg_get_functiondef('public.undo_food_planned_extra_v1(uuid)'::regprocedure));
ALTER TABLE public.food_extra_consumptions ADD COLUMN measured_piece_selection jsonb, ADD COLUMN measured_piece_evidence jsonb;
CREATE FUNCTION public.food_measured_extra_piece_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE u uuid:=auth.uid(); v_inv public.food_inventory%rowtype; v_lot public.food_inventory_lots%rowtype; v_piece public.food_inventory_pieces%rowtype; v_plan public.food_planned_extras%rowtype; rec record; grp record; ids uuid[]; r jsonb; evidence jsonb:='[]'; snapshots jsonb; profile jsonb; gross numeric:=0; kcal numeric:=0; protein numeric:=0; carbs numeric:=0; fat numeric:=0; v_sugar numeric:=0; v_salt numeric:=0; n int; v_after numeric; plan_ref uuid; product_ids uuid[]; expected numeric; basis text; pack_before jsonb; pack_after jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.measured_piece_selection IS NOT NULL OR NEW.measured_piece_selection IS NOT NULL OR NEW.measured_piece_evidence IS DISTINCT FROM OLD.measured_piece_evidence THEN RAISE EXCEPTION 'Gewogenen Zusatzsnack zuerst exakt zurückbuchen, dann neu auswählen';END IF;
  RETURN NEW;
 ELSIF TG_OP='DELETE' THEN
  IF OLD.measured_piece_selection IS NULL THEN RETURN OLD;END IF;
  IF u IS NULL OR OLD.user_id<>u OR jsonb_typeof(OLD.measured_piece_evidence->'pieces') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Stücknachweis fehlt';END IF;
  SELECT * INTO v_inv FROM public.food_inventory WHERE id=(OLD.measured_piece_selection->>'inventory_id')::uuid AND user_id=u AND is_active AND unit='Stück' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ursprünglicher Stückvorrat fehlt';END IF;
  PERFORM id FROM public.food_inventory_lots WHERE inventory_id=v_inv.id AND user_id=u ORDER BY id FOR UPDATE;
  PERFORM id FROM public.food_inventory_pieces WHERE inventory_id=v_inv.id AND user_id=u ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.food_available_measured_whole_pieces(v_inv.id))<>v_inv.quantity OR (SELECT coalesce(sum(coalesce(unopened_packages,0)*package_quantity+coalesce(opened_remaining_quantity,0)),0) FROM public.food_inventory_lots WHERE inventory_id=v_inv.id AND user_id=u AND package_unit='Stück')<>v_inv.quantity THEN RAISE EXCEPTION 'Bestand vor Rückbuchung unklar';END IF;
  SELECT count(*),array_agg((x->>'piece_id')::uuid) INTO n,ids FROM jsonb_array_elements(OLD.measured_piece_evidence->'pieces') x;
  IF n<1 OR n<>(SELECT count(distinct z) FROM unnest(ids) z) THEN RAISE EXCEPTION 'Mehrdeutiger Rückbuchungsnachweis';END IF;
  FOR rec IN SELECT * FROM jsonb_to_recordset(OLD.measured_piece_evidence->'pieces') AS x(piece_id uuid,lot_id uuid,product_id uuid,gross_weight_g numeric) LOOP
   SELECT * INTO v_piece FROM public.food_inventory_pieces WHERE id=rec.piece_id AND user_id=u AND inventory_id=v_inv.id AND lot_id=rec.lot_id FOR UPDATE;
   IF NOT FOUND OR v_piece.status<>'consumed' OR v_piece.remaining_weight_g<>0 OR v_piece.weight_g IS DISTINCT FROM rec.gross_weight_g OR v_piece.consumed_at IS DISTINCT FROM OLD.consumed_at THEN RAISE EXCEPTION 'Stückzustand seit Snackbuchung geändert';END IF;
   SELECT * INTO v_lot FROM public.food_inventory_lots WHERE id=rec.lot_id AND user_id=u AND inventory_id=v_inv.id AND product_id=rec.product_id AND package_unit='Stück' FOR UPDATE;
   IF NOT FOUND OR v_lot.package_quantity<1 OR v_lot.package_quantity<>trunc(v_lot.package_quantity) OR EXISTS(SELECT 1 FROM public.food_freezer_portions x WHERE x.user_id=u AND x.frozen_lot_id=v_lot.id AND x.status IN ('frozen','thawing','thawed')) THEN RAISE EXCEPTION 'Originalcharge nicht mehr eindeutig rückbuchbar';END IF;
  END LOOP;
  FOR grp IN SELECT (x->>'lot_id')::uuid lot_id,count(*) n FROM jsonb_array_elements(OLD.measured_piece_evidence->'pieces') x GROUP BY 1 LOOP
   SELECT * INTO STRICT v_lot FROM public.food_inventory_lots WHERE id=grp.lot_id AND user_id=u FOR UPDATE;
   SELECT x->'before',x->'after' INTO pack_before,pack_after FROM jsonb_array_elements(OLD.measured_piece_evidence->'lots') x WHERE x->>'lot_id'=v_lot.id::text;
   IF pack_after=jsonb_build_array(v_lot.unopened_packages,v_lot.opened_packages,v_lot.opened_remaining_quantity,v_lot.opened_remaining_unit,v_lot.package_quantity) THEN
    UPDATE public.food_inventory_lots SET unopened_packages=(pack_before->>0)::integer,opened_packages=(pack_before->>1)::integer,opened_remaining_quantity=(pack_before->>2)::numeric,opened_remaining_unit=pack_before->>3,updated_at=now() WHERE id=v_lot.id AND user_id=u;
   ELSE
    UPDATE public.food_inventory_lots SET opened_remaining_quantity=coalesce(opened_remaining_quantity,0)+grp.n,opened_remaining_unit='Stück',opened_packages=greatest(coalesce(opened_packages,0),ceil((coalesce(opened_remaining_quantity,0)+grp.n)/package_quantity)::integer),updated_at=now() WHERE id=v_lot.id AND user_id=u;
   END IF;
  END LOOP;
  UPDATE public.food_inventory_pieces SET status='whole',remaining_weight_g=weight_g,consumed_at=NULL,updated_at=now(),note=concat_ws(E'\n',note,'Exakte Rückbuchung Zusatzsnack '||OLD.id::text) WHERE id=ANY(ids) AND user_id=u AND inventory_id=v_inv.id;
  v_after:=v_inv.quantity+n;
  UPDATE public.food_inventory SET quantity=v_after,quantity_label=public.food_inventory_lot_label(id,v_after,unit),forecast_label=NULL,tone=CASE WHEN tone='empty' THEN 'fresh' ELSE tone END,updated_at=now() WHERE id=v_inv.id AND user_id=u;
  IF (SELECT count(*) FROM public.food_available_measured_whole_pieces(v_inv.id))<>v_after THEN RAISE EXCEPTION 'Stückbestand nach Rückbuchung inkonsistent';END IF;
  INSERT INTO public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note) VALUES(u,v_inv.id,'add',n,v_inv.quantity,v_after,'Exakte Rückbuchung Zusatzsnack '||OLD.id::text);
  IF OLD.source_reference LIKE 'food-planned-extra-v1-%' THEN
   UPDATE public.food_planned_extras SET status='planned',confirmed_extra_id=NULL,updated_at=now() WHERE id=substring(OLD.source_reference from length('food-planned-extra-v1-')+1)::uuid AND user_id=u AND confirmed_extra_id=OLD.id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Geplanter Zusatzsnack nicht eindeutig verknüpft';END IF;
  END IF;
  RETURN OLD;
 END IF;
 IF NEW.measured_piece_selection IS NULL THEN
  IF NEW.measured_piece_evidence IS NOT NULL OR NEW.source_reference LIKE 'food-measured-fruit-extra-v1-%' THEN RAISE EXCEPTION 'Stückauswahl fehlt';END IF;
  RETURN NEW;
 END IF;
 IF u IS NULL OR NEW.user_id<>u OR NEW.measured_piece_evidence IS NOT NULL OR NEW.consumption_date IS NULL OR NEW.consumption_date>(now() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Ungültige Snackbuchung';END IF;
 IF jsonb_typeof(NEW.measured_piece_selection->'piece_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Stückauswahl fehlt';END IF;
 SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(NEW.measured_piece_selection->'piece_ids') x(value);
 n:=cardinality(ids);expected:=(NEW.measured_piece_selection->>'expected_quantity')::numeric;
 IF n IS NULL OR n<1 OR n>100 OR n<>(SELECT count(distinct z) FROM unnest(ids) z) THEN RAISE EXCEPTION 'Eindeutige Stückauswahl erforderlich';END IF;
 IF NEW.source_reference LIKE 'food-planned-extra-v1-%' THEN
  plan_ref:=substring(NEW.source_reference from length('food-planned-extra-v1-')+1)::uuid;
  SELECT * INTO v_plan FROM public.food_planned_extras WHERE id=plan_ref AND user_id=u AND status='planned' FOR UPDATE;
  IF NOT FOUND OR v_plan.plan_date IS DISTINCT FROM NEW.consumption_date OR v_plan.inventory_id IS DISTINCT FROM (NEW.measured_piece_selection->>'inventory_id')::uuid OR v_plan.unit NOT IN ('Stück','g') OR (v_plan.unit='Stück' AND v_plan.quantity<>n) THEN RAISE EXCEPTION 'Geplanter Snack wurde geändert';END IF;
 ELSIF NEW.source_reference IS DISTINCT FROM 'food-measured-fruit-extra-v1-'||NEW.id::text THEN RAISE EXCEPTION 'Snackreferenz ungültig';END IF;
 SELECT * INTO v_inv FROM public.food_inventory WHERE id=(NEW.measured_piece_selection->>'inventory_id')::uuid AND user_id=u AND is_active AND unit='Stück' FOR UPDATE;
 IF NOT FOUND OR v_inv.quantity IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Stückbestand geändert';END IF;
 PERFORM id FROM public.food_inventory_lots WHERE inventory_id=v_inv.id AND user_id=u ORDER BY id FOR UPDATE;
 PERFORM id FROM public.food_inventory_pieces WHERE inventory_id=v_inv.id AND user_id=u ORDER BY id FOR UPDATE;
 SELECT jsonb_agg(jsonb_build_object('lot_id',lo.id,'before',jsonb_build_array(lo.unopened_packages,lo.opened_packages,lo.opened_remaining_quantity,lo.opened_remaining_unit,lo.package_quantity))) INTO snapshots
 FROM public.food_inventory_lots lo WHERE lo.inventory_id=v_inv.id AND lo.user_id=u AND EXISTS(SELECT 1 FROM public.food_inventory_pieces pp WHERE pp.lot_id=lo.id AND pp.id=ANY(ids) AND pp.user_id=u);
 FOR rec IN SELECT c.*,sp.nutrition_per_100,lo.purchased_on FROM public.food_available_measured_whole_pieces(v_inv.id) c JOIN public.shopping_products sp ON sp.id=c.product_id AND sp.user_id=u JOIN public.food_inventory_lots lo ON lo.id=c.lot_id AND lo.user_id=u WHERE c.piece_id=ANY(ids) ORDER BY c.lot_id,c.piece_index LOOP
  IF rec.purchased_on IS NULL OR rec.purchased_on>NEW.consumption_date OR (NEW.product_id IS NOT NULL AND rec.product_id<>NEW.product_id) OR (plan_ref IS NOT NULL AND v_plan.product_id IS NOT NULL AND rec.product_id<>v_plan.product_id) THEN RAISE EXCEPTION 'Stück passt nicht zum Snackdatum oder gewählten Produkt';END IF;
  profile:=rec.nutrition_per_100;basis:=coalesce(profile->>'basis','');
  IF basis NOT IN ('','per_100_g','per_100g','100_g','100g','per_100_g_reference','per_100_g_raw_edible_reference') OR jsonb_typeof(coalesce(profile->'energy_kcal',profile->'calories_kcal')) IS DISTINCT FROM 'number' OR jsonb_typeof(profile->'protein_g') IS DISTINCT FROM 'number' OR jsonb_typeof(profile->'carbohydrates_g') IS DISTINCT FROM 'number' OR jsonb_typeof(profile->'fat_g') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Vollständige Nährwerte je 100 g des ausgewählten Stückprodukts fehlen';END IF;
  gross:=gross+rec.gross_weight_g;
  kcal:=kcal+coalesce(profile->>'energy_kcal',profile->>'calories_kcal')::numeric*rec.gross_weight_g/100;
  protein:=protein+(profile->>'protein_g')::numeric*rec.gross_weight_g/100;
  carbs:=carbs+(profile->>'carbohydrates_g')::numeric*rec.gross_weight_g/100;
  fat:=fat+(profile->>'fat_g')::numeric*rec.gross_weight_g/100;
  v_sugar:=CASE WHEN jsonb_typeof(profile->'sugars_g')='number' THEN v_sugar+(profile->>'sugars_g')::numeric*rec.gross_weight_g/100 ELSE NULL END;
  v_salt:=CASE WHEN jsonb_typeof(profile->'salt_g')='number' THEN v_salt+(profile->>'salt_g')::numeric*rec.gross_weight_g/100 ELSE NULL END;
  evidence:=evidence||jsonb_build_array(jsonb_build_object('piece_id',rec.piece_id,'lot_id',rec.lot_id,'product_id',rec.product_id,'gross_weight_g',rec.gross_weight_g,'nutrition_per_100',profile,'nutrition_weight_basis','gross_conservative'));
 END LOOP;
 IF jsonb_array_length(evidence)<>n OR gross<=0 OR least(kcal,protein,carbs,fat)<0 THEN RAISE EXCEPTION 'Stück- oder Nährwertnachweis unvollständig';END IF;
 r:=public.food_withdraw_measured_whole_pieces(v_inv.id,ids,expected,'consume');
 IF jsonb_array_length(r->'withdrawn_pieces')<>n THEN RAISE EXCEPTION 'Stückabgang nicht bestätigt';END IF;
 SELECT jsonb_agg(x||jsonb_build_object('after',jsonb_build_array(lo.unopened_packages,lo.opened_packages,lo.opened_remaining_quantity,lo.opened_remaining_unit,lo.package_quantity))) INTO snapshots FROM jsonb_array_elements(snapshots) x JOIN public.food_inventory_lots lo ON lo.id::text=x->>'lot_id' AND lo.user_id=u;
 SELECT array_agg(distinct (x->>'product_id')::uuid) INTO product_ids FROM jsonb_array_elements(evidence) x;
 NEW.product_id:=CASE WHEN cardinality(product_ids)=1 THEN product_ids[1] ELSE NULL END;
 NEW.title:=CASE WHEN plan_ref IS NOT NULL THEN v_plan.title ELSE v_inv.name END;
 NEW.kind:='snack';NEW.quantity:=gross;NEW.unit:='g';NEW.consumed_at:=now();
 NEW.calories_kcal:=round(kcal,3);NEW.protein_g:=round(protein,3);NEW.carbohydrates_g:=round(carbs,3);NEW.fat_g:=round(fat,3);NEW.sugars_g:=round(v_sugar,3);NEW.salt_g:=round(v_salt,3);NEW.caffeine_mg:=NULL;
 NEW.nutrition_source:='Gewogene Einzelstücke: konservative Bruttoberechnung inkl. Schale/Kern; chargengenauer Nährwert-Snapshot';
 NEW.measured_piece_evidence:=jsonb_build_object('pieces',evidence,'lots',snapshots,'gross_g',gross);
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.food_measured_extra_piece_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER food_extra_measured_piece_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.food_extra_consumptions FOR EACH ROW EXECUTE FUNCTION public.food_measured_extra_piece_guard();
CREATE FUNCTION public.food_measured_extra_confirm_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
 IF NEW.measured_piece_selection IS NOT NULL AND NEW.source_reference LIKE 'food-planned-extra-v1-%' THEN
  UPDATE public.food_planned_extras SET status='confirmed',confirmed_extra_id=NEW.id,quantity=CASE WHEN unit='g' THEN NEW.quantity ELSE quantity END,calories_kcal=NEW.calories_kcal,protein_g=NEW.protein_g,carbohydrates_g=NEW.carbohydrates_g,fat_g=NEW.fat_g,caffeine_mg=NEW.caffeine_mg,updated_at=now() WHERE id=substring(NEW.source_reference from length('food-planned-extra-v1-')+1)::uuid AND user_id=NEW.user_id AND user_id=auth.uid() AND status='planned';
  IF NOT FOUND THEN RAISE EXCEPTION 'Geplanter Snack konnte nicht bestätigt werden';END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.food_measured_extra_confirm_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER food_extra_measured_confirm_plan_trg AFTER INSERT ON public.food_extra_consumptions FOR EACH ROW EXECUTE FUNCTION public.food_measured_extra_confirm_plan();
CREATE FUNCTION public.food_record_measured_fruit_extra(p_inventory_id uuid,p_piece_ids uuid[],p_expected_quantity numeric,p_day date,p_request_id uuid,p_product_id uuid DEFAULT NULL,p_plan_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE u uuid:=auth.uid(); existing public.food_extra_consumptions%rowtype; sel jsonb; ref text; out_id uuid;
BEGIN
 IF u IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Anmeldung und eindeutige Anfrage erforderlich';END IF;
 ref:=CASE WHEN p_plan_id IS NULL THEN 'food-measured-fruit-extra-v1-'||p_request_id::text ELSE 'food-planned-extra-v1-'||p_plan_id::text END;
 sel:=jsonb_build_object('inventory_id',p_inventory_id,'piece_ids',to_jsonb(p_piece_ids),'expected_quantity',p_expected_quantity);
 SELECT * INTO existing FROM public.food_extra_consumptions WHERE id=p_request_id AND user_id=u;
 IF FOUND THEN IF existing.measured_piece_selection IS DISTINCT FROM sel OR existing.source_reference IS DISTINCT FROM ref OR existing.consumption_date IS DISTINCT FROM p_day OR (p_product_id IS NOT NULL AND existing.product_id IS DISTINCT FROM p_product_id) THEN RAISE EXCEPTION 'Anfrage-ID bereits anders verwendet';END IF;RETURN existing.id;END IF;
 INSERT INTO public.food_extra_consumptions(id,user_id,consumption_date,product_id,title,kind,quantity,unit,source_reference,measured_piece_selection) VALUES(p_request_id,u,p_day,p_product_id,'Gewogene Frucht','snack',1,'Stück',ref,sel) RETURNING id INTO out_id;
 RETURN out_id;
END $fn$;
REVOKE ALL ON FUNCTION public.food_record_measured_fruit_extra(uuid,uuid[],numeric,date,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.food_record_measured_fruit_extra(uuid,uuid[],numeric,date,uuid,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.undo_food_planned_extra_v1(p_plan_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_user uuid:=auth.uid();
 v_plan public.food_planned_extras%rowtype;
 v_inv public.food_inventory%rowtype;
begin
 if v_user is null then raise exception 'Bitte anmelden'; end if;
 select * into v_plan from public.food_planned_extras
 where id=p_plan_id and user_id=v_user for update;
 if not found then raise exception 'Geplantes Extra nicht gefunden'; end if;
 if v_plan.status!='confirmed' then return false; end if;
 if not exists(select 1 from public.food_extra_consumptions where id=v_plan.confirmed_extra_id and user_id=v_user and source_reference='food-planned-extra-v1-'||v_plan.id::text) then
  raise exception 'Bestätigter Snack wurde verändert. Bitte erst die Buchungen prüfen';
 end if;
 if exists(select 1 from public.food_extra_consumptions where id=v_plan.confirmed_extra_id and user_id=v_user and measured_piece_selection is not null) then
   delete from public.food_extra_consumptions where id=v_plan.confirmed_extra_id and user_id=v_user;
   return true;
 end if;
 if v_plan.inventory_id is not null then
  select * into v_inv from public.food_inventory
  where id=v_plan.inventory_id and user_id=v_user and is_active=true for update;
  if not found or v_inv.unit is distinct from v_plan.unit then
   raise exception 'Vorratsartikel ist nicht mehr verfügbar oder hat eine andere Einheit';
  end if;
  insert into public.food_inventory_lots
    (user_id,inventory_id,product_id,opened_packages,opened_remaining_quantity,
     opened_remaining_unit,package_quantity,package_unit,source,note)
  values(v_user,v_inv.id,v_plan.product_id,1,v_plan.quantity,v_plan.unit,
     v_plan.quantity,v_plan.unit,'manual','Rückbuchung eines geplanten Genuss-Extras '||v_plan.plan_date::text);
  perform public.adjust_food_inventory(v_inv.id,v_inv.quantity+v_plan.quantity,'Genuss-Extra rückgängig',null);
 end if;
 delete from public.food_extra_consumptions
 where id=v_plan.confirmed_extra_id and user_id=v_user
 and source_reference='food-planned-extra-v1-'||v_plan.id::text;
 update public.food_planned_extras set status='planned',confirmed_extra_id=null,updated_at=now()
 where id=v_plan.id;
 return true;
end $function$
;
