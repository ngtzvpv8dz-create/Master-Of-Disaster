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
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0001-000000000001',false);
DO $$ DECLARE actual text[]; BEGIN
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'wrong test role'; END IF;
 SELECT array_agg(e->>'label' ORDER BY e->>'label') INTO actual FROM jsonb_array_elements(public.collect_food_audit_issues('00000000-0000-0000-0001-000000000001',date '2026-01-01')) e WHERE e->>'kind'='nutrition_product_incomplete';
 IF actual IS DISTINCT FROM ARRAY['Fixture 3','Fixture 4','Fixture 5'] THEN RAISE EXCEPTION 'Unexpected audit alerts: %',actual; END IF;
 IF public.food_nutrient_range_v1('{"protein_g_lt":0.5}'::jsonb,'protein_g',1)->>'status'<>'upper_bound' THEN RAISE EXCEPTION 'bound lost'; END IF;
 IF public.food_nutrient_range_v1('{"protein_g":0}'::jsonb,'protein_g',1)->>'status'<>'exact' THEN RAISE EXCEPTION 'exact zero lost'; END IF;
 IF public.collect_food_audit_issues('00000000-0000-0000-0001-000000000002',date '2026-01-01') <> '[]'::jsonb THEN RAISE EXCEPTION 'cross-user rows visible'; END IF;
 RAISE NOTICE 'Authenticated migration replay: exact, upper-bound, unknown, null, negative, isolation PASS';
END $$;
RESET ROLE;
