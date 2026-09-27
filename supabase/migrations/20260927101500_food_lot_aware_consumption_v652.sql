-- V652 · packungs-/chargenbewusste Verbrauchslogik
-- Hält food_inventory als Gesamtbestand und food_inventory_lots als Verpackungs-/Kaufchargenmodell synchron.

alter table public.food_inventory_lots
  add column if not exists purchased_on date,
  add column if not exists source_finance_item_id uuid references public.finance_items(id) on delete set null,
  add column if not exists package_label text;

create unique index if not exists uq_food_inventory_lots_finance_item
  on public.food_inventory_lots(user_id, source_finance_item_id)
  where source_finance_item_id is not null;

create or replace function public.food_inventory_lot_label(
  p_inventory_id uuid,
  p_total numeric,
  p_unit text
)
returns text
language plpgsql
stable
set search_path=public,pg_temp
as $$
declare
  v_tracked numeric:=0;
  v_active_lots integer:=0;
  v_product_count integer:=0;
  v_dated_lots integer:=0;
  v_parts text:='';
  v_part text;
  v_prefix text;
  v_container text;
  v_plural text;
  v_row record;
begin
  if p_total is null then
    return public.food_quantity_label(p_total,p_unit);
  end if;

  select
    coalesce(sum(
      coalesce(l.unopened_packages,0) * coalesce(l.package_quantity,0)
      + case
          when l.opened_remaining_quantity is not null
           and lower(coalesce(l.opened_remaining_unit,''))=lower(coalesce(p_unit,''))
          then l.opened_remaining_quantity
          else 0
        end
    ),0),
    count(*) filter (
      where coalesce(l.unopened_packages,0)>0
         or coalesce(l.opened_remaining_quantity,0)>0
    ),
    count(distinct l.product_id) filter (
      where coalesce(l.unopened_packages,0)>0
         or coalesce(l.opened_remaining_quantity,0)>0
    ),
    count(*) filter (
      where l.purchased_on is not null
        and (coalesce(l.unopened_packages,0)>0 or coalesce(l.opened_remaining_quantity,0)>0)
    )
  into v_tracked,v_active_lots,v_product_count,v_dated_lots
  from public.food_inventory_lots l
  where l.inventory_id=p_inventory_id
    and lower(coalesce(l.package_unit,''))=lower(coalesce(p_unit,''))
    and (
      l.opened_remaining_quantity is null
      or lower(coalesce(l.opened_remaining_unit,''))=lower(coalesce(p_unit,''))
    );

  if v_active_lots=0 or abs(v_tracked-p_total)>0.005 then
    return public.food_quantity_label(p_total,p_unit);
  end if;

  for v_row in
    select
      l.*,
      p.brand,
      p.product_name
    from public.food_inventory_lots l
    left join public.shopping_products p on p.id=l.product_id
    where l.inventory_id=p_inventory_id
      and lower(coalesce(l.package_unit,''))=lower(coalesce(p_unit,''))
      and (
        coalesce(l.unopened_packages,0)>0
        or (
          coalesce(l.opened_remaining_quantity,0)>0
          and lower(coalesce(l.opened_remaining_unit,''))=lower(coalesce(p_unit,''))
        )
      )
    order by l.purchased_on nulls last,l.best_before_date nulls last,l.created_at,l.id
  loop
    v_prefix:='';
    if v_product_count>1 then
      v_prefix:=coalesce(nullif(v_row.brand,''),nullif(v_row.product_name,''),'Produkt')||': ';
    end if;

    v_container:=coalesce(nullif(v_row.package_label,''),'Packung');
    v_plural:=case lower(v_container)
      when 'packung' then 'Packungen'
      when 'dose' then 'Dosen'
      when 'flasche' then 'Flaschen'
      when 'becher' then 'Becher'
      when 'glas' then 'Gläser'
      when 'sachet' then 'Sachets'
      when 'kochbeutel' then 'Kochbeutel'
      when 'gewürzdose' then 'Gewürzdosen'
      when 'stück' then 'Stück'
      else v_container||'en'
    end;

    if coalesce(v_row.unopened_packages,0)>0 then
      v_part:=v_prefix
        || v_row.unopened_packages::text || ' '
        || case when v_row.unopened_packages=1 then v_container else v_plural end
        || ' à ' || public.food_quantity_label(v_row.package_quantity,p_unit);
      if v_active_lots>1 and v_dated_lots>0 and v_row.purchased_on is not null then
        v_part:=v_part||' · Kauf '||to_char(v_row.purchased_on,'DD.MM.YYYY');
      end if;
      v_parts:=v_parts||case when v_parts='' then '' else ' + ' end||v_part;
    end if;

    if coalesce(v_row.opened_remaining_quantity,0)>0 then
      v_part:=v_prefix||'angebrochen: '
        || public.food_quantity_label(v_row.opened_remaining_quantity,p_unit);
      if v_active_lots>1 and v_dated_lots>0 and v_row.purchased_on is not null then
        v_part:=v_part||' · Kauf '||to_char(v_row.purchased_on,'DD.MM.YYYY');
      end if;
      v_parts:=v_parts||case when v_parts='' then '' else ' + ' end||v_part;
    end if;
  end loop;

  if v_parts='' then
    return public.food_quantity_label(p_total,p_unit);
  end if;

  if position(' + ' in v_parts)>0
     or v_parts like '2 %'
     or v_parts like '3 %'
     or v_parts like '4 %'
     or v_parts like '5 %'
     or v_parts like '6 %'
     or v_parts like '7 %'
     or v_parts like '8 %'
     or v_parts like '9 %' then
    return v_parts||' = '||public.food_quantity_label(p_total,p_unit);
  end if;

  if v_parts like 'angebrochen:%' then
    return public.food_quantity_label(p_total,p_unit);
  end if;

  return v_parts;
end;
$$;

create or replace function public.consume_food_inventory_lots(
  p_inventory_id uuid,
  p_quantity numeric,
  p_unit text
)
returns jsonb
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_remaining numeric:=p_quantity;
  v_take numeric;
  v_full integer;
  v_available integer;
  v_lot record;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_quantity is null or p_quantity<=0 then
    return jsonb_build_object('tracked_consumed',0,'untracked_consumed',0);
  end if;

  for v_lot in
    select *
    from public.food_inventory_lots
    where user_id=v_user
      and inventory_id=p_inventory_id
      and coalesce(opened_remaining_quantity,0)>0
      and lower(coalesce(opened_remaining_unit,''))=lower(coalesce(p_unit,''))
    order by purchased_on nulls last,best_before_date nulls last,created_at,id
    for update
  loop
    exit when v_remaining<=0;
    v_take:=least(v_remaining,v_lot.opened_remaining_quantity);

    update public.food_inventory_lots
    set opened_remaining_quantity=case
          when opened_remaining_quantity-v_take<=0 then null
          else opened_remaining_quantity-v_take
        end,
        opened_remaining_unit=case
          when opened_remaining_quantity-v_take<=0 then null
          else opened_remaining_unit
        end,
        opened_packages=case
          when opened_remaining_quantity-v_take<=0 then 0
          else greatest(opened_packages,1)
        end,
        updated_at=now()
    where id=v_lot.id;

    v_remaining:=v_remaining-v_take;
  end loop;

  for v_lot in
    select *
    from public.food_inventory_lots
    where user_id=v_user
      and inventory_id=p_inventory_id
      and coalesce(unopened_packages,0)>0
      and coalesce(package_quantity,0)>0
      and lower(coalesce(package_unit,''))=lower(coalesce(p_unit,''))
    order by purchased_on nulls last,best_before_date nulls last,created_at,id
    for update
  loop
    exit when v_remaining<=0;

    v_available:=v_lot.unopened_packages;
    if v_available<=0 then continue; end if;

    v_full:=least(v_available,floor(v_remaining/v_lot.package_quantity)::integer);

    if v_full>0 then
      update public.food_inventory_lots
      set unopened_packages=unopened_packages-v_full,
          updated_at=now()
      where id=v_lot.id;
      v_remaining:=v_remaining-(v_full*v_lot.package_quantity);
      v_available:=v_available-v_full;
    end if;

    if v_remaining>0 and v_available>0 then
      v_take:=least(v_remaining,v_lot.package_quantity);

      if v_take>=v_lot.package_quantity then
        update public.food_inventory_lots
        set unopened_packages=unopened_packages-1,
            updated_at=now()
        where id=v_lot.id;
      else
        update public.food_inventory_lots
        set unopened_packages=unopened_packages-1,
            opened_packages=1,
            opened_remaining_quantity=v_lot.package_quantity-v_take,
            opened_remaining_unit=p_unit,
            updated_at=now()
        where id=v_lot.id;
      end if;

      v_remaining:=v_remaining-v_take;
    end if;
  end loop;

  return jsonb_build_object(
    'tracked_consumed',p_quantity-greatest(v_remaining,0),
    'untracked_consumed',greatest(v_remaining,0)
  );
end;
$$;

create or replace function public.consume_food_inventory(
  p_inventory_id uuid,
  p_quantity numeric,
  p_unit text,
  p_expected_quantity numeric
)
returns public.food_inventory
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_old public.food_inventory%rowtype;
  v_new public.food_inventory%rowtype;
  v_after numeric;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_quantity is null or p_quantity<=0 or p_quantity::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Bitte eine positive, endliche Menge eingeben';
  end if;

  select * into v_old
  from public.food_inventory
  where id=p_inventory_id and user_id=v_user and is_active=true
  for update;

  if not found then raise exception 'Vorrat nicht gefunden'; end if;
  if v_old.unit is distinct from p_unit then raise exception 'Einheit hat sich geändert. Bitte FOOD neu öffnen'; end if;
  if v_old.quantity is null then raise exception 'Bitte zuerst die vorhandene Menge eintragen'; end if;
  if v_old.quantity is distinct from p_expected_quantity then
    raise exception 'Bestand wurde zwischenzeitlich geändert. Bitte FOOD neu öffnen';
  end if;
  if p_quantity>v_old.quantity then raise exception 'So viel ist nicht mehr vorhanden'; end if;

  v_after:=v_old.quantity-p_quantity;
  perform public.consume_food_inventory_lots(p_inventory_id,p_quantity,p_unit);

  update public.food_inventory
  set quantity=v_after,
      quantity_label=public.food_inventory_lot_label(id,v_after,unit),
      forecast_label=null,
      tone=case when v_after=0 then 'empty' else tone end,
      opened=true,
      updated_at=now()
  where id=p_inventory_id and user_id=v_user
  returning * into v_new;

  insert into public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
  values(v_user,p_inventory_id,'consume',-p_quantity,v_old.quantity,v_new.quantity,'Einzelverbrauch');

  return v_new;
end;
$$;

create or replace function public.adjust_food_inventory(
  p_inventory_id uuid,
  p_new_quantity numeric,
  p_reason text default 'adjustment',
  p_note text default null
)
returns public.food_inventory
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_old public.food_inventory%rowtype;
  v_new public.food_inventory%rowtype;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_new_quantity is null or p_new_quantity<0 then raise exception 'Menge muss 0 oder größer sein'; end if;

  select * into v_old
  from public.food_inventory
  where id=p_inventory_id and user_id=v_user and is_active=true
  for update;

  if not found then raise exception 'Vorrat nicht gefunden'; end if;

  if v_old.quantity is not null and p_new_quantity<v_old.quantity then
    perform public.consume_food_inventory_lots(
      p_inventory_id,
      v_old.quantity-p_new_quantity,
      v_old.unit
    );
  end if;

  update public.food_inventory
  set quantity=p_new_quantity,
      quantity_label=public.food_inventory_lot_label(id,p_new_quantity,unit),
      forecast_label=null,
      tone=case when p_new_quantity=0 then 'empty' else case when tone='empty' then 'stock' else tone end end,
      opened=case
        when v_old.quantity is not null and p_new_quantity<v_old.quantity then true
        else opened
      end,
      note=coalesce(p_note,note),
      updated_at=now()
  where id=p_inventory_id
  returning * into v_new;

  insert into public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
  values(v_user,p_inventory_id,'adjust',p_new_quantity-coalesce(v_old.quantity,0),v_old.quantity,p_new_quantity,coalesce(p_reason,'Menge geändert'));

  return v_new;
end;
$$;

create or replace function public.complete_food_meal(p_meal_id uuid)
returns public.food_meals
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_meal public.food_meals%rowtype;
  v_ing record;
  v_stock public.food_inventory%rowtype;
  v_before numeric;
  v_after numeric;
  v_leftover numeric;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_meal
  from public.food_meals
  where id=p_meal_id and user_id=v_user
  for update;

  if not found then raise exception 'Mahlzeit nicht gefunden'; end if;

  if v_meal.inventory_booked_at is not null or v_meal.status='completed' then
    if v_meal.prepared_at is null then
      update public.food_meals
      set prepared_at=coalesce(v_meal.inventory_booked_at,now()),
          updated_at=now()
      where id=v_meal.id
      returning * into v_meal;
    end if;
    return v_meal;
  end if;

  if v_meal.leftover_id is null then
    for v_ing in
      select * from public.food_meal_ingredients
      where meal_id=v_meal.id and user_id=v_user
        and quantity is not null
        and quantity_confirmed=true
      order by sort_order
    loop
      v_stock:=null;

      if v_ing.inventory_id is not null then
        select * into v_stock
        from public.food_inventory
        where id=v_ing.inventory_id and user_id=v_user and is_active=true
        for update;
      elsif v_ing.name is not null then
        select * into v_stock
        from public.food_inventory
        where user_id=v_user
          and is_active=true
          and lower(btrim(name))=lower(btrim(v_ing.name))
        order by sort_order
        limit 1
        for update;

        if v_stock.id is not null then
          update public.food_meal_ingredients
          set inventory_id=v_stock.id
          where id=v_ing.id and user_id=v_user;
        end if;
      end if;

      if v_stock.id is null then continue; end if;
      if v_stock.quantity is null then raise exception 'Menge von "%" ist offen',v_stock.name; end if;
      if v_stock.unit is distinct from v_ing.unit then raise exception 'Einheit von "%" passt nicht',v_stock.name; end if;
      if v_stock.quantity<v_ing.quantity then raise exception 'Nicht genug "%" vorhanden',v_stock.name; end if;

      v_before:=v_stock.quantity;
      v_after:=v_stock.quantity-v_ing.quantity;

      perform public.consume_food_inventory_lots(v_stock.id,v_ing.quantity,v_stock.unit);

      update public.food_inventory
      set quantity=v_after,
          quantity_label=public.food_inventory_lot_label(id,v_after,unit),
          forecast_label=null,
          tone=case when v_after<=0 then 'empty' else v_stock.tone end,
          opened=true,
          updated_at=now()
      where id=v_stock.id;

      insert into public.food_inventory_movements(
        user_id,inventory_id,meal_id,kind,delta,quantity_before,quantity_after,note
      )
      values(
        v_user,v_stock.id,v_meal.id,'consume',-v_ing.quantity,
        v_before,v_after,'Mahlzeit als zubereitet markiert'
      );
    end loop;

    v_leftover:=greatest(v_meal.prepared_servings-v_meal.eaten_servings,0);

    if v_leftover>0 and v_meal.recipe_id is not null then
      insert into public.food_leftovers(
        user_id,recipe_id,source_meal_id,available_servings,original_servings,status,note
      )
      values(
        v_user,v_meal.recipe_id,v_meal.id,v_leftover,v_leftover,'available',
        'Beim Zubereiten der Mahlzeit entstanden'
      )
      on conflict (source_meal_id) do nothing;
    end if;
  end if;

  update public.food_meals
  set status='completed',
      inventory_booked_at=now(),
      prepared_at=now(),
      updated_at=now()
  where id=v_meal.id
  returning * into v_meal;

  return v_meal;
end;
$$;

create or replace function public.confirm_shopping_receipt_review(
  p_review_id uuid,
  p_product_id uuid
)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_review public.shopping_receipt_reviews%rowtype;
  v_product public.shopping_products%rowtype;
  v_finance public.finance_items%rowtype;
  v_inventory public.food_inventory%rowtype;
  v_delta numeric:=0;
  v_before numeric:=0;
  v_after numeric:=0;
  v_inventory_applied boolean:=false;
  v_purchase_date date;
  v_pack_count integer;
  v_package_label text;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_review
  from public.shopping_receipt_reviews
  where id=p_review_id and user_id=v_user
  for update;

  if not found then raise exception 'Bonposition nicht gefunden'; end if;

  select * into v_product
  from public.shopping_products
  where id=p_product_id and user_id=v_user and active=true;

  if not found then raise exception 'Produkt im Produktstamm nicht gefunden'; end if;

  if v_review.status='confirmed' then
    if v_review.product_id=p_product_id then
      return jsonb_build_object(
        'confirmed',true,
        'already_confirmed',true,
        'inventory_applied',v_review.inventory_applied_at is not null
      );
    end if;
    raise exception 'Bonposition ist bereits einem anderen Produkt zugeordnet';
  end if;

  select * into v_finance
  from public.finance_items
  where id=v_review.finance_item_id and user_id=v_user;

  if not found then raise exception 'Bonartikel nicht gefunden'; end if;

  select transaction_date into v_purchase_date
  from public.finance_transactions
  where id=v_finance.transaction_id and user_id=v_user;

  update public.shopping_receipt_aliases
  set is_default=false,updated_at=now()
  where user_id=v_user
    and active=true
    and lower(trim(retailer))=lower(trim(v_review.retailer))
    and normalized_label=v_review.normalized_label
    and product_id<>p_product_id
    and is_default=true;

  insert into public.shopping_receipt_aliases(
    user_id,retailer,receipt_label,normalized_label,product_id,is_default,active,updated_at
  )
  values(
    v_user,v_review.retailer,v_review.receipt_label,v_review.normalized_label,
    p_product_id,true,true,now()
  )
  on conflict (user_id,lower(retailer),normalized_label,product_id)
  do update set
    receipt_label=excluded.receipt_label,
    is_default=true,
    active=true,
    updated_at=now();

  if v_review.inventory_applied_at is null
     and v_product.inventory_id is not null
     and v_product.package_quantity is not null
     and v_product.package_quantity>0 then

    select * into v_inventory
    from public.food_inventory
    where id=v_product.inventory_id and user_id=v_user and is_active=true
    for update;

    if found
       and lower(coalesce(v_inventory.unit,''))=lower(coalesce(v_product.package_unit,'')) then
      v_delta:=v_product.package_quantity*coalesce(v_finance.quantity,1);
      v_before:=coalesce(v_inventory.quantity,0);
      v_after:=v_before+v_delta;

      if coalesce(v_finance.quantity,0)>0
         and v_finance.quantity=trunc(v_finance.quantity) then
        v_pack_count:=v_finance.quantity::integer;
        v_package_label:=case
          when lower(coalesce(v_finance.unit,'')) in ('packung','flasche','dose','becher','glas','sachet','kochbeutel','stück')
            then v_finance.unit
          else 'Packung'
        end;

        insert into public.food_inventory_lots(
          user_id,product_id,inventory_id,purchased_on,source_finance_item_id,
          unopened_packages,opened_packages,package_quantity,package_unit,package_label,
          source,note,updated_at
        )
        values(
          v_user,v_product.id,v_inventory.id,v_purchase_date,v_finance.id,
          v_pack_count,0,v_product.package_quantity,v_product.package_unit,v_package_label,
          'receipt',
          case when v_purchase_date is not null
            then 'Einkauf '||to_char(v_purchase_date,'DD.MM.YYYY')
            else 'Einkauf aus Bon-Gegenprüfung'
          end,
          now()
        )
        on conflict (user_id,source_finance_item_id)
        do update set
          product_id=excluded.product_id,
          inventory_id=excluded.inventory_id,
          purchased_on=coalesce(excluded.purchased_on,public.food_inventory_lots.purchased_on),
          package_quantity=excluded.package_quantity,
          package_unit=excluded.package_unit,
          package_label=excluded.package_label,
          updated_at=now();
      end if;

      update public.food_inventory
      set quantity=v_after,
          quantity_label=public.food_inventory_lot_label(id,v_after,unit),
          tone=case when v_after=0 then 'empty' else 'fresh' end,
          updated_at=now()
      where id=v_inventory.id;

      insert into public.food_inventory_movements(
        user_id,inventory_id,kind,delta,quantity_before,quantity_after,note
      )
      values(
        v_user,v_inventory.id,'add',v_delta,v_before,v_after,
        'Einkauf gegenprüft: '||v_review.retailer||' · '||v_review.receipt_label
      );

      v_inventory_applied:=true;
    end if;
  end if;

  update public.shopping_receipt_reviews
  set status='confirmed',
      product_id=p_product_id,
      notes='Produkt in der Einkaufskontrolle bestätigt.',
      inventory_applied_at=case when v_inventory_applied then now() else inventory_applied_at end,
      resolved_at=now(),
      updated_at=now()
  where id=v_review.id;

  if v_review.checkout_id is not null and not exists(
    select 1
    from public.shopping_receipt_reviews r
    where r.checkout_id=v_review.checkout_id
      and r.user_id=v_user
      and r.id<>v_review.id
      and r.status in ('pending','new_product_pending')
  ) then
    update public.shopping_checkouts
    set status='done',updated_at=now()
    where id=v_review.checkout_id and user_id=v_user;
  end if;

  return jsonb_build_object(
    'confirmed',true,
    'already_confirmed',false,
    'inventory_applied',v_inventory_applied,
    'inventory_delta',v_delta
  );
end;
$$;

grant execute on function public.food_inventory_lot_label(uuid,numeric,text) to authenticated;
grant execute on function public.consume_food_inventory_lots(uuid,numeric,text) to authenticated;
grant execute on function public.consume_food_inventory(uuid,numeric,text,numeric) to authenticated;
grant execute on function public.adjust_food_inventory(uuid,numeric,text,text) to authenticated;
grant execute on function public.complete_food_meal(uuid) to authenticated;
grant execute on function public.confirm_shopping_receipt_review(uuid,uuid) to authenticated;
