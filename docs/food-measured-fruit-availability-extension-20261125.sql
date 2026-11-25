-- REVIEW ONLY. Install before the seven measured-fruit candidates, together in one transaction.
-- Existing mango and lime single-piece records are not reconstructed from product averages.
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.food_available_measured_whole_pieces(uuid)'::regprocedure))<>'432afc99583ca8b92a40c6f8fc710aee' THEN RAISE EXCEPTION 'Measured piece source changed';END IF;END $guard$;
INSERT INTO mod_ingredient_import_20261125.nutrition_function_backup(function_name,definition) VALUES('food_available_measured_whole_pieces_pre_fruit_extension',pg_get_functiondef('public.food_available_measured_whole_pieces(uuid)'::regprocedure));
CREATE OR REPLACE FUNCTION public.food_available_measured_whole_pieces(p_inventory_id uuid)
 RETURNS TABLE(piece_id uuid, lot_id uuid, product_id uuid, piece_index integer, gross_weight_g numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 WITH stock AS (
 SELECT f.id,f.user_id,f.quantity FROM public.food_inventory f
 WHERE f.id=p_inventory_id AND f.user_id=auth.uid() AND f.is_active AND f.unit='Stück'
 AND f.quantity>0 AND f.family_name IN ('Avocado','Apfel','Banane','Mango','Limette','Paprika rot','Paprika grün','Paprika gelb')
 ), active_lots AS (
 SELECT l.id,l.inventory_id,l.user_id,l.product_id,
 coalesce(l.unopened_packages,0)*coalesce(l.package_quantity,0)+coalesce(l.opened_remaining_quantity,0) qty,
 (l.package_unit='Stück' AND l.package_quantity>=1 AND l.package_quantity=trunc(l.package_quantity) AND (coalesce(l.opened_remaining_quantity,0)=0 OR l.opened_remaining_unit='Stück')) valid_unit
 FROM stock f JOIN public.food_inventory_lots l ON l.inventory_id=f.id AND l.user_id=f.user_id
 WHERE coalesce(l.unopened_packages,0)>0 OR coalesce(l.opened_remaining_quantity,0)>0
 ), measured AS (
 SELECT p.id,p.lot_id,l.product_id,p.piece_index,p.weight_g
 FROM active_lots l JOIN public.food_inventory_pieces p ON p.lot_id=l.id AND p.inventory_id=l.inventory_id AND p.user_id=l.user_id
 WHERE p.status='whole' AND p.weight_source='user_scale' AND p.weight_g>0 AND p.remaining_weight_g=p.weight_g
 ), complete AS (
 SELECT l.id FROM active_lots l
 WHERE l.valid_unit AND l.qty=trunc(l.qty) AND l.product_id IS NOT NULL
 AND EXISTS (SELECT 1 FROM public.shopping_products p WHERE p.id=l.product_id AND p.user_id=l.user_id AND p.inventory_id=l.inventory_id)
 AND l.qty=(SELECT count(*) FROM measured m WHERE m.lot_id=l.id)
 AND NOT EXISTS (SELECT 1 FROM public.food_inventory_pieces p WHERE p.lot_id=l.id AND p.user_id=l.user_id AND p.inventory_id=l.inventory_id AND p.status='partial')
 )
 SELECT m.id,m.lot_id,m.product_id,m.piece_index,m.weight_g FROM measured m
 JOIN complete c ON c.id=m.lot_id
 WHERE (SELECT sum(qty) FROM active_lots)=(SELECT quantity FROM stock)
 AND (SELECT count(*) FROM complete)=(SELECT count(*) FROM active_lots)
 ORDER BY m.lot_id,m.piece_index,m.id
$function$
;
-- Only fill an existing single whole lime with an explicitly recorded gross physical weight.
INSERT INTO public.food_inventory_pieces(user_id,inventory_id,lot_id,piece_index,produce_kind,color,weight_g,remaining_weight_g,status,weight_source,measured_on,note)
SELECT f.user_id,f.id,l.id,1,'lime','grün',(l.batch_data->>'reported_weight_gross_g')::numeric,(l.batch_data->>'reported_weight_gross_g')::numeric,'whole','user_scale',l.purchased_on,'Verifiziertes Bruttogewicht der vorhandenen Einzelcharge; kein neuer Einkauf'
FROM public.food_inventory f JOIN public.food_inventory_lots l ON l.inventory_id=f.id AND l.user_id=f.user_id
JOIN public.shopping_products p ON p.id=l.product_id AND p.user_id=f.user_id AND p.inventory_id=f.id
WHERE f.is_active AND f.family_name='Limette' AND f.unit='Stück' AND f.quantity=1 AND l.package_unit='Stück' AND l.package_quantity=1 AND l.unopened_packages=1 AND coalesce(l.opened_remaining_quantity,0)=0 AND l.purchased_on IS NOT NULL
AND l.batch_data->>'weight_kind'='gross_including_peel' AND l.batch_data->>'verified_photograph'='true' AND jsonb_typeof(l.batch_data->'reported_weight_gross_g')='number' AND (l.batch_data->>'reported_weight_gross_g')::numeric>0
AND (SELECT count(*) FROM public.food_inventory_lots x WHERE x.inventory_id=f.id AND x.user_id=f.user_id AND (x.unopened_packages>0 OR coalesce(x.opened_remaining_quantity,0)>0))=1
AND NOT EXISTS(SELECT 1 FROM public.food_inventory_pieces x WHERE x.lot_id=l.id);
