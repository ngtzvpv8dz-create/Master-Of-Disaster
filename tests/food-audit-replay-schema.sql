-- Isolated synthetic database schema; no production access.
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.food_meals(id uuid,user_id uuid,meal_date date,status text,title text,inventory_booked_at timestamptz,recipe_id uuid,prepared_servings numeric NOT NULL DEFAULT 1,eaten_servings numeric NOT NULL DEFAULT 1);
CREATE TABLE public.food_meal_ingredients(id uuid,user_id uuid,meal_id uuid,inventory_id uuid,eaten_only_extra boolean,name text,label text,quantity numeric,quantity_confirmed boolean,unit text);
CREATE TABLE public.food_inventory(id uuid,user_id uuid,name text,family_name text,unit text,is_active boolean,quantity numeric,pending_weighing boolean);
CREATE TABLE public.food_inventory_movements(meal_id uuid,user_id uuid,inventory_id uuid,kind text,delta numeric);
CREATE TABLE public.shopping_products(id uuid,user_id uuid,inventory_id uuid,active boolean,category text,nutrition_per_100 jsonb,product_data jsonb,product_name text);
CREATE TABLE public.food_recipes(id uuid,user_id uuid,active boolean,title text,calories_kcal_per_serving numeric,protein_g_per_serving numeric,carbs_g_per_serving numeric,fat_g_per_serving numeric);
CREATE TABLE public.food_extra_consumptions(id uuid,user_id uuid,consumption_date date,title text,calories_kcal numeric,protein_g numeric,carbohydrates_g numeric,fat_g numeric);
CREATE TABLE public.food_recipe_ingredients(id uuid,user_id uuid,recipe_id uuid,name text,label text,quantity numeric,unit text);
CREATE TABLE public.food_inventory_lots(id uuid,user_id uuid,opened_remaining_quantity numeric,package_quantity numeric,servings_per_package numeric);
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['food_meals','food_meal_ingredients','food_inventory','food_inventory_movements','shopping_products','food_recipes','food_extra_consumptions','food_recipe_ingredients','food_inventory_lots'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING (user_id = nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid)',t);
 END LOOP;
END $$;
