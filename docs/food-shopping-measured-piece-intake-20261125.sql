-- REVIEW ONLY. Requires UI to capture gross weights and handle pending receipt review.
-- Scope: apple/avocado, one checkout lot group, up to 500 whole measured pieces. Never guess weight-to-lot assignments.
-- Tests: valid 153+147g, idempotency, missing/count mismatch/negative/string/split group rejected and rollback verified.
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.apply_shopping_checkout_item_inventory(uuid)'::regprocedure))<>'dc86fcc9bba7dd1496f208e176e110cd' THEN RAISE EXCEPTION 'Source changed';END IF;END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES('apply_shopping_checkout_item_inventory_pre_measured_pieces',pg_get_functiondef('public.apply_shopping_checkout_item_inventory(uuid)'::regprocedure));
CREATE OR REPLACE FUNCTION public.apply_shopping_checkout_item_inventory(p_checkout_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_item public.shopping_checkout_items%rowtype;
  v_checkout public.shopping_checkouts%rowtype;
  v_inventory public.food_inventory%rowtype;
  v_product public.shopping_products%rowtype;
  v_before numeric:=0;
  v_after numeric:=0;
  v_package_qty numeric:=null;
  v_purchase_date date;
  v_label text;
  v_total_packages integer:=0;
  v_lot public.shopping_checkout_item_lots%rowtype;
  v_has_child_lots boolean:=false;
  v_measured_fruit boolean:=false;
  v_weights jsonb;
  v_weight numeric;
  v_physical_lot record;
  v_offset integer:=0;
  v_count integer;
  v_ix integer;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_item
  from public.shopping_checkout_items
  where id=p_checkout_item_id and user_id=v_user
  for update;

  if not found then raise exception 'Einkaufsposition nicht gefunden'; end if;

  if v_item.inventory_applied_at is not null then
    return jsonb_build_object('applied',true,'already_applied',true,'delta',coalesce(v_item.quantity,0));
  end if;

  if v_item.inventory_id is null or v_item.quantity is null or v_item.quantity<=0 then
    return jsonb_build_object('applied',false,'already_applied',false,'reason','no_inventory_or_quantity');
  end if;

  select * into v_inventory
  from public.food_inventory
  where id=v_item.inventory_id and user_id=v_user and is_active=true
  for update;

  if not found then
    return jsonb_build_object('applied',false,'already_applied',false,'reason','inventory_not_found');
  end if;

  if lower(coalesce(v_inventory.unit,''))<>lower(coalesce(v_item.unit,'')) then
    return jsonb_build_object(
      'applied',false,'already_applied',false,'reason','unit_mismatch',
      'inventory_unit',v_inventory.unit,'purchase_unit',v_item.unit
    );
  end if;

  select * into v_checkout
  from public.shopping_checkouts
  where id=v_item.checkout_id and user_id=v_user;

  if v_item.product_id is not null then
    select * into v_product
    from public.shopping_products
    where id=v_item.product_id and user_id=v_user;
  end if;

  v_measured_fruit:=v_inventory.unit='Stück' AND v_inventory.family_name IN ('Apfel','Avocado');
  IF v_measured_fruit THEN
    v_weights:=coalesce(v_item.purchase_data->'gross_piece_weights_g',
      CASE WHEN v_item.purchase_data->>'measure_each_piece_gross_g'='true' THEN v_item.purchase_data->'actual_piece_weights_g' END);
    IF v_item.quantity<>trunc(v_item.quantity) OR v_item.quantity>500 OR v_item.quantity::text IN ('NaN','Infinity','-Infinity') OR v_product.id IS NULL OR v_product.inventory_id IS DISTINCT FROM v_inventory.id THEN
      RAISE EXCEPTION 'Stückkauf benötigt ganze Stückzahl und eindeutigen Handelsartikel';
    END IF;
    IF jsonb_typeof(v_weights) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Einzelne Bruttogewichte vor Bestandsbuchung erfassen'; END IF;
    IF jsonb_array_length(v_weights)<>v_item.quantity OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_weights) w WHERE jsonb_typeof(w)<>'number' OR CASE WHEN jsonb_typeof(w)='number' THEN (w::text)::numeric<=0 ELSE true END) THEN
      RAISE EXCEPTION 'Anzahl oder Bruttogewichte der Einzelstücke ungültig';
    END IF;
    IF EXISTS (SELECT 1 FROM public.food_inventory_lots l WHERE l.user_id=v_user AND l.checkout_item_id=v_item.id) THEN RAISE EXCEPTION 'Einkauf hat bereits eine Charge ohne Buchungsbestätigung; zuerst prüfen'; END IF;
    -- Child lot grouping needs explicitly measured per-group weights, not guessed slices.
    IF (SELECT count(*) FROM public.shopping_checkout_item_lots WHERE checkout_item_id=v_item.id AND user_id=v_user)>1 THEN RAISE EXCEPTION 'Mehrere Chargen benötigen getrennte Einkaufspositionen mit eigenen Stückgewichten';END IF;
  END IF;
  v_before:=coalesce(v_inventory.quantity,0);
  v_after:=v_before+v_item.quantity;

  update public.food_inventory
  set quantity=v_after,
      quantity_label=public.food_quantity_label(v_after,unit),
      tone=case when v_after=0 then 'empty' else 'fresh' end,
      updated_at=now()
  where id=v_inventory.id;

  insert into public.food_inventory_movements(
    user_id,inventory_id,kind,delta,quantity_before,quantity_after,note
  ) values (
    v_user,v_inventory.id,'add',v_item.quantity,v_before,v_after,
    'Einkauf bestätigt: '||coalesce(v_checkout.retailer,'Einkauf')||' · '||v_item.label
  );

  v_purchase_date:=coalesce((v_checkout.completed_at at time zone 'Europe/Berlin')::date,current_date);

  select coalesce(sum(package_count),0)::integer, count(*)>0
  into v_total_packages,v_has_child_lots
  from public.shopping_checkout_item_lots
  where checkout_item_id=v_item.id and user_id=v_user;

  if v_has_child_lots and v_total_packages>0 then
    v_package_qty:=v_item.quantity/v_total_packages;

    for v_lot in
      select *
      from public.shopping_checkout_item_lots
      where checkout_item_id=v_item.id and user_id=v_user
      order by created_at,id
    loop
      v_label:=trim(to_char(v_package_qty,'FM999999990.##')||
        case when coalesce(v_item.unit,'')<>'' then ' '||v_item.unit else '' end);

      insert into public.food_inventory_lots(
        user_id,product_id,inventory_id,best_before_date,best_before_label,
        unopened_packages,opened_packages,package_quantity,package_unit,servings_per_package,
        source,note,purchased_on,package_label,checkout_item_id,checkout_item_lot_id,batch_data
      ) values (
        v_user,v_item.product_id,v_item.inventory_id,v_lot.best_before_date,
        case when v_lot.best_before_date is null then null else to_char(v_lot.best_before_date,'DD.MM.YYYY') end,
        v_lot.package_count,0,v_package_qty,v_item.unit,v_product.servings_per_package,
        'shopping_checkout',
        coalesce(v_lot.note,'Einkauf bestätigt · '||coalesce(v_checkout.retailer,'Einkauf')||' · '||v_item.label),
        v_purchase_date,v_label,v_item.id,v_lot.id,
        jsonb_build_object('checkout_id',v_item.checkout_id,'shopping_key',v_item.shopping_key)
      )
      on conflict (checkout_item_lot_id) where checkout_item_lot_id is not null
      do update set
        product_id=excluded.product_id,
        best_before_date=excluded.best_before_date,
        best_before_label=excluded.best_before_label,
        unopened_packages=excluded.unopened_packages,
        package_quantity=excluded.package_quantity,
        package_unit=excluded.package_unit,
        servings_per_package=excluded.servings_per_package,
        purchased_on=excluded.purchased_on,
        package_label=excluded.package_label,
        updated_at=now();
    end loop;
  elsif v_item.best_before_date is not null or v_item.product_id is not null then
    if v_item.package_count is not null and v_item.package_count>0 then
      v_package_qty:=v_item.quantity/v_item.package_count;
    else
      v_package_qty:=v_item.quantity;
    end if;

    v_label:=trim(to_char(v_package_qty,'FM999999990.##')||
      case when coalesce(v_item.unit,'')<>'' then ' '||v_item.unit else '' end);

    insert into public.food_inventory_lots(
      user_id,product_id,inventory_id,best_before_date,best_before_label,
      unopened_packages,opened_packages,package_quantity,package_unit,servings_per_package,
      source,note,purchased_on,package_label,checkout_item_id,batch_data
    ) values (
      v_user,v_item.product_id,v_item.inventory_id,v_item.best_before_date,
      case when v_item.best_before_date is null then null else to_char(v_item.best_before_date,'DD.MM.YYYY') end,
      coalesce(v_item.package_count,1),0,v_package_qty,v_item.unit,v_product.servings_per_package,
      'shopping_checkout',
      'Einkauf bestätigt · '||coalesce(v_checkout.retailer,'Einkauf')||' · '||v_item.label,
      v_purchase_date,v_label,v_item.id,
      jsonb_build_object('checkout_id',v_item.checkout_id,'shopping_key',v_item.shopping_key)
    );
  end if;

  IF v_measured_fruit THEN
    FOR v_physical_lot IN SELECT id,unopened_packages,package_quantity FROM public.food_inventory_lots WHERE user_id=v_user AND checkout_item_id=v_item.id AND inventory_id=v_inventory.id ORDER BY id FOR UPDATE LOOP
      IF v_physical_lot.package_quantity<>trunc(v_physical_lot.package_quantity) THEN RAISE EXCEPTION 'Packung enthält keine ganze Stückzahl';END IF;
      v_count:=(v_physical_lot.unopened_packages*v_physical_lot.package_quantity)::integer;
      IF v_count<=0 OR v_offset+v_count>jsonb_array_length(v_weights) THEN RAISE EXCEPTION 'Chargenstückzahl widerspricht Einkaufswiegung';END IF;
      FOR v_ix IN 1..v_count LOOP
        v_weight:=(v_weights->(v_offset+v_ix-1))::text::numeric;
        INSERT INTO public.food_inventory_pieces(user_id,inventory_id,lot_id,piece_index,produce_kind,color,weight_g,remaining_weight_g,status,weight_source,measured_on,note)
        VALUES(v_user,v_inventory.id,v_physical_lot.id,v_ix,CASE WHEN v_inventory.family_name='Avocado' THEN 'avocado' ELSE 'apple' END,CASE WHEN v_inventory.family_name='Avocado' THEN 'grün' ELSE 'nicht erfasst' END,v_weight,v_weight,'whole','user_scale',(now() AT TIME ZONE 'Europe/Berlin')::date,'Bruttogewicht aus bestätigter Einkaufswiegung, ohne Schalen-/Kernabzug');
      END LOOP;
      v_offset:=v_offset+v_count;
    END LOOP;
    IF v_offset<>v_item.quantity THEN RAISE EXCEPTION 'Nicht alle Einkaufsstücke einer Charge zugeordnet';END IF;
  END IF;

  update public.shopping_checkout_items
  set package_count=case when v_has_child_lots and v_total_packages>0 then v_total_packages else package_count end,
      inventory_applied_at=now()
  where id=v_item.id;

  return jsonb_build_object(
    'applied',true,'already_applied',false,
    'delta',v_item.quantity,'quantity_before',v_before,'quantity_after',v_after,
    'lot_groups',case when v_has_child_lots then
      (select count(*) from public.shopping_checkout_item_lots where checkout_item_id=v_item.id and user_id=v_user)
      else 0 end
  );
end;
$function$
;