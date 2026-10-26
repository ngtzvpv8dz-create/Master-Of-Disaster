
-- Reis-Kataloghierarchie und trockene, als Beilage austauschbare Reissorten.
-- Express-/gewürzter Fertigreis bleibt weiterhin eine getrennte Verbrauchsfamilie.
insert into public.food_ingredient_families (user_id,name,notes)
select distinct user_id,'Reis','Produktfamilie für Reissorten. Als trockene Beilage austauschbar: Natur-, Langkorn-, Parboiled-, Basmati- und Jasminreis. Express-, Milch-, Sushi- und Risottoreis nur bei passender Zubereitung ersetzen.'
from public.food_inventory
where lower(name) in ('reis-fit naturreis','langkornreis','parboiled spitzenreis','basmati reis')
on conflict (user_id,name) do update set notes=excluded.notes,updated_at=now();

update public.food_inventory
set family_name='Reis',
    catalog_family_name='Reis',
    catalog_group_label=case
      when lower(name)='reis-fit naturreis' then 'Naturreis'
      when lower(name)='langkornreis' then 'Langkornreis'
      when lower(name)='parboiled spitzenreis' then 'Parboiled Reis'
      when lower(name)='basmati reis' then 'Basmati-Reis'
      else catalog_group_label end,
    updated_at=now()
where lower(name) in ('reis-fit naturreis','langkornreis','parboiled spitzenreis','basmati reis')
  and is_active=true;

update public.food_inventory
set catalog_family_name='Reis',
    catalog_group_label=case
      when name ilike 'Express-Reis%' or name='Burrito-Bowl' then 'Expressreis'
      else catalog_group_label end,
    updated_at=now()
where is_active=true
  and (lower(name) like 'express-reis%' or lower(name)='burrito-bowl')
  and (catalog_family_name is distinct from 'Reis' or catalog_group_label is distinct from 'Expressreis');

-- Bestehende Synonyme von getrennten trockenen Reisfamilien zur neuen Basisfamilie umhängen.
update public.food_ingredient_family_terms t
set family_id=target.id
from public.food_ingredient_families old_family,
     public.food_ingredient_families target
where t.family_id=old_family.id
  and target.user_id=t.user_id and target.name='Reis'
  and old_family.user_id=t.user_id
  and old_family.name in ('Naturreis','reis-fit Naturreis','Langkornreis','Parboiled Reis','Basmati Reis');

insert into public.food_ingredient_family_terms(user_id,term,unit,family_id,origin)
select f.user_id,v.term,'g',f.id,'family'
from public.food_ingredient_families f
cross join (values
('Reis'),('Naturreis'),('Natur-Reis'),('Langkornreis'),('Langkorn-Spitzenreis'),('Parboiled Reis'),
('Parboiled Spitzenreis'),('Basmati Reis'),('Basmati-Reis'),('Basmatireis'),('Jasminreis'),
('Jasmin-Reis'),('reis-fit Naturreis')
) as v(term)
where f.name='Reis'
on conflict (user_id,term,unit) do update set family_id=excluded.family_id;

-- Rezepte behalten den ursprünglichen Sortenwunsch im sichtbaren Label.
update public.food_recipe_ingredients ri
set name='Reis',
    label=case
      when position(lower(ri.name) in lower(coalesce(ri.label,'')))>0 then ri.label
      else trim(coalesce(nullif(ri.label,''),public.food_quantity_label(ri.quantity,ri.unit)||' Reis trocken'))||' · bevorzugt '||ri.name
    end,
    inventory_id=null
where lower(ri.name) in ('naturreis','langkornreis','parboiled reis','basmati reis')
  and ri.unit='g';

-- Geplante Zutaten sind generisch, aber der bevorzugte Sortenname bleibt ablesbar.
update public.food_meal_ingredients i
set name='Reis',
    label=case
      when position(lower(i.name) in lower(coalesce(i.label,'')))>0 then i.label
      else trim(coalesce(nullif(i.label,''),public.food_quantity_label(i.quantity,i.unit)||' Reis trocken'))||' · bevorzugt '||i.name
    end,
    inventory_id=null
from public.food_meals m
where i.meal_id=m.id and m.status='planned'
  and lower(i.name) in ('naturreis','langkornreis','parboiled reis','basmati reis')
  and i.unit='g' and i.allocation_override is null;

-- Konkrete Lösung für das Abendessen: 85 g bereits geöffneter Langkornreis,
-- statt ungleich garende 80 g Naturreis und 5 g Langkornreis zu mischen.
update public.food_meal_ingredients
set name='Reis',
    label='85 g Reis trocken · heute Langkornreis statt Naturreis',
    inventory_id=null,
    allocation_override=jsonb_build_array(jsonb_build_object(
      'inventory_id',(select id from public.food_inventory where name='Langkornreis' and is_active=true and quantity>=85 order by id limit 1),
      'quantity',85,'unit','g','label','Langkornreis','frozen',false))
where id='c1e976f1-52ef-41b5-9871-1399ad41c213'
  and quantity=85 and unit='g'
  and exists (select 1 from public.food_meals m where m.id=meal_id and m.status='planned')
  and exists (select 1 from public.food_inventory f where f.name='Langkornreis' and f.is_active=true and f.quantity>=85);

update public.food_meal_ingredients
set label='Wasser je nach gewählter Reissorte und Packungsanleitung (für Naturreis bisher 170 ml)'
where id='15030d1d-2eba-4fd9-bc40-062af6e8e2bb'
  and exists (select 1 from public.food_meals m where m.id=meal_id and m.status='planned');

update public.food_recipes
set instructions=replace(
    replace(instructions,
      '85 g Naturreis trocken abwiegen; 170 ml Wasser sind ausschließlich für diesen Reis vorgesehen.',
      '85 g trockenen Reis abwiegen; Naturreis ist die Wunschvariante, bei Fehlmenge Langkorn- oder Parboiled-Reis nehmen. Wassermenge und Garzeit nach Packungsanleitung der gewählten Sorte bestimmen.'),
      'Den Reis mit den 170 ml Wasser zugedeckt nach Packungszeit weich garen.',
      'Den Reis mit der zur gewählten Sorte passenden Wassermenge zugedeckt nach Packungsanleitung garen.'),
    updated_at=now()
where id='32e2f8a1-2f28-4301-b3c8-c13b5c160067'
  and instructions like '%85 g Naturreis trocken abwiegen;%';

delete from public.food_ingredient_families f
where f.name in ('Naturreis','reis-fit Naturreis','Langkornreis','Parboiled Reis','Basmati Reis')
  and not exists (select 1 from public.food_ingredient_family_terms t where t.family_id=f.id);

-- Familienregel für künftige neu hinzugefügte Produkte und Zutaten. Keine Fertiggerichte,
-- kein Risotto-/Sushi-/Milchreis und keine Reisnudeln/-waffeln/-essige als generische Beilage.
do $outer$
declare
  v_def text;
  v_anchor text := 'if n='''''||' then return null; end if;';
  v_addition text := $rice$
  -- mod_reis_family_20261026: Standard-Trockenreis über Sorten hinweg gemeinsam zuordnen.
  if n ~ '(naturreis|langkornreis|spitzenreis|basmati|jasminreis|parboiled|wildreis)'
     and n !~ '(express|fertig|gekocht|bowl|risotto|sushi|milchreis|reiswaffel|reisnudel|reisessig)' then
    return 'Reis';
  end if;
$rice$;
begin
 select pg_get_functiondef('public.food_canonical_ingredient_family(text,text)'::regprocedure) into v_def;
 if strpos(v_def,'mod_reis_family_20261026')=0 then
   if strpos(v_def,v_anchor)=0 then raise exception 'Familienfunktion hat unbekannte Struktur'; end if;
   execute replace(v_def,v_anchor,v_anchor||E'\n'||v_addition);
 end if;
end $outer$;

create or replace function public.set_food_inventory_catalog_defaults()
returns trigger language plpgsql set search_path=public,pg_temp as $func$
declare n text:=lower(btrim(coalesce(new.name,'')));
begin
  if n ~ '(naturreis|langkornreis|spitzenreis|basmati|jasminreis|parboiled|wildreis|risottoreis|sushireis|milchreis|express.reis)'
     and n !~ '(reiswaffel|reisnudel|reisessig|reissirup)' then
    new.catalog_family_name:='Reis';
    if nullif(trim(new.catalog_group_label),'') is null then
      new.catalog_group_label:=case
        when n ~ 'express' then 'Expressreis'
        when n ~ 'risotto' then 'Risottoreis'
        when n ~ 'sushi' then 'Sushireis'
        when n ~ 'milchreis' then 'Milchreis'
        when n ~ 'naturreis' then 'Naturreis'
        when n ~ '(parboiled)' then 'Parboiled Reis'
        when n ~ 'basmati' then 'Basmati-Reis'
        when n ~ 'jasmin' then 'Jasminreis'
        when n ~ 'langkorn|spitzenreis' then 'Langkornreis'
        when n ~ 'wildreis' then 'Wildreis'
        else null end;
    end if;
  end if;
  if nullif(trim(new.catalog_family_name),'') is null then
    new.catalog_family_name:=coalesce(nullif(trim(new.family_name),''),new.name);
  end if;
  if nullif(trim(new.catalog_variant_label),'') is null then
    new.catalog_variant_label:=coalesce(nullif(trim(new.variant_label),''),'Standard');
  end if;
  return new;
end;
$func$;
