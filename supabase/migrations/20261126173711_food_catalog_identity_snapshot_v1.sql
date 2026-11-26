CREATE OR REPLACE FUNCTION public.food_catalog_identity_snapshot_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object(
   'identities', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
      SELECT source_name,inventory_id,canonical_name,family_name,resolution
      FROM public.food_catalog_recipe_identity_v1 WHERE user_id=(SELECT auth.uid())
      ORDER BY source_name,inventory_id LIMIT 25001
   ) x),'[]'::jsonb),
   'positions', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
      SELECT ingredient_id,original_name,canonical_name,family_name,resolution
      FROM public.food_catalog_recipe_positions_v1 WHERE user_id=(SELECT auth.uid())
      ORDER BY ingredient_id LIMIT 25001
   ) x),'[]'::jsonb)
 );
$function$;
REVOKE ALL ON FUNCTION public.food_catalog_identity_snapshot_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.food_catalog_identity_snapshot_v1() TO authenticated;
