-- V937: explicit recipe variants are not interchangeable with sibling stock.
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
end
$function$
;

CREATE OR REPLACE FUNCTION public.food_ingredient_dynamic_family()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_family text; v_stock_family text; v_status text; v_name text;
begin
 if nullif(btrim(coalesce(new.name,'')),'') is null then return new; end if;
 if tg_table_name='food_meal_ingredients' then
  -- Do not interfere with the temporary unit conversions inside meal completion.
  if tg_op='UPDATE' and new.unit is distinct from old.unit
     and new.name is not distinct from old.name
     and new.inventory_id is not distinct from old.inventory_id then
    return new;
  end if;
  select status into v_status from public.food_meals where id=new.meal_id and user_id=new.user_id;
  if v_status is distinct from 'planned' then return new; end if;
  if new.allocation_override is not null and new.allocation_override <> '[]'::jsonb then return new; end if;
 end if;
 -- Explicit Miso variants are not interchangeable. Preserve exact inventory linkage.
 if lower(btrim(new.name)) in ('miso-paste hell','misopaste, hell','miso-paste dunkel','misopaste, dunkel') then
   v_name:=case when lower(new.name) like '%hell%' then 'Miso-Paste hell' else 'Miso-Paste dunkel' end;
   select id into new.inventory_id from public.food_inventory
   where user_id=new.user_id and is_active and unit=new.unit and lower(name)=lower(v_name);
   -- A missing inventory row must not block future recipe planning.
   new.name:=v_name;
   return new;
 end if;
 -- Preserve explicitly requested compatible product variants. Generic MHD-based
 -- recipe choices retain the existing family allocation behavior.
 v_name:=public.food_explicit_recipe_stock_v937(new.name,new.label);
 if v_name is not null then
   select id into new.inventory_id from public.food_inventory
   where user_id=new.user_id and is_active and unit=new.unit and lower(name)=lower(v_name);
   new.name:=v_name;
   return new;
 end if;
 if new.inventory_id is not null then
  select family_name into v_stock_family from public.food_inventory
  where id=new.inventory_id and user_id=new.user_id and is_active;
 end if;
 if v_stock_family is not null then
   v_family:=v_stock_family;
 else
   -- Synonyme zuerst normalisieren (Salatgurke→Gurke, Kiwi, Chia Samen usw.).
   v_family:=public.food_canonical_ingredient_family(new.name);
   if v_family is null or lower(btrim(v_family))=lower(btrim(new.name)) then
     select f.name into v_family from public.food_ingredient_family_terms t
     join public.food_ingredient_families f on f.id=t.family_id
     where t.user_id=new.user_id and lower(btrim(t.term))=lower(btrim(new.name))
       and lower(btrim(t.unit))=lower(btrim(coalesce(new.unit,''))) limit 1;
     if v_family is null then v_family:=public.food_canonical_ingredient_family(new.name); end if;
   end if;
 end if;
 if v_family is null then return new; end if;
 v_name:=lower(btrim(new.name));
 if v_family='Spinat' and v_name ~ '(tk|tiefkühl|tiefgefroren)' then v_family:='Spinat TK'; end if;
 if v_family='Spinat' and v_name ~ '(babyspinat|frisch)' then v_family:='Spinat frisch'; end if;
 if v_family='Paprika rot' and v_name ~ '(tk|tiefkühl|gefroren)' then v_family:='Paprika rot TK'; end if;
 if v_family='Eier' and v_name ~ '(größe m|groesse m)' then v_family:='Eier Größe M'; end if;
 if v_family='Eier' and v_name ~ '(größe l|groesse l)' then v_family:='Eier Größe L'; end if;
 if v_family='Feta / Hirtenkäse' and v_name ~ '(light|leicht)' then v_family:='Feta / Hirtenkäse leicht'; end if;
 new.name:=v_family;
 new.inventory_id:=null;
 return new;
end $function$
;
