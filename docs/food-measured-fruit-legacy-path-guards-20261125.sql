-- REVIEW ONLY: deploy together with piece-aware planner/UI/booking, never separately.
-- Prevent old quantity-only consumption or adjustment paths from silently changing measured fruit stock.
-- Historical measured-piece rows remain in scope even when the current stock is zero.
-- Legacy fruit snack and refund routes are blocked, NOT yet converted to exact-piece snack booking.
-- Purchasing and direct table edits also require coordinated integration; do not activate this guard prematurely.
-- Rollback test: 8 invalid legacy paths rejected without partial changes; ordinary cashew extra confirm/edit+/edit-/undo and unchanged count passed.
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.consume_food_inventory_lots(uuid,numeric,text)'::regprocedure))<>'71029adc7b4206a39b39f81dd8603d61' OR md5(pg_get_functiondef('public.adjust_food_inventory(uuid,numeric,text,text)'::regprocedure))<>'8360d559339dca5a5390c05840a90769' THEN RAISE EXCEPTION 'Live source changed; review and retest';END IF;
END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES
('consume_food_inventory_lots_pre_measured_fruit_guard',pg_get_functiondef('public.consume_food_inventory_lots(uuid,numeric,text)'::regprocedure)),
('adjust_food_inventory_pre_measured_fruit_guard',pg_get_functiondef('public.adjust_food_inventory(uuid,numeric,text,text)'::regprocedure));
CREATE FUNCTION public.food_has_measured_fruit_tracking(p_inventory_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public','pg_temp' AS $fn$
 SELECT EXISTS (
 SELECT 1 FROM public.food_inventory f JOIN public.food_inventory_pieces p ON p.inventory_id=f.id AND p.user_id=f.user_id
 JOIN public.food_inventory_lots l ON l.id=p.lot_id AND l.inventory_id=f.id AND l.user_id=f.user_id
 WHERE f.id=p_inventory_id AND f.user_id=auth.uid() AND f.is_active AND f.unit='Stück'
 AND f.family_name IN ('Apfel','Avocado','Banane','Mango','Limette') AND p.weight_source='user_scale')
$fn$;
REVOKE ALL ON FUNCTION public.food_has_measured_fruit_tracking(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.food_has_measured_fruit_tracking(uuid) TO authenticated;
COMMENT ON FUNCTION public.food_has_measured_fruit_tracking(uuid) IS 'Owner-scoped detection of individually weighed apple/avocado stock, including historical lot-linked records so untraceable returns cannot create a phantom piece.';
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

  IF public.food_has_measured_fruit_tracking(p_inventory_id) THEN
    RAISE EXCEPTION 'Einzeln gewogene Früchte nur über eindeutige Stückbuchung entnehmen';
  END IF;
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
;
CREATE OR REPLACE FUNCTION public.adjust_food_inventory(p_inventory_id uuid, p_new_quantity numeric, p_reason text DEFAULT 'adjustment'::text, p_note text DEFAULT NULL::text)
 RETURNS food_inventory
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF p_new_quantity IS DISTINCT FROM v_old.quantity AND public.food_has_measured_fruit_tracking(p_inventory_id) THEN
    RAISE EXCEPTION 'Einzeln gewogene Früchte nur über eindeutige Stückkorrektur ändern';
  END IF;
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
$function$
;
