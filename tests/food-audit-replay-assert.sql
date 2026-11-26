-- Synthetic exact, bounded, missing, null and negative values.
INSERT INTO public.food_inventory(id,user_id,name,unit,is_active,quantity,pending_weighing)
SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0001-000000000001','Fixture '||n,'g',true,100,false FROM generate_series(1,5) n;
INSERT INTO public.shopping_products(id,user_id,inventory_id,active,category,nutrition_per_100,product_data,product_name)
SELECT ('00000000-0000-0000-0002-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0001-000000000001',('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,true,'Food',profile,'{}','Fixture '||n FROM (VALUES
(1,'{"energy_kcal":0,"protein_g":0,"fat_g":0,"carbohydrates_g":0}'::jsonb),
(2,'{"energy_kcal":40,"protein_g_lt":0.5,"fat_g_lt":0.1,"carbohydrates_g":8}'::jsonb),
(3,'{"energy_kcal":40,"fat_g":0,"carbohydrates_g":8}'::jsonb),
(4,'{"energy_kcal":40,"protein_g":null,"fat_g":0,"carbohydrates_g":8}'::jsonb),
(5,'{"energy_kcal":40,"protein_g":-1,"fat_g":0,"carbohydrates_g":8}'::jsonb)) AS p(n,profile);
-- Static recipe macros may be NULL; only real input gaps belong to SQL audit.
INSERT INTO public.food_recipes(id,user_id,active,title) VALUES
 ('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0001-000000000001',true,'Dynamic complete'),
 ('00000000-0000-0000-0003-000000000002','00000000-0000-0000-0001-000000000001',true,'Missing amount'),
 ('00000000-0000-0000-0003-000000000003','00000000-0000-0000-0001-000000000001',true,'Missing ingredients'),
 ('00000000-0000-0000-0003-000000000004','00000000-0000-0000-0001-000000000001',true,'Skipped recipe');
INSERT INTO public.food_meals(id,user_id,recipe_id,meal_date,status,title)
SELECT ('00000000-0000-0000-0004-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0001-000000000001',
 ('00000000-0000-0000-0003-'||lpad(n::text,12,'0'))::uuid,
 date '2026-01-01',case when n=4 then 'skipped' else 'planned' end,'Meal '||n FROM generate_series(1,4) n;
INSERT INTO public.food_recipe_ingredients(id,user_id,recipe_id,name,quantity,unit) VALUES
 ('00000000-0000-0000-0005-000000000001','00000000-0000-0000-0001-000000000001','00000000-0000-0000-0003-000000000001','Known ingredient',100,'g'),
 ('00000000-0000-0000-0005-000000000002','00000000-0000-0000-0001-000000000001','00000000-0000-0000-0003-000000000002','Unknown quantity',NULL,'g');
DO $ DECLARE t text; c text; v text; expected boolean; accepted boolean; n integer:=0; BEGIN
 FOR t,c,v,expected IN SELECT * FROM (VALUES
 ('food_inventory','quantity','-1',false),('food_inventory','quantity','NaN',false),('food_inventory','quantity','Infinity',false),('food_inventory','quantity','-Infinity',false),('food_inventory','quantity','0',true),('food_inventory','quantity','12.5',true),('food_inventory','quantity','NULL',true),
 ('food_recipe_ingredients','quantity','-1',false),('food_recipe_ingredients','quantity','0',false),('food_recipe_ingredients','quantity','NaN',false),('food_recipe_ingredients','quantity','Infinity',false),('food_recipe_ingredients','quantity','0.25',true),('food_recipe_ingredients','quantity','NULL',true),
 ('food_meal_ingredients','quantity','-1',false),('food_meal_ingredients','quantity','0',false),('food_meal_ingredients','quantity','NaN',false),('food_meal_ingredients','quantity','Infinity',false),('food_meal_ingredients','quantity','0.25',true),('food_meal_ingredients','quantity','NULL',true),
 ('food_inventory_lots','opened_remaining_quantity','-1',false),('food_inventory_lots','opened_remaining_quantity','NaN',false),('food_inventory_lots','opened_remaining_quantity','Infinity',false),('food_inventory_lots','opened_remaining_quantity','0',true),
 ('food_inventory_lots','package_quantity','0',false),('food_inventory_lots','package_quantity','-1',false),('food_inventory_lots','package_quantity','NaN',false),('food_inventory_lots','package_quantity','Infinity',false),('food_inventory_lots','package_quantity','12.5',true),
 ('food_inventory_lots','servings_per_package','NaN',false),('food_inventory_lots','servings_per_package','Infinity',false),('food_inventory_lots','servings_per_package','0.5',true),
 ('food_meals','prepared_servings','NaN',false),('food_meals','eaten_servings','NaN',false)) x(t,c,v,expected)
 LOOP
  accepted:=true;
  BEGIN
   EXECUTE format('INSERT INTO public.%I (%I) VALUES (%s)',t,c,case when v='NULL' then 'NULL' else quote_literal(v)||'::numeric' end);
  EXCEPTION WHEN check_violation THEN accepted:=false;
  END;
  IF accepted IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Unexpected quantity guard: % % %',t,c,v; END IF;
  n:=n+1;
 END LOOP;
 RAISE NOTICE 'Direct quantity guard: % cases PASS',n;
END $;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0001-000000000001',false);
DO $$ DECLARE actual text[]; BEGIN
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'wrong test role'; END IF;
 SELECT array_agg(e->>'label' ORDER BY e->>'label') INTO actual FROM jsonb_array_elements(public.collect_food_audit_issues('00000000-0000-0000-0001-000000000001',date '2026-01-01')) e WHERE e->>'kind'='nutrition_product_incomplete';
 IF actual IS DISTINCT FROM ARRAY['Fixture 3','Fixture 4','Fixture 5'] THEN RAISE EXCEPTION 'Unexpected audit alerts: %',actual; END IF;
 IF public.food_nutrient_range_v1('{"protein_g_lt":0.5}'::jsonb,'protein_g',1)->>'status'<>'upper_bound' THEN RAISE EXCEPTION 'bound lost'; END IF;
 IF public.food_nutrient_range_v1('{"protein_g":0}'::jsonb,'protein_g',1)->>'status'<>'exact' THEN RAISE EXCEPTION 'exact zero lost'; END IF;
 IF public.collect_food_audit_issues('00000000-0000-0000-0001-000000000002',date '2026-01-01') <> '[]'::jsonb THEN RAISE EXCEPTION 'cross-user rows visible'; END IF;
 SELECT array_agg(e->>'label' ORDER BY e->>'label') INTO actual FROM jsonb_array_elements(public.collect_food_audit_issues('00000000-0000-0000-0001-000000000001',date '2026-01-01')) e WHERE e->>'kind'='recipe_inputs_incomplete';
 IF actual IS DISTINCT FROM ARRAY['Missing amount','Missing ingredients'] THEN RAISE EXCEPTION 'Unexpected recipe input alerts: %',actual; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.collect_food_audit_issues('00000000-0000-0000-0001-000000000001',date '2026-01-01')) e WHERE e->>'kind'='recipe_nutrition_incomplete') THEN RAISE EXCEPTION 'Legacy static warning returned'; END IF;
 RAISE NOTICE 'SQL audit: optional static macros, real input gaps and skipped recipe PASS';
 RAISE NOTICE 'Authenticated migration replay: exact, upper-bound, unknown, null, negative, isolation PASS';
END $$;
RESET ROLE;
