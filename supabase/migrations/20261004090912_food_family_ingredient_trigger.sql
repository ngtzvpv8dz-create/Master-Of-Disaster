-- Familiennamen bleiben generisch und werden vom Auto-Link-Trigger nicht wieder an eine Einzelvariante gepinnt.
CREATE OR REPLACE FUNCTION public.link_food_ingredient_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_inventory public.food_inventory%rowtype;
  v_is_family boolean:=false;
begin
  if new.name is not null then
    select exists(
      select 1
      from public.food_inventory f
      where f.user_id=new.user_id
        and f.is_active=true
        and nullif(trim(f.family_name),'') is not null
        and lower(trim(f.family_name))=lower(trim(new.name))
        and (
          new.unit is null
          or f.unit is null
          or lower(trim(f.unit))=lower(trim(new.unit))
        )
    ) into v_is_family;
  end if;

  if new.inventory_id is null and new.name is not null and not v_is_family then
    new.inventory_id := public.resolve_food_inventory_id(new.user_id, new.name, new.unit);
  end if;

  if new.inventory_id is not null then
    select * into v_inventory
    from public.food_inventory
    where id = new.inventory_id
      and user_id = new.user_id
      and is_active = true;

    if not found then
      raise exception 'Vorratsartikel nicht gefunden';
    end if;

    if nullif(trim(v_inventory.family_name),'') is not null
       and lower(trim(coalesce(new.name,'')))=lower(trim(v_inventory.family_name)) then
      new.inventory_id:=null;
      new.name:=v_inventory.family_name;
    else
      new.name:=v_inventory.name;
    end if;
  end if;

  return new;
end;
$function$


update public.food_recipe_ingredients fri
set name=fi.family_name,
    label=public.food_quantity_label(fri.quantity,fri.unit)||' '||fi.family_name,
    inventory_id=null
from public.food_inventory fi,
     public.food_recipes fr
where fri.inventory_id=fi.id
  and fri.recipe_id=fr.id
  and fr.active=true
  and nullif(trim(fi.family_name),'') is not null;

update public.food_meal_ingredients fmi
set name=fi.family_name,
    label=public.food_quantity_label(fmi.quantity,fmi.unit)||' '||fi.family_name,
    inventory_id=null
from public.food_inventory fi,
     public.food_meals fm
where fmi.inventory_id=fi.id
  and fmi.meal_id=fm.id
  and fm.status='planned'
  and nullif(trim(fi.family_name),'') is not null;
