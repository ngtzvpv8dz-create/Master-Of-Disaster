CREATE OR REPLACE FUNCTION public.consume_food_inventory_lots(p_inventory_id uuid, p_quantity numeric, p_unit text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_remaining numeric:=p_quantity;
  v_take numeric;
  v_full integer;
  v_available integer;
  v_lot record;
  v_inventory_total numeric:=0;
  v_tracked_total numeric:=0;
  v_untracked_available numeric:=0;
  v_untracked_consumed numeric:=0;
  v_inventory_name text:='';
  v_frozen_first boolean:=false;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_quantity is null or p_quantity<=0 then
    return jsonb_build_object('tracked_consumed',0,'untracked_consumed',0);
  end if;

  select coalesce(quantity,0),coalesce(name,'')
    into v_inventory_total,v_inventory_name
  from public.food_inventory
  where id=p_inventory_id
    and user_id=v_user
    and is_active=true;

  v_frozen_first:=lower(v_inventory_name) ~ '(hähnchen|huhn|hackfleisch|(^|[[:space:]])hack([[:space:]]|$)|rind|schwein|pute|fleisch)';

  select coalesce(sum(
      case
        when lower(coalesce(package_unit,''))=lower(coalesce(p_unit,''))
          then coalesce(unopened_packages,0)*coalesce(package_quantity,0)
        else 0
      end
      +
      case
        when lower(coalesce(opened_remaining_unit,''))=lower(coalesce(p_unit,''))
          then coalesce(opened_remaining_quantity,0)
        else 0
      end
    ),0)
    into v_tracked_total
  from public.food_inventory_lots
  where user_id=v_user
    and inventory_id=p_inventory_id;

  -- Legacy / noch nicht chargengenau erfasster Bestand gilt als älter
  -- als später sauber erfasste Einkäufe und wird deshalb zuerst verbraucht.
  v_untracked_available:=greatest(v_inventory_total-v_tracked_total,0);
  v_untracked_consumed:=least(v_remaining,v_untracked_available);
  v_remaining:=v_remaining-v_untracked_consumed;

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
      case
        when v_frozen_first then
          case when lower(coalesce(storage_location,'')) ~ '(gefrier|tiefkühl|freezer|frozen)' then 0 else 1 end
        else
          case when lower(coalesce(storage_location,'')) ~ '(gefrier|tiefkühl|freezer|frozen)' then 1 else 0 end
      end,
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

      if v_lot.opened_remaining_quantity-v_take<=0
         and coalesce(v_lot.unopened_packages,0)<=0 then
        delete from public.food_inventory_lots
        where id=v_lot.id;
      else
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
      end if;

      v_remaining:=v_remaining-v_take;
      if v_remaining<=0 then continue; end if;

      v_lot.opened_remaining_quantity:=greatest(v_lot.opened_remaining_quantity-v_take,0);
      if coalesce(v_lot.unopened_packages,0)<=0 then continue; end if;
    end if;

    v_available:=coalesce(v_lot.unopened_packages,0);
    if v_available<=0 or coalesce(v_lot.package_quantity,0)<=0 then
      continue;
    end if;

    v_full:=least(v_available,floor(v_remaining/v_lot.package_quantity)::integer);

    if v_full>0 then
      if v_full>=v_available
         and coalesce(v_lot.opened_packages,0)<=0
         and coalesce(v_lot.opened_remaining_quantity,0)<=0 then
        delete from public.food_inventory_lots
        where id=v_lot.id;
      else
        update public.food_inventory_lots
        set unopened_packages=unopened_packages-v_full,
            updated_at=now()
        where id=v_lot.id;
      end if;

      v_remaining:=v_remaining-(v_full*v_lot.package_quantity);
      v_available:=v_available-v_full;
    end if;

    if v_remaining>0 and v_available>0 then
      v_take:=least(v_remaining,v_lot.package_quantity);

      if v_take>=v_lot.package_quantity then
        if v_available<=1
           and coalesce(v_lot.opened_packages,0)<=0
           and coalesce(v_lot.opened_remaining_quantity,0)<=0 then
          delete from public.food_inventory_lots
          where id=v_lot.id;
        else
          update public.food_inventory_lots
          set unopened_packages=unopened_packages-1,
              updated_at=now()
          where id=v_lot.id;
        end if;
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
    'tracked_consumed',greatest(p_quantity-v_untracked_consumed-greatest(v_remaining,0),0),
    'untracked_consumed',v_untracked_consumed+greatest(v_remaining,0)
  );
end;
$function$
