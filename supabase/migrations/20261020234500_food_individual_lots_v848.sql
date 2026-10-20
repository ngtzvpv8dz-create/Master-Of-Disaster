-- V848: Individuelle Bestandschargen, transaktionale Mengenanpassung.
-- Kein automatisches FIFO-Verbrauchen fremder Chargen bei manuellem Bearbeiten.
alter table public.food_inventory_lots
  drop constraint if exists food_inventory_lots_has_stock;
alter table public.food_inventory_lots
  add constraint food_inventory_lots_has_stock
  check (unopened_packages >= 0 and opened_packages >= 0);
-- Nullbestand ist absichtlich erlaubt: entfernte Charge bleibt mit Historie erhalten.

create or replace function public.mod_food_lot_quantity_v848(p_qty numeric,p_from text,p_to text)
returns numeric language sql immutable set search_path=public,pg_temp
as $q$
  select case
    when p_qty is null or p_qty=0 then 0
    when lower(btrim(coalesce(p_from,'')))=lower(btrim(coalesce(p_to,''))) then p_qty
    when lower(btrim(coalesce(p_from,'')))='kg' and lower(btrim(coalesce(p_to,'')))='g' then p_qty*1000
    when lower(btrim(coalesce(p_from,'')))='g' and lower(btrim(coalesce(p_to,'')))='kg' then p_qty/1000
    when lower(btrim(coalesce(p_from,'')))='l' and lower(btrim(coalesce(p_to,'')))='ml' then p_qty*1000
    when lower(btrim(coalesce(p_from,'')))='ml' and lower(btrim(coalesce(p_to,'')))='l' then p_qty/1000
    else null end
$q$;
revoke all on function public.mod_food_lot_quantity_v848(numeric,text,text) from public, anon;
grant execute on function public.mod_food_lot_quantity_v848(numeric,text,text) to authenticated;

create or replace function public.manage_food_inventory_lot_v848(
  p_action text,
  p_inventory_id uuid,
  p_lot_id uuid default null,
  p_expected_updated_at timestamptz default null,
  p_unopened integer default 0,
  p_opened_remaining numeric default 0,
  p_package_quantity numeric default null,
  p_product_id uuid default null,
  p_best_before_label text default null,
  p_storage_location text default null,
  p_note text default null,
  p_reason text default null
) returns jsonb language plpgsql security invoker
set search_path=public,pg_temp
as $fn$
declare
  v_user uuid:=auth.uid();
  v_item public.food_inventory%rowtype;
  v_lot public.food_inventory_lots%rowtype;
  v_old numeric:=0;
  v_new numeric:=0;
  v_total numeric;
  v_pkg numeric;
  v_pkgunit text;
  v_openunit text;
  v_product uuid;
  v_opened integer:=0;
  v_reason text:=nullif(left(btrim(coalesce(p_reason,'')),220),'');
  v_note text:=nullif(left(btrim(coalesce(p_note,'')),800),'');
  v_best text:=nullif(left(btrim(coalesce(p_best_before_label,'')),80),'');
  v_location text:=nullif(left(btrim(coalesce(p_storage_location,'')),120),'');
  v_meta jsonb;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_action not in ('create','update','discard') then raise exception 'Unbekannte Chargenaktion'; end if;
  if p_unopened is null or p_unopened<0 or p_unopened>100000 then raise exception 'Ungültige Zahl ungeöffneter Packungen'; end if;
  if p_opened_remaining is null or p_opened_remaining<0 or p_opened_remaining::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ungültige Restmenge'; end if;

  select * into v_item from public.food_inventory
  where id=p_inventory_id and user_id=v_user and is_active=true for update;
  if not found then raise exception 'Produktfamilie nicht gefunden oder keine Berechtigung'; end if;
  if v_item.quantity is null then raise exception 'Gesamtbestand nicht bekannt. Bitte zuerst den Bestand klären'; end if;

  if p_action='create' then
    if p_lot_id is not null then raise exception 'Für neue Chargen keine vorhandene Chargen-ID angeben'; end if;
    v_pkg:=p_package_quantity;
    v_pkgunit:=v_item.unit;
    v_openunit:=v_item.unit;
    v_product:=p_product_id;
    if v_product is not null and not exists (
      select 1 from public.shopping_products
      where id=v_product and inventory_id=v_item.id and user_id=v_user
    ) then raise exception 'Produkt passt nicht zur ausgewählten Familie'; end if;
  else
    if p_lot_id is null then raise exception 'Keine Chargen-ID gewählt'; end if;
    select * into v_lot from public.food_inventory_lots
      where id=p_lot_id and inventory_id=v_item.id and user_id=v_user for update;
    if not found then raise exception 'Charge wurde bereits geändert oder entfernt'; end if;
    if p_expected_updated_at is null or v_lot.updated_at is distinct from p_expected_updated_at then
      raise exception 'Charge wurde zwischenzeitlich geändert. Bitte Vorrat neu laden'; end if;
    if exists(select 1 from public.food_freezer_portions f
      where f.user_id=v_user
        and (f.source_lot_id=v_lot.id or f.frozen_lot_id=v_lot.id)
        and f.status not in ('cancelled','consumed'))
    then raise exception 'Charge ist einer Gefrierportion zugeordnet. Bitte erst diese Zuordnung klären'; end if;
    v_pkg:=coalesce(p_package_quantity,v_lot.package_quantity);
    v_pkgunit:=coalesce(nullif(v_lot.package_unit,''),v_item.unit);
    v_openunit:=coalesce(nullif(v_lot.opened_remaining_unit,''),v_pkgunit);
    v_product:=coalesce(p_product_id,v_lot.product_id);
    v_old:=coalesce(public.mod_food_lot_quantity_v848(
      coalesce(v_lot.unopened_packages,0)*coalesce(v_lot.package_quantity,0),v_pkgunit,v_item.unit),0)
      +coalesce(public.mod_food_lot_quantity_v848(
        coalesce(v_lot.opened_remaining_quantity,0),v_openunit,v_item.unit),0);
    if (coalesce(v_lot.unopened_packages,0)>0 and public.mod_food_lot_quantity_v848(coalesce(v_lot.package_quantity,0),v_pkgunit,v_item.unit) is null)
       or (coalesce(v_lot.opened_remaining_quantity,0)>0 and public.mod_food_lot_quantity_v848(v_lot.opened_remaining_quantity,v_openunit,v_item.unit) is null)
    then raise exception 'Einheiten dieser Charge können nicht sicher umgerechnet werden'; end if;
  end if;
  if p_action='discard' then
    v_pkg:=coalesce(v_pkg,1); v_opened:=0;
    v_new:=0;v_reason:=coalesce(v_reason,'Manuell entfernt');
  else
    if v_pkg is null or v_pkg<=0 or v_pkg::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Packungsgröße muss positiv sein'; end if;
    if p_opened_remaining>v_pkg then
      raise exception 'Angebrochene Restmenge darf eine Packung nicht überschreiten'; end if;
    if p_action='create' and p_unopened=0 and p_opened_remaining=0 then
      raise exception 'Neue Charge muss einen Bestand enthalten'; end if;
    v_opened:=case when p_opened_remaining>0 then 1 else 0 end;
    v_new:=public.mod_food_lot_quantity_v848(p_unopened*v_pkg,v_pkgunit,v_item.unit)
      +public.mod_food_lot_quantity_v848(p_opened_remaining,v_openunit,v_item.unit);
    if v_new is null then raise exception 'Einheiten lassen sich nicht sicher in den Gesamtbestand umrechnen'; end if;
  end if;
  v_total:=v_item.quantity+v_new-v_old;
  if v_total < -0.000001 then
    raise exception 'Die Änderung übersteigt den vorhandenen Gesamtbestand. Keine andere Charge wurde verändert';end if;
  v_total:=greatest(0,v_total);

  if p_action='create' then
    insert into public.food_inventory_lots(
      user_id,inventory_id,product_id,
      unopened_packages,opened_packages,opened_remaining_quantity,opened_remaining_unit,
      package_quantity,package_unit,best_before_label,storage_location,note,source,batch_data
    ) values (
      v_user,v_item.id,v_product,
      p_unopened,v_opened,case when v_opened=1 then p_opened_remaining else null end,
      case when v_opened=1 then v_openunit else null end,
      v_pkg,v_pkgunit,v_best,v_location,v_note,'manual_individual_lot_v848','{}'::jsonb
    ) returning * into v_lot;
  else
    v_meta:=coalesce(v_lot.batch_data,'{}'::jsonb);
    if p_action='discard' then
      v_meta:=v_meta||jsonb_build_object('stock_removed_at',now(),'stock_removal_reason',v_reason,'removed_quantity',v_old);
    else
      v_meta:=(v_meta-'stock_removed_at'-'stock_removal_reason'-'removed_quantity');
    end if;
    update public.food_inventory_lots set
      unopened_packages=case when p_action='discard' then 0 else p_unopened end,
      opened_packages=v_opened,
      opened_remaining_quantity=case when v_opened=1 then p_opened_remaining else null end,
      opened_remaining_unit=case when v_opened=1 then v_openunit else null end,
      package_quantity=v_pkg,
      best_before_label=case when p_action='discard' then best_before_label else v_best end,
      storage_location=case when p_action='discard' then storage_location else v_location end,
      note=case when p_action='discard' then coalesce(note,'')||' · Entfernt: '||v_reason else v_note end,
      batch_data=v_meta,
      updated_at=now()
    where id=v_lot.id and user_id=v_user returning * into v_lot;
  end if;

  update public.food_inventory set
    quantity=v_total,
    quantity_label=public.food_inventory_lot_label(id,v_total,unit),
    opened=exists(select 1 from public.food_inventory_lots l where l.inventory_id=v_item.id and l.user_id=v_user and coalesce(l.opened_remaining_quantity,0)>0),
    forecast_label=null,
    tone=case when v_total=0 then 'empty' else case when tone='empty' then 'stock' else tone end end,
    updated_at=now()
  where id=v_item.id and user_id=v_user;
  insert into public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
  values(v_user,v_item.id,
    case when p_action='discard' and lower(v_reason) ~ 'schlecht|verdorb|müll|vergammel' then 'spoilage'
         when p_action='discard' then 'remove' else 'adjust' end,
    v_new-v_old,v_item.quantity,v_total,
    'Chargen-ID '||v_lot.id::text||' · '||case when p_action='discard' then v_reason else coalesce(v_reason,'Charge einzeln angepasst') end);
  return jsonb_build_object('inventory_id',v_item.id,'lot_id',v_lot.id,'quantity',v_total,'action',p_action);
end;
$fn$;

revoke all on function public.manage_food_inventory_lot_v848(text,uuid,uuid,timestamptz,integer,numeric,numeric,uuid,text,text,text,text)
from public,anon;
grant execute on function public.manage_food_inventory_lot_v848(text,uuid,uuid,timestamptz,integer,numeric,numeric,uuid,text,text,text,text)
to authenticated;
