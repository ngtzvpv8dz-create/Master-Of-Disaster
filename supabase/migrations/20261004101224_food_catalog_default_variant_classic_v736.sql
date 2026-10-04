update public.food_inventory
set catalog_variant_label='Klassisch',
    updated_at=now()
where lower(trim(coalesce(catalog_variant_label,'')))='standard';

create or replace function public.set_food_inventory_catalog_defaults()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_name text:=lower(trim(coalesce(new.name,'')));
  v_family text:=lower(trim(coalesce(new.family_name,'')));
begin
  if nullif(trim(new.catalog_family_name),'') is null then
    new.catalog_family_name:=case
      when v_name like '%paprika%' or v_family like '%paprika%' then 'Paprika'
      when v_name like '%frischkäse%' then 'Frischkäse'
      when v_name like '%skyr%' then 'Skyr'
      when v_name like '%chio dip% salsa%' or v_name like '%salsa dip%' then 'Salsa Dip'
      when v_name like '%hähnchen%brust%filet%' then 'Hähnchenbrustfilet'
      else coalesce(nullif(trim(new.family_name),''),new.name)
    end;
  end if;

  if nullif(trim(new.catalog_group_label),'') is null
     and lower(trim(coalesce(new.catalog_family_name,'')))='paprika' then
    new.catalog_group_label:=case
      when v_name like '%rot%' or v_family like '% rot%' then 'Rot'
      when v_name like '%gelb%' or v_family like '% gelb%' then 'Gelb'
      when v_name like '%orange%' or v_family like '% orange%' then 'Orange'
      when v_name like '%grün%' or v_name like '%gruen%' or v_family like '% grün%' or v_family like '% gruen%' then 'Grün'
      else null
    end;
  end if;

  if nullif(trim(new.catalog_variant_label),'') is null
     or lower(trim(new.catalog_variant_label))='standard' then
    new.catalog_variant_label:=case
      when lower(trim(coalesce(new.catalog_family_name,'')))='paprika' and v_name like '%spitz%' then 'Spitzpaprika'
      when lower(trim(coalesce(new.catalog_family_name,'')))='paprika' and v_name like '%block%' then 'Blockpaprika'
      when lower(trim(coalesce(new.catalog_family_name,'')))='paprika' then 'Paprika'
      when lower(trim(coalesce(new.catalog_family_name,'')))='frischkäse' and v_name like '%körnig%' then 'Körnig'
      when lower(trim(coalesce(new.catalog_family_name,'')))='frischkäse' and v_name like '%leicht%' then 'Leicht'
      when lower(trim(coalesce(new.catalog_family_name,'')))='skyr' and v_name like '%natur%' then 'Natur'
      when lower(trim(coalesce(new.catalog_family_name,'')))='salsa dip' and v_name like '%hot%' then 'Hot'
      when lower(trim(coalesce(new.catalog_family_name,'')))='salsa dip' and v_name like '%mild%' then 'Mild'
      when lower(trim(coalesce(new.catalog_family_name,'')))='hähnchenbrustfilet' then 'Natur'
      else coalesce(nullif(trim(new.variant_label),''),'Klassisch')
    end;
  end if;

  return new;
end;
$$;
