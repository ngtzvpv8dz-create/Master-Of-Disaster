-- V653 · FEFO/FIFO-Verbrauch
-- Frühestes MHD zuerst, danach ältestes Kaufdatum.
-- Innerhalb derselben Charge wird ein bereits geöffnetes Gebinde zuerst geleert.

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
      and (
        (
          coalesce(opened_remaining_quantity,0)>0
          and lower(coalesce(opened_remaining_unit,''))=lower(coalesce(p_unit,''))
        )
        or (
          coalesce(unopened_packages,0)>0
          and coalesce(package_quantity,0)>0
          and lower(coalesce(package_unit,''))=lower(coalesce(p_unit,''))
        )
      )
    order by
      best_before_date nulls last,
      purchased_on nulls last,
      created_at,
      id
    for update
  loop
    exit when v_remaining<=0;

    if coalesce(v_lot.opened_remaining_quantity,0)>0
       and lower(coalesce(v_lot.opened_remaining_unit,''))=lower(coalesce(p_unit,'')) then
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

      if v_remaining<=0 then
        continue;
      end if;
    end if;

    v_available:=coalesce(v_lot.unopened_packages,0);
    if v_available<=0 or coalesce(v_lot.package_quantity,0)<=0 then
      continue;
    end if;

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
    order by
      l.best_before_date nulls last,
      l.purchased_on nulls last,
      l.created_at,
      l.id
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

    if coalesce(v_row.opened_remaining_quantity,0)>0 then
      v_part:=v_prefix||'angebrochen: '
        || public.food_quantity_label(v_row.opened_remaining_quantity,p_unit);
      if v_active_lots>1 and v_dated_lots>0 and v_row.purchased_on is not null then
        v_part:=v_part||' · Kauf '||to_char(v_row.purchased_on,'DD.MM.YYYY');
      end if;
      v_parts:=v_parts||case when v_parts='' then '' else ' + ' end||v_part;
    end if;

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

grant execute on function public.consume_food_inventory_lots(uuid,numeric,text) to authenticated;
grant execute on function public.food_inventory_lot_label(uuid,numeric,text) to authenticated;
