-- V1 V912: Preserve zero-quantity lot provenance indefinitely.
-- These routines previously DELETEd empty lots; saved meal allocation
-- lot_id references then became dangling and nutrition emitted
-- "gespeicherte Charge fehlt" despite a correctly booked meal.
-- Closed lots retain their product_id and date but have zero available stock.
-- All consumption searches use positive available quantities only.
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
  v_meat_oldest boolean:=false;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_quantity is null or p_quantity<=0 then
    if v_remaining>0.000001 and exists(select 1 from public.food_freezer_portions f where f.user_id=v_user and f.inventory_id=p_inventory_id and f.frozen_lot_id is not null and f.meal_ingredient_id is not null and f.status in ('frozen','thawing','thawed')) then raise exception 'Nicht genug freier Vorrat: andere Mahlzeit hat eine Portion reserviert';end if;
  return jsonb_build_object('tracked_consumed',0,'untracked_consumed',0);
  end if;

  select coalesce(quantity,0),coalesce(name,'')
    into v_inventory_total,v_inventory_name
  from public.food_inventory
  where id=p_inventory_id
    and user_id=v_user
    and is_active=true;

  v_meat_oldest:=lower(v_inventory_name) ~ '(hähnchen|huhn|hackfleisch|(^|[[:space:]])hack([[:space:]]|$)|rind|schwein|pute|fleisch)';

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
      and not exists(select 1 from public.food_freezer_portions f where f.frozen_lot_id=food_inventory_lots.id and f.meal_ingredient_id is not null and f.status in ('frozen','thawing','thawed'))
    order by
      -- Respect frozen portion explicitly reserved for a different meal.
      case when lower(coalesce(storage_location,'')) ~ '(gefrier|tiefkühl|freezer|frozen)'
             and exists (
                select 1 from public.food_freezer_portions f
                where f.user_id=v_user and f.frozen_lot_id=food_inventory_lots.id
                  and f.status='frozen' and f.meal_ingredient_id is not null
             ) then 1 else 0 end,
      -- Meat always follows actual older purchase lots first; the original
      -- printed expiry date is not a valid comparison for frozen meat.
      case when v_meat_oldest
        then coalesce(purchased_on,created_at::date) end nulls last,
      -- For other foods finish an already opened pack before opening another.
      case when not v_meat_oldest
        then case when coalesce(opened_remaining_quantity,0)>0 then 0 else 1 end end,
      -- Expiry matters only for nonfrozen packs; freezer stock retains its
      -- original label for reference but is not made urgently due by it.
      case when not v_meat_oldest
         and lower(coalesce(storage_location,'')) !~ '(gefrier|tiefkühl|freezer|frozen)'
        then best_before_date end nulls last,
      case when not v_meat_oldest then purchased_on end nulls last,
      created_at,id
    for update
  loop
    exit when v_remaining<=0;

    if coalesce(v_lot.opened_remaining_quantity,0)>0
       and lower(coalesce(v_lot.opened_remaining_unit,''))=lower(coalesce(p_unit,'')) then
      v_take:=least(v_remaining,v_lot.opened_remaining_quantity);

      if v_lot.opened_remaining_quantity-v_take<=0
         and coalesce(v_lot.unopened_packages,0)<=0 then
        UPDATE public.food_inventory_lots
          SET unopened_packages=0,
              opened_packages=0,
              opened_remaining_quantity=NULL,
              opened_remaining_unit=NULL,
              updated_at=now()
          WHERE id=v_lot.id;
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
        UPDATE public.food_inventory_lots
          SET unopened_packages=0,
              opened_packages=0,
              opened_remaining_quantity=NULL,
              opened_remaining_unit=NULL,
              updated_at=now()
          WHERE id=v_lot.id;
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
          UPDATE public.food_inventory_lots
          SET unopened_packages=0,
              opened_packages=0,
              opened_remaining_quantity=NULL,
              opened_remaining_unit=NULL,
              updated_at=now()
          WHERE id=v_lot.id;
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

  if v_remaining>0.000001 and exists(select 1 from public.food_freezer_portions f where f.user_id=v_user and f.inventory_id=p_inventory_id and f.frozen_lot_id is not null and f.meal_ingredient_id is not null and f.status in ('frozen','thawing','thawed')) then raise exception 'Nicht genug freier Vorrat: andere Mahlzeit hat eine Portion reserviert';end if;
  return jsonb_build_object(
    'tracked_consumed',greatest(p_quantity-v_untracked_consumed-greatest(v_remaining,0),0),
    'untracked_consumed',v_untracked_consumed+greatest(v_remaining,0)
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.consume_food_inventory_lots_for_meal(p_inventory_id uuid, p_quantity numeric, p_unit text, p_ingredient_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE x record; pending numeric:=p_quantity; remainder numeric; extra jsonb:='{}'::jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet';END IF;
 IF p_ingredient_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.food_freezer_portions WHERE user_id=auth.uid() AND inventory_id=p_inventory_id AND meal_ingredient_id=p_ingredient_id AND status IN ('frozen','thawing','thawed')) THEN RETURN public.consume_food_inventory_lots(p_inventory_id,p_quantity,p_unit); END IF;
 FOR x IN SELECT f.id AS task_id,f.quantity,f.status,l.id AS lot_id,
   l.opened_remaining_quantity AS open_qty,l.unopened_packages AS packs,l.package_quantity AS pack_qty,
   l.opened_remaining_unit AS open_unit,l.package_unit AS pack_unit
 FROM public.food_freezer_portions f JOIN public.food_inventory_lots l ON l.id=f.frozen_lot_id
 WHERE f.user_id=auth.uid() AND f.meal_ingredient_id=p_ingredient_id AND f.inventory_id=p_inventory_id
 AND f.status IN ('frozen','thawing','thawed') ORDER BY f.id FOR UPDATE OF f,l LOOP
   IF x.status='frozen' THEN RAISE EXCEPTION 'Zugeordnetes TK-Stück liegt noch im Tiefkühler';END IF;
   IF x.open_qty>=x.quantity AND lower(x.open_unit)=lower(p_unit) THEN
     remainder:=x.open_qty-x.quantity;
     IF remainder=0 AND x.packs=0 THEN UPDATE public.food_inventory_lots
          SET unopened_packages=0,
              opened_packages=0,
              opened_remaining_quantity=NULL,
              opened_remaining_unit=NULL,
              updated_at=now()
          WHERE id=x.lot_id;
     ELSE UPDATE public.food_inventory_lots SET
       opened_remaining_quantity=CASE WHEN remainder=0 THEN NULL ELSE remainder END,
       opened_remaining_unit=CASE WHEN remainder=0 THEN NULL ELSE p_unit END,
       opened_packages=CASE WHEN remainder=0 THEN 0 ELSE 1 END,updated_at=now() WHERE id=x.lot_id; END IF;
   ELSIF x.packs=1 AND x.pack_qty=x.quantity AND lower(x.pack_unit)=lower(p_unit) THEN
     UPDATE public.food_inventory_lots
          SET unopened_packages=0,
              opened_packages=0,
              opened_remaining_quantity=NULL,
              opened_remaining_unit=NULL,
              updated_at=now()
          WHERE id=x.lot_id;
   ELSE RAISE EXCEPTION 'Physische Portion und Charge passen nicht überein: %',x.task_id;
   END IF;
   UPDATE public.food_freezer_portions SET origin_lot_snapshot=origin_lot_snapshot||
     jsonb_build_object('consumed_ingredient_id',p_ingredient_id,'consumed_g',x.quantity,'consumed_at',now()),
     updated_at=now() WHERE id=x.task_id;
   pending:=pending-x.quantity;
 END LOOP;
 IF pending<-.000001 THEN RAISE EXCEPTION 'Mehr Teilstücke verknüpft als Rezeptmenge';END IF;
 IF pending>.000001 THEN extra:=public.consume_food_inventory_lots(p_inventory_id,pending,p_unit);END IF;
 RETURN jsonb_build_object('linked_consumed',p_quantity-pending,'other',extra);
END $function$

DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('consume_food_inventory_lots','consume_food_inventory_lots_for_meal')
      AND position('delete from public.food_inventory_lots' IN lower(pg_get_functiondef(p.oid)))>0
  ) THEN
    RAISE EXCEPTION 'V912 must never delete consumed inventory lots';
  END IF;
END $validation$;
