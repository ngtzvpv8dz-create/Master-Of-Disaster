-- V756 · Phase 4 purchase details
-- MHD status and purchase-specific metadata belong to the concrete checkout item, not the reusable product master.

alter table public.shopping_checkout_items
  add column if not exists best_before_status text,
  add column if not exists purchase_data jsonb not null default '{}'::jsonb;

update public.shopping_checkout_items
set best_before_status = case
  when best_before_date is not null then 'date'
  else 'unknown'
end
where best_before_status is null;

alter table public.shopping_checkout_items
  alter column best_before_status set default 'unknown',
  alter column best_before_status set not null;

alter table public.shopping_checkout_items
  drop constraint if exists shopping_checkout_items_best_before_status_check;

alter table public.shopping_checkout_items
  add constraint shopping_checkout_items_best_before_status_check
  check (best_before_status in ('unknown','date','none'));

create or replace function public.set_shopping_review_purchase_details(
  p_review_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_unit text,
  p_package_count integer,
  p_best_before_status text,
  p_best_before_date date,
  p_purchase_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_review public.shopping_receipt_reviews%rowtype;
  v_product public.shopping_products%rowtype;
  v_finance public.finance_items%rowtype;
  v_item public.shopping_checkout_items%rowtype;
  v_checkout_item_id uuid;
  v_quantity numeric:=p_quantity;
  v_unit text:=nullif(trim(coalesce(p_unit,'')),'');
  v_package_count integer:=p_package_count;
  v_status text:=lower(trim(coalesce(p_best_before_status,'unknown')));
  v_date date:=p_best_before_date;
  v_outer_count numeric:=1;
  v_inner_count numeric:=null;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if v_status not in ('unknown','date','none') then raise exception 'Ungültiger MHD-Status'; end if;
  if v_status='date' and v_date is null then raise exception 'Bitte ein MHD eintragen'; end if;
  if v_status='none' then v_date:=null; end if;
  if v_package_count is not null and v_package_count<=0 then raise exception 'Packungsanzahl muss größer 0 sein'; end if;

  select * into v_review
  from public.shopping_receipt_reviews
  where id=p_review_id and user_id=v_user
  for update;
  if not found then raise exception 'Bonposition nicht gefunden'; end if;

  select * into v_product
  from public.shopping_products
  where id=p_product_id and user_id=v_user and active=true;
  if not found then raise exception 'Produkt im Produktstamm nicht gefunden'; end if;

  select * into v_finance
  from public.finance_items
  where id=v_review.finance_item_id and user_id=v_user;
  if not found then raise exception 'Bonartikel nicht gefunden'; end if;

  v_outer_count:=coalesce(nullif(v_finance.quantity,0),1);
  begin
    v_inner_count:=nullif(v_product.product_data->>'inner_units_total','')::numeric;
  exception when others then
    v_inner_count:=null;
  end;

  if v_quantity is null or v_quantity<=0 then
    if v_product.package_quantity is not null and v_product.package_quantity>0 then
      v_quantity:=v_product.package_quantity*v_outer_count;
    else
      v_quantity:=coalesce(v_finance.quantity,1);
    end if;
  end if;

  if v_unit is null then
    v_unit:=nullif(trim(coalesce(v_product.package_unit,'')),'');
  end if;
  if v_unit is null then v_unit:=nullif(trim(coalesce(v_finance.unit,'')),''); end if;
  if v_unit is null then v_unit:='Stück'; end if;

  if v_package_count is null then
    if v_inner_count is not null and v_inner_count>0 and v_outer_count=floor(v_outer_count) then
      v_package_count:=(v_inner_count*v_outer_count)::integer;
    elsif v_outer_count=floor(v_outer_count) then
      v_package_count:=greatest(1,v_outer_count::integer);
    else
      v_package_count:=1;
    end if;
  end if;

  if v_review.checkout_item_id is not null then
    select * into v_item
    from public.shopping_checkout_items
    where id=v_review.checkout_item_id and user_id=v_user
    for update;
    if found then v_checkout_item_id:=v_item.id; end if;
  end if;

  if v_checkout_item_id is null then
    insert into public.shopping_checkout_items(
      user_id,checkout_id,shopping_key,label,quantity,unit,source,
      planned_quantity,planned_unit,inventory_id,product_id,best_before_date,
      best_before_status,package_count,purchase_data,note
    )
    values(
      v_user,v_review.checkout_id,'receipt:'||v_review.finance_item_id::text,
      v_review.receipt_label,v_quantity,v_unit,'receipt-only',
      null,null,v_product.inventory_id,p_product_id,v_date,
      v_status,v_package_count,coalesce(p_purchase_data,'{}'::jsonb),
      'Kaufdetails in Phase 4 geprüft.'
    )
    on conflict (checkout_id,shopping_key)
    do update set
      quantity=excluded.quantity,
      unit=excluded.unit,
      inventory_id=coalesce(public.shopping_checkout_items.inventory_id,excluded.inventory_id),
      product_id=excluded.product_id,
      best_before_date=excluded.best_before_date,
      best_before_status=excluded.best_before_status,
      package_count=excluded.package_count,
      purchase_data=excluded.purchase_data,
      note=excluded.note
    returning * into v_item;
    v_checkout_item_id:=v_item.id;
  else
    update public.shopping_checkout_items
    set quantity=v_quantity,
        unit=v_unit,
        inventory_id=coalesce(inventory_id,v_product.inventory_id),
        product_id=p_product_id,
        best_before_date=v_date,
        best_before_status=v_status,
        package_count=v_package_count,
        purchase_data=coalesce(p_purchase_data,'{}'::jsonb),
        note='Kaufdetails in Phase 4 geprüft.'
    where id=v_checkout_item_id and user_id=v_user
    returning * into v_item;
  end if;

  update public.shopping_receipt_reviews
  set checkout_item_id=v_checkout_item_id,
      product_id=p_product_id,
      notes='Produktvorschlag und Kaufdetails in Phase 4 geprüft.',
      updated_at=now()
  where id=v_review.id;

  return jsonb_build_object(
    'saved',true,
    'checkout_item_id',v_checkout_item_id,
    'quantity',v_item.quantity,
    'unit',v_item.unit,
    'package_count',v_item.package_count,
    'best_before_status',v_item.best_before_status,
    'best_before_date',v_item.best_before_date,
    'purchase_data',v_item.purchase_data
  );
end;
$$;

grant execute on function public.set_shopping_review_purchase_details(uuid,uuid,numeric,text,integer,text,date,jsonb) to authenticated;

create or replace function public.confirm_shopping_receipt_review_v756(
  p_review_id uuid,
  p_product_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_review public.shopping_receipt_reviews%rowtype;
  v_product public.shopping_products%rowtype;
  v_item public.shopping_checkout_items%rowtype;
  v_track_inventory boolean:=false;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;

  select * into v_review
  from public.shopping_receipt_reviews
  where id=p_review_id and user_id=v_user;
  if not found then raise exception 'Bonposition nicht gefunden'; end if;

  select * into v_product
  from public.shopping_products
  where id=p_product_id and user_id=v_user and active=true;
  if not found then raise exception 'Produkt im Produktstamm nicht gefunden'; end if;

  v_track_inventory :=
    v_product.inventory_id is not null
    or lower(coalesce(v_product.product_data->>'inventory_scope',''))='food'
    or lower(coalesce(v_product.category,'')) not in ('haushalt','drogerie','technik','sonstiges','dienstleistung');

  if v_track_inventory then
    if v_review.checkout_item_id is null then
      raise exception 'Bitte zuerst die Kaufdetails prüfen und MHD bzw. „kein MHD“ angeben.';
    end if;

    select * into v_item
    from public.shopping_checkout_items
    where id=v_review.checkout_item_id and user_id=v_user;

    if not found then raise exception 'Kaufdetails fehlen.'; end if;

    if coalesce(v_item.best_before_status,'unknown')='unknown' then
      raise exception 'Bitte MHD prüfen: Datum eintragen oder „kein MHD vorhanden“ wählen.';
    end if;

    if v_item.best_before_status='date' and v_item.best_before_date is null then
      raise exception 'Bitte das MHD-Datum eintragen.';
    end if;
  end if;

  return public.confirm_shopping_receipt_review(p_review_id,p_product_id);
end;
$$;

grant execute on function public.confirm_shopping_receipt_review_v756(uuid,uuid) to authenticated;

create or replace function public.shopping_lot_merge_purchase_data_v756()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_purchase_data jsonb;
  v_best_before_status text;
begin
  if new.checkout_item_id is not null then
    select purchase_data,best_before_status
    into v_purchase_data,v_best_before_status
    from public.shopping_checkout_items
    where id=new.checkout_item_id;

    new.batch_data :=
      coalesce(new.batch_data,'{}'::jsonb)
      || coalesce(v_purchase_data,'{}'::jsonb)
      || jsonb_build_object('best_before_status',coalesce(v_best_before_status,'unknown'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shopping_lot_merge_purchase_data_v756 on public.food_inventory_lots;
create trigger trg_shopping_lot_merge_purchase_data_v756
before insert or update of checkout_item_id,batch_data on public.food_inventory_lots
for each row execute function public.shopping_lot_merge_purchase_data_v756();
