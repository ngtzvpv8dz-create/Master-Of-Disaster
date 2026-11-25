-- REVIEW ONLY. Manual measured fruit intake with stable request ID; do not deploy separately.
-- Combined rollback test: 2 pieces, 300g, exact candidates, idempotency and blocked legacy lot create, unchanged production stock.
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.manage_food_inventory_lot_v848(text,uuid,uuid,timestamp with time zone,integer,numeric,numeric,uuid,text,text,text,text)'::regprocedure))<>'2a7ceca4c75df60a61899dfaa525c1ec' THEN RAISE EXCEPTION 'Source changed';END IF;END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES('manage_food_inventory_lot_pre_measured_fruit',pg_get_functiondef('public.manage_food_inventory_lot_v848(text,uuid,uuid,timestamp with time zone,integer,numeric,numeric,uuid,text,text,text,text)'::regprocedure));
CREATE FUNCTION public.food_add_measured_fruit_lot(p_inventory_id uuid,p_product_id uuid,p_request_id uuid,p_expected_quantity numeric,p_gross_weights jsonb,p_purchased_on date,p_best_before date,p_storage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE u uuid:=auth.uid(); f public.food_inventory%rowtype; l public.food_inventory_lots%rowtype; n integer; w numeric; ix integer; total numeric;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet';END IF;
 IF p_request_id IS NULL OR p_purchased_on IS NULL OR p_purchased_on>(now() AT TIME ZONE 'Europe/Berlin')::date OR (p_best_before IS NOT NULL AND p_best_before<p_purchased_on) THEN RAISE EXCEPTION 'Kaufdatum oder Chargen-ID ungültig';END IF;
 IF jsonb_typeof(p_gross_weights) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Einzelgewichte erforderlich';END IF;
 n:=jsonb_array_length(p_gross_weights);
 IF n<1 OR n>500 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_gross_weights) x WHERE jsonb_typeof(x)<>'number' OR CASE WHEN jsonb_typeof(x)='number' THEN x::text::numeric<=0 ELSE true END) THEN RAISE EXCEPTION 'Einzelgewichte ungültig';END IF;
 SELECT * INTO f FROM public.food_inventory WHERE id=p_inventory_id AND user_id=u AND is_active AND unit='Stück' AND family_name IN ('Apfel','Avocado') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Geeigneter Vorrat fehlt';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.shopping_products WHERE id=p_product_id AND user_id=u AND inventory_id=f.id AND active) THEN RAISE EXCEPTION 'Produkt passt nicht zur Charge';END IF;
 SELECT * INTO l FROM public.food_inventory_lots WHERE id=p_request_id AND user_id=u;
 IF FOUND THEN
   IF l.inventory_id<>f.id OR l.product_id IS DISTINCT FROM p_product_id OR l.source<>'manual_measured_fruit' OR l.batch_data->'gross_piece_weights_g' IS DISTINCT FROM p_gross_weights OR l.purchased_on IS DISTINCT FROM p_purchased_on OR l.best_before_date IS DISTINCT FROM p_best_before OR l.storage_location IS DISTINCT FROM nullif(btrim(p_storage),'') THEN RAISE EXCEPTION 'Anfrage-ID bereits anders verwendet';END IF;
   RETURN jsonb_build_object('inventory_id',f.id,'lot_id',l.id,'quantity',f.quantity,'already_applied',true);
 END IF;
 IF f.quantity IS NULL OR f.quantity IS DISTINCT FROM p_expected_quantity THEN RAISE EXCEPTION 'Bestand geändert; bitte neu laden';END IF;
 total:=f.quantity+n;
 INSERT INTO public.food_inventory_lots(id,user_id,inventory_id,product_id,unopened_packages,opened_packages,package_quantity,package_unit,best_before_date,best_before_label,purchased_on,storage_location,source,batch_data)
 VALUES(p_request_id,u,f.id,p_product_id,1,0,n,'Stück',p_best_before,CASE WHEN p_best_before IS NULL THEN NULL ELSE to_char(p_best_before,'DD.MM.YYYY') END,p_purchased_on,nullif(btrim(p_storage),''),'manual_measured_fruit',jsonb_build_object('gross_piece_weights_g',p_gross_weights,'gross_total_g',(SELECT sum(x::text::numeric) FROM jsonb_array_elements(p_gross_weights) x),'weight_kind','gross_including_peel_core_stone'));
 FOR ix IN 1..n LOOP
  w:=(p_gross_weights->(ix-1))::text::numeric;
  INSERT INTO public.food_inventory_pieces(user_id,inventory_id,lot_id,piece_index,produce_kind,color,weight_g,remaining_weight_g,status,weight_source,measured_on,note)
  VALUES(u,f.id,p_request_id,ix,CASE WHEN f.family_name='Avocado' THEN 'avocado' ELSE 'apple' END,CASE WHEN f.family_name='Avocado' THEN 'grün' ELSE 'nicht erfasst' END,w,w,'whole','user_scale',(now() AT TIME ZONE 'Europe/Berlin')::date,'Manuell erfasstes Bruttogewicht');
 END LOOP;
 UPDATE public.food_inventory SET quantity=total,quantity_label=public.food_inventory_lot_label(id,total,unit),forecast_label=NULL,tone='fresh',updated_at=now() WHERE id=f.id AND user_id=u;
 INSERT INTO public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note) VALUES(u,f.id,'add',n,f.quantity,total,'Manuelle gewogene Charge '||p_request_id::text);
 RETURN jsonb_build_object('inventory_id',f.id,'lot_id',p_request_id,'quantity',total,'already_applied',false);
END $fn$;
REVOKE ALL ON FUNCTION public.food_add_measured_fruit_lot(uuid,uuid,uuid,numeric,jsonb,date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.food_add_measured_fruit_lot(uuid,uuid,uuid,numeric,jsonb,date,date,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.manage_food_inventory_lot_v848(p_action text, p_inventory_id uuid, p_lot_id uuid DEFAULT NULL::uuid, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_unopened integer DEFAULT 0, p_opened_remaining numeric DEFAULT 0, p_package_quantity numeric DEFAULT NULL::numeric, p_product_id uuid DEFAULT NULL::uuid, p_best_before_label text DEFAULT NULL::text, p_storage_location text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_item public.food_inventory%rowtype;
  v_lot public.food_inventory_lots%rowtype;
  v_old numeric:=0;
  v_new numeric:=0;
  v_total numeric;
  v_pkg numeric;
  v_pkgunit text;
  v_openunit text;
  v_product uuid;
  v_opened integer:=0;
  v_reason text:=nullif(left(btrim(coalesce(p_reason,'')),220),'');
  v_note text:=nullif(left(btrim(coalesce(p_note,'')),800),'');
  v_best text:=nullif(left(btrim(coalesce(p_best_before_label,'')),80),'');
  v_location text:=nullif(left(btrim(coalesce(p_storage_location,'')),120),'');
  v_meta jsonb;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_action not in ('create','update','discard') then raise exception 'Unbekannte Chargenaktion'; end if;
  if p_unopened is null or p_unopened<0 or p_unopened>100000 then raise exception 'Ungültige Zahl ungeöffneter Packungen'; end if;
  if p_opened_remaining is null or p_opened_remaining<0 or p_opened_remaining::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ungültige Restmenge'; end if;

  select * into v_item from public.food_inventory
  where id=p_inventory_id and user_id=v_user and is_active=true for update;
  if not found then raise exception 'Produktfamilie nicht gefunden oder keine Berechtigung'; end if;
  if v_item.quantity is null then raise exception 'Gesamtbestand nicht bekannt. Bitte zuerst den Bestand klären'; end if;

  IF v_item.unit='Stück' AND v_item.family_name IN ('Apfel','Avocado') THEN RAISE EXCEPTION 'Einzeln gewogene Früchte nur über Stückverwaltung buchen'; END IF;
  if p_action='create' then
    if p_lot_id is not null then raise exception 'Für neue Chargen keine vorhandene Chargen-ID angeben'; end if;
    v_pkg:=p_package_quantity;
    v_pkgunit:=v_item.unit;
    v_openunit:=v_item.unit;
    v_product:=p_product_id;
    if v_product is not null and not exists (
      select 1 from public.shopping_products
      where id=v_product and inventory_id=v_item.id and user_id=v_user
    ) then raise exception 'Produkt passt nicht zur ausgewählten Familie'; end if;
  else
    if p_lot_id is null then raise exception 'Keine Chargen-ID gewählt'; end if;
    select * into v_lot from public.food_inventory_lots
      where id=p_lot_id and inventory_id=v_item.id and user_id=v_user for update;
    if not found then raise exception 'Charge wurde bereits geändert oder entfernt'; end if;
    if p_expected_updated_at is null or v_lot.updated_at is distinct from p_expected_updated_at then
      raise exception 'Charge wurde zwischenzeitlich geändert. Bitte Vorrat neu laden'; end if;
    if exists(select 1 from public.food_freezer_portions f
      where f.user_id=v_user
        and (f.source_lot_id=v_lot.id or f.frozen_lot_id=v_lot.id)
        and f.status not in ('cancelled','consumed'))
    then raise exception 'Charge ist einer Gefrierportion zugeordnet. Bitte erst diese Zuordnung klären'; end if;
    v_pkg:=coalesce(p_package_quantity,v_lot.package_quantity);
    v_pkgunit:=coalesce(nullif(v_lot.package_unit,''),v_item.unit);
    v_openunit:=coalesce(nullif(v_lot.opened_remaining_unit,''),v_pkgunit);
    v_product:=coalesce(p_product_id,v_lot.product_id);
    v_old:=coalesce(public.mod_food_lot_quantity_v848(
      coalesce(v_lot.unopened_packages,0)*coalesce(v_lot.package_quantity,0),v_pkgunit,v_item.unit),0)
      +coalesce(public.mod_food_lot_quantity_v848(
        coalesce(v_lot.opened_remaining_quantity,0),v_openunit,v_item.unit),0);
    if (coalesce(v_lot.unopened_packages,0)>0 and public.mod_food_lot_quantity_v848(coalesce(v_lot.package_quantity,0),v_pkgunit,v_item.unit) is null)
       or (coalesce(v_lot.opened_remaining_quantity,0)>0 and public.mod_food_lot_quantity_v848(v_lot.opened_remaining_quantity,v_openunit,v_item.unit) is null)
    then raise exception 'Einheiten dieser Charge können nicht sicher umgerechnet werden'; end if;
  end if;
  if p_action='discard' then
    v_pkg:=coalesce(v_pkg,1); v_opened:=0;
    v_new:=0;v_reason:=coalesce(v_reason,'Manuell entfernt');
  else
    if v_pkg is null or v_pkg<=0 or v_pkg::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Packungsgröße muss positiv sein'; end if;
    if p_opened_remaining>v_pkg then
      raise exception 'Angebrochene Restmenge darf eine Packung nicht überschreiten'; end if;
    if p_action='create' and p_unopened=0 and p_opened_remaining=0 then
      raise exception 'Neue Charge muss einen Bestand enthalten'; end if;
    v_opened:=case when p_opened_remaining>0 then 1 else 0 end;
    v_new:=public.mod_food_lot_quantity_v848(p_unopened*v_pkg,v_pkgunit,v_item.unit)
      +public.mod_food_lot_quantity_v848(p_opened_remaining,v_openunit,v_item.unit);
    if v_new is null then raise exception 'Einheiten lassen sich nicht sicher in den Gesamtbestand umrechnen'; end if;
  end if;
  v_total:=v_item.quantity+v_new-v_old;
  if v_total < -0.000001 then
    raise exception 'Die Änderung übersteigt den vorhandenen Gesamtbestand. Keine andere Charge wurde verändert';end if;
  v_total:=greatest(0,v_total);

  if p_action='create' then
    insert into public.food_inventory_lots(
      user_id,inventory_id,product_id,
      unopened_packages,opened_packages,opened_remaining_quantity,opened_remaining_unit,
      package_quantity,package_unit,best_before_label,storage_location,note,source,batch_data
    ) values (
      v_user,v_item.id,v_product,
      p_unopened,v_opened,case when v_opened=1 then p_opened_remaining else null end,
      case when v_opened=1 then v_openunit else null end,
      v_pkg,v_pkgunit,v_best,v_location,v_note,'manual_individual_lot_v848','{}'::jsonb
    ) returning * into v_lot;
  else
    v_meta:=coalesce(v_lot.batch_data,'{}'::jsonb);
    if p_action='discard' then
      v_meta:=v_meta||jsonb_build_object('stock_removed_at',now(),'stock_removal_reason',v_reason,'removed_quantity',v_old);
    else
      v_meta:=(v_meta-'stock_removed_at'-'stock_removal_reason'-'removed_quantity');
    end if;
    update public.food_inventory_lots set
      unopened_packages=case when p_action='discard' then 0 else p_unopened end,
      opened_packages=v_opened,
      opened_remaining_quantity=case when v_opened=1 then p_opened_remaining else null end,
      opened_remaining_unit=case when v_opened=1 then v_openunit else null end,
      package_quantity=v_pkg,
      best_before_label=case when p_action='discard' then best_before_label else v_best end,
      storage_location=case when p_action='discard' then storage_location else v_location end,
      note=case when p_action='discard' then coalesce(note,'')||' · Entfernt: '||v_reason else v_note end,
      batch_data=v_meta,
      updated_at=now()
    where id=v_lot.id and user_id=v_user returning * into v_lot;
  end if;

  update public.food_inventory set
    quantity=v_total,
    quantity_label=public.food_inventory_lot_label(id,v_total,unit),
    opened=exists(select 1 from public.food_inventory_lots l where l.inventory_id=v_item.id and l.user_id=v_user and coalesce(l.opened_remaining_quantity,0)>0),
    forecast_label=null,
    tone=case when v_total=0 then 'empty' else case when tone='empty' then 'stock' else tone end end,
    updated_at=now()
  where id=v_item.id and user_id=v_user;
  insert into public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
  values(v_user,v_item.id,
    case when p_action='discard' and lower(v_reason) ~ 'schlecht|verdorb|müll|vergammel' then 'spoilage'
         when p_action='discard' then 'remove' else 'adjust' end,
    v_new-v_old,v_item.quantity,v_total,
    'Chargen-ID '||v_lot.id::text||' · '||case when p_action='discard' then v_reason else coalesce(v_reason,'Charge einzeln angepasst') end);
  return jsonb_build_object('inventory_id',v_item.id,'lot_id',v_lot.id,'quantity',v_total,'action',p_action);
end;
$function$
;