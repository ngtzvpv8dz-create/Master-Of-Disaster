CREATE OR REPLACE FUNCTION public.food_is_to_taste_seasoning(p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public','pg_temp' AS $function$
 SELECT lower(btrim(coalesce(p_name,''))) ~
 '^(salz|meersalz|steinsalz|pfeffer|chili|cayenne|paprikapulver|paprika edelsüß|paprika rosenscharf|oregano|thymian|rosmarin|basilikum|zimt|kreuzkümmel|kumin|cumin|kurkuma|garam masala|ras el hanout|sumach|za.atar|koriander gemahlen|muskat|fenchelsamen|piment|nelken|currypulver|curry|gewürzmischung|italienische kräuter|provence kräuter)([[:space:]]|$)'
 OR lower(btrim(coalesce(p_name,''))) IN ('bunter pfeffer','chiliflocken','chilipulver','ingwer gemahlen','knoblauchgranulat','knoblauchpulver','kräuter der provence','minze','minze getrocknet','getrocknete minze','muskatnuss','petersilie','dill','safran','schnittlauch');
$function$;
