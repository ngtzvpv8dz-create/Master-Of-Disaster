create or replace function public.edit_food_planned_extra_v1(p_plan_id uuid,p_quantity numeric)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_user uuid:=auth.uid();v_plan public.food_planned_extras%rowtype;
 v_inv public.food_inventory%rowtype;v_new_qty numeric;
 v_delta numeric;v_ratio numeric;v_extra_id uuid;
begin
 if v_user is null then raise exception 'Bitte anmelden';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity>10000 or p_quantity::text in ('NaN','Infinity','-Infinity')
 then raise exception 'Bitte gültige positive Menge eingeben';end if;
 select * into v_plan from public.food_planned_extras where id=p_plan_id and user_id=v_user for update;
 if not found then raise exception 'Genuss-Extra nicht gefunden';end if;
 if v_plan.status='skipped' then raise exception 'Nicht verwendeten Vorschlag zuerst wieder einplanen';end if;
 if v_plan.unit='Portion' and p_quantity<>trunc(p_quantity) then
  raise exception 'Bei Beuteln bitte ganze Stückzahlen eingeben';end if;
 if v_plan.title like 'Milka Danke%' and mod(p_quantity,5.7)<>0 then
  raise exception 'Milka-Pralinen nur als ganze 5,7-g-Stücke eingeben';end if;
 v_delta:=p_quantity-v_plan.quantity;
 if v_delta=0 then return v_plan.confirmed_extra_id;end if;
 v_ratio:=p_quantity/v_plan.quantity;
 if v_plan.status='confirmed' and v_plan.inventory_id is not null then
  select * into v_inv from public.food_inventory
   where id=v_plan.inventory_id and user_id=v_user and is_active=true for update;
  if not found or v_inv.unit is distinct from v_plan.unit then
    raise exception 'Vorratsprodukt fehlt bzw. Einheit hat sich geändert';end if;
  if v_delta>0 then
   perform public.consume_food_inventory(v_inv.id,v_delta,v_plan.unit,v_inv.quantity);
  elsif v_delta<0 then
   insert into public.food_inventory_lots(user_id,inventory_id,product_id,
      opened_packages,opened_remaining_quantity,opened_remaining_unit,package_quantity,package_unit,source,note)
   values(v_user,v_inv.id,v_plan.product_id,1,-v_delta,v_plan.unit,-v_delta,v_plan.unit,
      'manual','Differenz-Rückbuchung eines bestätigten Genuss-Extras');
   perform public.adjust_food_inventory(v_inv.id,v_inv.quantity-v_delta,'Genuss-Extra Menge korrigiert',null);
  end if;
 end if;
 if v_plan.status='confirmed' then
   update public.food_extra_consumptions e set
     quantity=p_quantity,
     calories_kcal=case when v_plan.calories_kcal is null then null else round(v_plan.calories_kcal*v_ratio,2) end,
     protein_g=case when v_plan.protein_g is null then null else round(v_plan.protein_g*v_ratio,2) end,
     carbohydrates_g=case when v_plan.carbohydrates_g is null then null else round(v_plan.carbohydrates_g*v_ratio,2) end,
     fat_g=case when v_plan.fat_g is null then null else round(v_plan.fat_g*v_ratio,2) end,
     caffeine_mg=case when v_plan.caffeine_mg is null then null else round(v_plan.caffeine_mg*v_ratio,2) end,
     updated_at=now()
   where e.id=v_plan.confirmed_extra_id and e.user_id=v_user and
     e.source_reference='food-planned-extra-v1-'||v_plan.id::text
   returning id into v_extra_id;
   if v_extra_id is null then raise exception 'Verzehrbuchung nicht vorhanden; Änderung abgebrochen';end if;
 end if;
 update public.food_planned_extras p set
   quantity=p_quantity,
   calories_kcal=case when p.calories_kcal is null then null else round(p.calories_kcal*v_ratio,2) end,
   protein_g=case when p.protein_g is null then null else round(p.protein_g*v_ratio,2) end,
   carbohydrates_g=case when p.carbohydrates_g is null then null else round(p.carbohydrates_g*v_ratio,2) end,
   fat_g=case when p.fat_g is null then null else round(p.fat_g*v_ratio,2) end,
   caffeine_mg=case when p.caffeine_mg is null then null else round(p.caffeine_mg*v_ratio,2) end,
   note=case when v_plan.unit='Portion' and v_plan.note like '%Beutel%'
     then regexp_replace(v_plan.note, '^[0-9]+ Beutel \([0-9]+ g\)',
        trim(to_char(p_quantity,'FM999999990'))||' Beutel ('||trim(to_char(p_quantity*7,'FM999999990'))||' g)')
     else v_plan.note end,
   updated_at=now()
 where p.id=v_plan.id;
 return v_extra_id;
end $$;
revoke all on function public.edit_food_planned_extra_v1(uuid,numeric) from public;
grant execute on function public.edit_food_planned_extra_v1(uuid,numeric) to authenticated;