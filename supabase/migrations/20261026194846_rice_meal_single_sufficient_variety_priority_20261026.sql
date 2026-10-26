
do $outer$
declare
  v_def text;
  v_anchor text:=E'        order by\n          -- Only suitable fresh produce is used before frozen alternatives.';
  v_sort text:=$sort$
        order by
          -- mod_reis_single_variety_20261026: bevorzugt eine ausreichende
          -- einzelne Sorte, um unterschiedliche Kochzeiten nicht zu mischen.
          case
            when lower(btrim(coalesce(v_requested_family,'')))='reis'
             and food_inventory.quantity<v_ing.quantity then 1
            else 0
          end,
          -- Original-Reissorte nur bevorzugen, falls sie allein genügt.
          case
            when lower(btrim(coalesce(v_requested_family,'')))='reis'
             and (
               (lower(coalesce(v_ing.label,'')) like '%naturreis%' and lower(food_inventory.name) not like '%naturreis%')
               or (lower(coalesce(v_ing.label,'')) like '%langkorn%' and lower(food_inventory.name) not like '%langkorn%')
               or (lower(coalesce(v_ing.label,'')) like '%parboiled%' and lower(food_inventory.name) not like '%parboiled%')
               or (lower(coalesce(v_ing.label,'')) like '%basmati%' and lower(food_inventory.name) not like '%basmati%')
               or (lower(coalesce(v_ing.label,'')) like '%jasmin%' and lower(food_inventory.name) not like '%jasmin%')
             ) then 1
            else 0
          end,
          -- Only suitable fresh produce is used before frozen alternatives.
$sort$;
begin
  select pg_get_functiondef('public.complete_food_meal_core_wholepack(uuid)'::regprocedure) into v_def;
  if strpos(v_def,'mod_reis_single_variety_20261026')=0 then
    if strpos(v_def,v_anchor)=0 then
      raise exception 'Unbekannte Kochbuchungslogik, Sortieranker fehlt';
    end if;
    execute replace(v_def,v_anchor,v_sort);
  end if;
end $outer$;
