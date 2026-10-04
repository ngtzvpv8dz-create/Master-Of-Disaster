create or replace function public.set_food_inventory_catalog_defaults()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_text text:=lower(trim(coalesce(new.family_name,'')||' '||coalesce(new.name,'')));
  v_color text;
begin
  if v_text ~ '(^|[[:space:]])paprika([[:space:]]|$)' then
    if v_text ~ '(^|[[:space:]])rot(e|er|es|en)?([[:space:]]|$)' then v_color:='Rot';
    elsif v_text ~ '(^|[[:space:]])gelb(e|er|es|en)?([[:space:]]|$)' then v_color:='Gelb';
    elsif v_text ~ '(^|[[:space:]])orange([[:space:]]|$)' then v_color:='Orange';
    elsif v_text ~ '(^|[[:space:]])grün(e|er|es|en)?([[:space:]]|$)' then v_color:='Grün';
    end if;

    if nullif(trim(new.catalog_family_name),'') is null
       or lower(trim(new.catalog_family_name)) like 'paprika %' then
      new.catalog_family_name:='Paprika';
    end if;
    if nullif(trim(new.catalog_group_label),'') is null and v_color is not null then
      new.catalog_group_label:=v_color;
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
$$;
