-- Preserve explicit new purchase variants at save time.
CREATE OR REPLACE FUNCTION public.food_explicit_recipe_stock_v937(p_name text, p_label text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
select case
when lower(btrim(coalesce(p_name,''))) in ('wraps','tortilla wraps vollkorn','tortilla-wraps vollkorn','wraps, vollkorn','karotten-wraps · edeka herzstücke','rote-bete-wraps · edeka herzstücke','wraps, karotte','wraps, rote bete') then
 case when concat_ws(' ',p_name,p_label) ~* 'nach MHD|Sorte aus Vorrat' then null
 when concat_ws(' ',p_name,p_label) ~* 'vollkorn' then 'Tortilla Wraps Vollkorn'
 when concat_ws(' ',p_name,p_label) ~* 'karotten|wraps, karotte' then 'Karotten-Wraps · EDEKA Herzstücke'
 when concat_ws(' ',p_name,p_label) ~* 'rote.bete' then 'Rote-Bete-Wraps · EDEKA Herzstücke' end
when lower(btrim(coalesce(p_name,''))) in ('mais','mais dose','mais, konserve','sonnenmais konserve') and concat_ws(' ',p_name,p_label) ~* 'konserve|dose' then 'Sonnenmais Konserve'
when lower(btrim(coalesce(p_name,''))) in ('champignons','champignons braun','champignons, braun, frisch','champignons, braun') and concat_ws(' ',p_name,p_label) ~* 'braun' then 'Champignons braun'
when lower(btrim(coalesce(p_name,''))) in ('chio dip salsa','chio dip mild salsa','chio dip hot salsa','salsa mild','salsa scharf','salsa, mild','salsa, scharf') then
 case when concat_ws(' ',p_name,p_label) ~* 'mild' then 'Chio Dip Mild Salsa'
 when concat_ws(' ',p_name,p_label) ~* 'scharf|hot' then 'Chio Dip Hot Salsa' end
when lower(btrim(coalesce(p_name,''))) in ('feta / hirtenkäse','feta / hirtenkäse leicht','hirtenkäse','hirtenkäse leicht','hirtenkäse, leicht','hirtenkäse normal','hirtenkäse, normal') then
 case when concat_ws(' ',p_name,p_label) ~* 'leicht|light|fettreduziert|27 %' then 'Hirtenkäse'
 when concat_ws(' ',p_name,p_label) ~* 'normal|45 %' then 'Hirtenkäse normal' end
when lower(btrim(coalesce(p_name,''))) in ('schnittkäse','käseaufschnitt leicht','schnittkäse, fettreduziert') and concat_ws(' ',p_name,p_label) ~* 'leicht|fettreduziert' then 'Käseaufschnitt leicht'
when lower(btrim(coalesce(p_name,''))) in ('gefüllte teigwaren','gyoza kimchi & hähnchen tk','gyoza, kimchi & hähnchen, tiefgekühlt') and concat_ws(' ',p_name,p_label) ~* 'gyoza' and concat_ws(' ',p_name,p_label) ~* 'kimchi' and concat_ws(' ',p_name,p_label) ~* 'hähnchen|chicken' then 'Gyoza Kimchi & Hähnchen TK'
when lower(btrim(coalesce(p_name,''))) in ('brokkoli tk','brokkoli, tiefgekühlt','tk brokkoli') then 'Brokkoli TK'
when lower(btrim(coalesce(p_name,'')))='glasnudeln' and p_label ~* 'erbsen.*mungobohnenstärke' then 'Glasnudeln'
end
$function$
;
