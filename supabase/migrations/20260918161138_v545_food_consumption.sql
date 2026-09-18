-- V545: consume a relative amount under a row lock; never reseed existing stock.
create or replace function public.consume_food_inventory(
  p_inventory_id uuid, p_quantity numeric, p_unit text, p_expected_quantity numeric
)
returns public.food_inventory
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.food_inventory%rowtype;
  v_new public.food_inventory%rowtype;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Bitte eine positive, endliche Menge eingeben';
  end if;
  select * into v_old from public.food_inventory
    where id=p_inventory_id and user_id=v_user and is_active=true for update;
  if not found then raise exception 'Vorrat nicht gefunden'; end if;
  if v_old.unit is distinct from p_unit then raise exception 'Einheit hat sich geändert. Bitte FOOD neu öffnen'; end if;
  if v_old.quantity is null then raise exception 'Bitte zuerst die vorhandene Menge eintragen'; end if;
  if v_old.quantity is distinct from p_expected_quantity then
    raise exception 'Bestand wurde zwischenzeitlich geändert. Bitte FOOD neu öffnen';
  end if;
  if p_quantity > v_old.quantity then raise exception 'So viel ist nicht mehr vorhanden'; end if;
  update public.food_inventory set
    quantity=v_old.quantity-p_quantity,
    quantity_label=replace(trim_scale(v_old.quantity-p_quantity)::text,'.',',') || coalesce(' '||unit,''),
    forecast_label=null,
    tone=case when v_old.quantity=p_quantity then 'empty' else tone end,
    updated_at=now()
    where id=p_inventory_id and user_id=v_user returning * into v_new;
  insert into public.food_inventory_movements(user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
    values(v_user,p_inventory_id,'consume',-p_quantity,v_old.quantity,v_new.quantity,'Einzelverbrauch');
  return v_new;
end;
$$;
revoke all on function public.consume_food_inventory(uuid,numeric,text,numeric) from public, anon;
grant execute on function public.consume_food_inventory(uuid,numeric,text,numeric) to authenticated;
