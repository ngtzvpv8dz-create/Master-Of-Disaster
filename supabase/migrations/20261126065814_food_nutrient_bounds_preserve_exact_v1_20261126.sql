-- Schema-only mirror of the applied migration. Account-specific data repairs are intentionally not in this public repository.
create or replace function public.food_nutrient_range_v1(p_profile jsonb,p_key text,p_factor numeric default 1)
returns jsonb language sql immutable set search_path to pg_catalog as $$
with v as (
 select case when jsonb_typeof(p_profile->p_key)='number' then (p_profile->>p_key)::numeric
 when p_key='energy_kcal' and jsonb_typeof(p_profile->'calories_kcal')='number' then (p_profile->>'calories_kcal')::numeric
 when p_key='carbohydrates_g' and jsonb_typeof(p_profile->'carbs_g')='number' then (p_profile->>'carbs_g')::numeric end as exact,
 case when jsonb_typeof(p_profile->(p_key||'_lt'))='number' then (p_profile->>(p_key||'_lt'))::numeric
 when p_key='protein_g' and jsonb_typeof(p_profile->'protein_upper_bound_g_per_100_g')='number' then (p_profile->>'protein_upper_bound_g_per_100_g')::numeric end as bound
)
select case when p_factor is null or p_factor<0 or p_factor::text in ('NaN','Infinity','-Infinity') then jsonb_build_object('status','unknown')
 when exact>=0 then jsonb_build_object('status','exact','value',exact*p_factor,'min',exact*p_factor,'max',exact*p_factor)
 when bound>0 then jsonb_build_object('status','upper_bound','min',0,'max',bound*p_factor,'max_exclusive',p_factor>0)
 else jsonb_build_object('status','unknown') end from v
$$;

create or replace function public.food_product_guard_nutrition()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
declare v_old jsonb; v_new jsonb; v_key text; v_new_kcal jsonb; v_old_kcal jsonb;
begin
 v_new:=coalesce(new.nutrition_per_100,'{}'::jsonb);
 if v_new ? 'calories_kcal' and not v_new ? 'energy_kcal' then v_new:=v_new||jsonb_build_object('energy_kcal',v_new->'calories_kcal'); end if;
 if v_new ? 'energy_kcal' and not v_new ? 'calories_kcal' then v_new:=v_new||jsonb_build_object('calories_kcal',v_new->'energy_kcal'); end if;
 if v_new ? 'carbs_g' and not v_new ? 'carbohydrates_g' then v_new:=v_new||jsonb_build_object('carbohydrates_g',v_new->'carbs_g'); end if;
 if tg_op='UPDATE' then
   v_old:=coalesce(old.nutrition_per_100,'{}'::jsonb);
   if (v_old->>'basis') is not distinct from (v_new->>'basis') or not v_new ? 'basis' then
     if v_old ? 'basis' and not v_new ? 'basis' then v_new:=v_new||jsonb_build_object('basis',v_old->'basis'); end if;
     foreach v_key in array array['energy_kcal','calories_kcal','protein_g','fat_g','carbohydrates_g','energy_kj','carbs_g','saturated_fat_g','sugars_g','fiber_g','salt_g','calcium_mg','protein_upper_bound_g_per_100_g','protein_g_lt','fat_g_lt','saturated_fat_g_lt','sugars_g_lt','fiber_g_lt','salt_g_lt','carbohydrates_g_lt'] loop
       if v_old->>v_key is not null and v_new->>v_key is null then
         if v_key in ('protein_g','fat_g','carbohydrates_g','saturated_fat_g','sugars_g','fiber_g','salt_g') and (v_new->>(v_key||'_lt') is not null or (v_key='protein_g' and v_new->>'protein_upper_bound_g_per_100_g' is not null)) then continue; end if;
         v_new:=v_new||jsonb_build_object(v_key,v_old->v_key);
       end if;
     end loop;
   end if;
 end if;
 if jsonb_typeof(v_new->'protein_g_lt')='number' and v_new->>'protein_upper_bound_g_per_100_g' is null and coalesce(v_new->>'basis','') in ('per_100_g','per_100g','100_g','100g') then
  v_new:=v_new||jsonb_build_object('protein_upper_bound_g_per_100_g',v_new->'protein_g_lt');
 end if;
 new.nutrition_per_100:=v_new;
 new.product_data:=coalesce(new.product_data,'{}'::jsonb)||jsonb_build_object('nutrition_review_needed',
   public.food_nutrient_range_v1(v_new,'energy_kcal')->>'status'='unknown'
   or public.food_nutrient_range_v1(v_new,'protein_g')->>'status'='unknown'
   or coalesce(new.product_data->>'nutrition_provisional','false')='true');
 return new;
end $$;

create or replace function public.food_checkout_record_nutrition_status()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
declare v_prod public.shopping_products%rowtype; v_state text; v_kcal text; v_protein text;
begin
 if new.product_id is null then v_state:='needs_product_assignment';
 else
  select * into v_prod from public.shopping_products where id=new.product_id and user_id=new.user_id;
  if not found then v_state:='unknown_product';
  elsif v_prod.category in ('Haushalt','Drogerie','Tierfutter') then v_state:='not_food';
  else
    v_kcal:=public.food_nutrient_range_v1(v_prod.nutrition_per_100,'energy_kcal')->>'status';
    v_protein:=public.food_nutrient_range_v1(v_prod.nutrition_per_100,'protein_g')->>'status';
    if v_kcal='unknown' then v_state:='missing_kcal';
    elsif v_protein='upper_bound' then v_state:='protein_bound_only';
    elsif v_protein='unknown' then v_state:='missing_protein';
    else v_state:='complete'; end if;
  end if;
 end if;
 new.purchase_data:=coalesce(new.purchase_data,'{}'::jsonb)||jsonb_build_object('nutrition_intake_status',v_state,'nutrition_intake_checked_at',now());
 return new;
end $$;

do $$ begin
 if public.food_nutrient_range_v1('{"fat_g_lt":0.5}'::jsonb,'fat_g',0.5) <> '{"status":"upper_bound","min":0,"max":0.25,"max_exclusive":true}'::jsonb then raise exception 'bound test failed'; end if;
 if public.food_nutrient_range_v1('{"salt_g":0.01}'::jsonb,'salt_g',5)->>'value' <> '0.05' then raise exception 'decimal test failed'; end if;
 if public.food_nutrient_range_v1('{}'::jsonb,'fat_g')->>'status' <> 'unknown' then raise exception 'missing test failed'; end if;
end $$;
