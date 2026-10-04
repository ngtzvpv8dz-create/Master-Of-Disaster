alter table public.food_inventory
  add column if not exists catalog_family_name text,
  add column if not exists catalog_group_label text,
  add column if not exists catalog_variant_label text;

comment on column public.food_inventory.catalog_family_name is
  'UI-/Produktstamm-Familie für die Vorratshierarchie. Bewusst getrennt von family_name, das für Rezept-/Substitutionslogik verwendet wird.';
comment on column public.food_inventory.catalog_group_label is
  'Optionale Zwischenebene innerhalb der Katalogfamilie, z. B. Paprika -> Rot -> Blockpaprika.';
comment on column public.food_inventory.catalog_variant_label is
  'Variante innerhalb der Katalogfamilie bzw. Katalog-Untergruppe.';

update public.food_inventory
set
  catalog_family_name = case
    when lower(name) in ('chio dip hot salsa','chio dip mild salsa') then 'Salsa Dip'
    when lower(coalesce(family_name,''))='paprika rot' then 'Paprika'
    when lower(name) in ('frischkäse leicht','körniger frischkäse') then 'Frischkäse'
    when lower(name)='skyr natur' then 'Skyr'
    when lower(coalesce(family_name,''))='pepsi zero' then 'Cola Zero'
    when lower(coalesce(family_name,''))='holy milkshake' then 'Milkshake'
    when lower(coalesce(family_name,''))='yum yum instantnudeln' then 'Instantnudeln'
    when lower(name)='hähnchenbrustfilet' then 'Hähnchenbrustfilet'
    when lower(name)='hokkaido-kürbis' then 'Kürbis'
    when lower(name)='granny smith' then 'Äpfel'
    when lower(name)='knusperbrot weizen' then 'Knusperbrot'
    when lower(name)='h-milch 1,5 %' then 'H-Milch'
    when lower(name)='hackfleisch gemischt' then 'Hackfleisch'
    when lower(name)='dinkelmehl type 1050' then 'Dinkelmehl'
    when lower(name)='roggenmehl type 1150' then 'Roggenmehl'
    when lower(name)='mozzarella light' then 'Mozzarella'
    when lower(name)='mandeln naturbelassen' then 'Mandeln'
    when lower(name)='oregano gerebelt' then 'Oregano'
    when lower(name)='paprikapulver edelsüß' then 'Paprikapulver'
    when lower(name)='protein coffee classic coffee' then 'Protein Coffee'
    when lower(name)='tortilla wraps vollkorn' then 'Tortilla Wraps'
    when lower(name)='naturreis im kochbeutel' then 'Naturreis'
    when lower(name)='zarte haferflocken' then 'Haferflocken'
    else coalesce(nullif(trim(family_name),''),name)
  end,
  catalog_group_label = case
    when lower(coalesce(family_name,''))='paprika rot'
      or lower(name) in ('blockpaprika rot','spitzpaprika kapia sweet')
      then 'Rot'
    else null
  end,
  catalog_variant_label = case
    when lower(name)='chio dip hot salsa' then 'Hot'
    when lower(name)='chio dip mild salsa' then 'Mild'
    when lower(name)='blockpaprika rot' then 'Blockpaprika'
    when lower(name)='spitzpaprika kapia sweet' then 'Spitzpaprika · Kapia Sweet'
    when lower(name)='frischkäse leicht' then 'Leicht'
    when lower(name)='körniger frischkäse' then 'Körnig'
    when lower(name)='skyr natur' then 'Natur'
    when lower(name)='hähnchenbrustfilet' then 'Natur'
    when lower(name)='brokkoli' then 'Frisch'
    when lower(name)='bulgur' then 'Bio'
    when lower(name)='couscous' then 'Klassisch'
    when lower(name)='kartoffeln' then 'Festkochend · Sorte Jule'
    when lower(name)='zwiebel' then 'Speisezwiebel'
    when lower(name)='senf' then 'Extra scharf'
    when lower(name)='olivenöl' then 'Nativ extra'
    when lower(name)='hackfleisch gemischt' then 'Gemischt · 50 % Schwein / 50 % Rind'
    when lower(name)='passierte tomaten' then 'Fein passiert'
    when lower(name)='mandeln naturbelassen' then 'Naturbelassen'
    when lower(name)='cashews' then 'Naturbelassen'
    when lower(name)='chiasamen' then 'Getrocknet'
    when lower(name)='knusperbrot weizen' then 'Weizen'
    when lower(name)='h-milch 1,5 %' then '1,5 % Fett'
    when lower(name)='dinkelmehl type 1050' then 'Type 1050'
    when lower(name)='roggenmehl type 1150' then 'Type 1150'
    when lower(name)='eier' then 'Freiland · Größe L'
    when lower(name)='granny smith' then 'Granny Smith'
    when lower(name)='hokkaido-kürbis' then 'Hokkaido'
    when lower(name)='langkornreis' then 'Kochbeutel'
    when lower(name)='naturreis im kochbeutel' then 'Kochbeutel'
    when lower(name)='magerquark' then 'Magerstufe'
    when lower(name)='mozzarella light' then 'Leicht'
    when lower(name)='oregano gerebelt' then 'Gerebelt'
    when lower(name)='paprikapulver edelsüß' then 'Edelsüß'
    when lower(name)='penne rigate' then 'Rigate'
    when lower(name)='pfeffer schwarz' then 'Schwarz'
    when lower(name)='protein coffee classic coffee' then 'Classic Coffee'
    when lower(name)='tortilla wraps vollkorn' then 'Vollkorn'
    when lower(name)='trockenbackhefe' then '7-g-Päckchen'
    when lower(name)='wild-heidelbeeren' then 'TK'
    when lower(name)='zarte haferflocken' then 'Zart'
    when lower(name)='zucchini' then 'Frisch'
    when lower(name)='babyspinat frisch' then 'Babyspinat · frisch'
    when lower(name)='blattspinat' then 'Blattspinat · frisch'
    when lower(name)='blattspinat tk' then 'Blattspinat · TK'
    when lower(name)='hirtenkäse' then 'Hirtenkäse · leicht'
    when lower(name)='joghurt griechischer art' then '2 % Fett'
    when lower(name)='salatgurke' then 'Salatgurke'
    when lower(coalesce(family_name,''))='pepsi zero' then coalesce(nullif(trim(variant_label),''),'Original')
    when lower(coalesce(family_name,''))='holy milkshake' then coalesce(nullif(trim(variant_label),''),'Klassisch')
    when lower(coalesce(family_name,''))='yum yum instantnudeln' then coalesce(nullif(trim(variant_label),''),'Klassisch')
    else coalesce(nullif(trim(variant_label),''),'Standard')
  end,
  updated_at=now();

create or replace function public.set_food_inventory_catalog_defaults()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if nullif(trim(new.catalog_family_name),'') is null then
    new.catalog_family_name:=coalesce(nullif(trim(new.family_name),''),new.name);
  end if;
  if nullif(trim(new.catalog_variant_label),'') is null then
    new.catalog_variant_label:=coalesce(nullif(trim(new.variant_label),''),'Standard');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_food_inventory_catalog_defaults on public.food_inventory;
create trigger trg_food_inventory_catalog_defaults
before insert or update of name,family_name,variant_label,catalog_family_name,catalog_group_label,catalog_variant_label
on public.food_inventory
for each row execute function public.set_food_inventory_catalog_defaults();

create index if not exists idx_food_inventory_catalog_family
  on public.food_inventory(user_id,catalog_family_name,catalog_group_label,catalog_variant_label)
  where is_active=true;
