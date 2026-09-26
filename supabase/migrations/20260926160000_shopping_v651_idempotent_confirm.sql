-- V651 · idempotente Bon-Produktbestätigung
create or replace function public.confirm_shopping_receipt_review(
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
  v_finance public.finance_items%rowtype;
  v_inventory public.food_inventory%rowtype;
  v_delta numeric:=0;
  v_before numeric:=0;
  v_after numeric:=0;
  v_inventory_applied boolean:=false;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_review
  from public.shopping_receipt_reviews
  where id=p_review_id and user_id=v_user
  for update;

  if not found then
    raise exception 'Bonposition nicht gefunden';
  end if;

  select * into v_product
  from public.shopping_products
  where id=p_product_id and user_id=v_user and active=true;

  if not found then
    raise exception 'Produkt im Produktstamm nicht gefunden';
  end if;

  if v_review.status='confirmed' then
    if v_review.product_id=p_product_id then
      return jsonb_build_object(
        'confirmed',true,
        'already_confirmed',true,
        'inventory_applied',v_review.inventory_applied_at is not null
      );
    end if;
    raise exception 'Bonposition ist bereits einem anderen Produkt zugeordnet';
  end if;

  select * into v_finance
  from public.finance_items
  where id=v_review.finance_item_id and user_id=v_user;

  if not found then
    raise exception 'Bonartikel nicht gefunden';
  end if;

  update public.shopping_receipt_aliases
  set is_default=false,updated_at=now()
  where user_id=v_user
    and active=true
    and lower(trim(retailer))=lower(trim(v_review.retailer))
    and normalized_label=v_review.normalized_label
    and product_id<>p_product_id
    and is_default=true;

  insert into public.shopping_receipt_aliases(
    user_id,retailer,receipt_label,normalized_label,product_id,is_default,active,updated_at
  )
  values(
    v_user,v_review.retailer,v_review.receipt_label,v_review.normalized_label,
    p_product_id,true,true,now()
  )
  on conflict (user_id,lower(retailer),normalized_label,product_id)
  do update set
    receipt_label=excluded.receipt_label,
    is_default=true,
    active=true,
    updated_at=now();

  if v_review.inventory_applied_at is null
     and v_product.inventory_id is not null
     and v_product.package_quantity is not null
     and v_product.package_quantity>0 then

    select * into v_inventory
    from public.food_inventory
    where id=v_product.inventory_id and user_id=v_user and is_active=true
    for update;

    if found
       and lower(coalesce(v_inventory.unit,''))=lower(coalesce(v_product.package_unit,'')) then
      v_delta:=v_product.package_quantity*coalesce(v_finance.quantity,1);
      v_before:=coalesce(v_inventory.quantity,0);
      v_after:=v_before+v_delta;

      update public.food_inventory
      set quantity=v_after,
          quantity_label=public.food_quantity_label(v_after,unit),
          tone=case when v_after=0 then 'empty' else 'fresh' end,
          updated_at=now()
      where id=v_inventory.id;

      insert into public.food_inventory_movements(
        user_id,inventory_id,kind,delta,quantity_before,quantity_after,note
      )
      values(
        v_user,v_inventory.id,'add',v_delta,v_before,v_after,
        'Einkauf gegenprüft: '||v_review.retailer||' · '||v_review.receipt_label
      );

      v_inventory_applied:=true;
    end if;
  end if;

  update public.shopping_receipt_reviews
  set status='confirmed',
      product_id=p_product_id,
      notes='Produkt in der Einkaufskontrolle bestätigt.',
      inventory_applied_at=case when v_inventory_applied then now() else inventory_applied_at end,
      resolved_at=now(),
      updated_at=now()
  where id=v_review.id;

  if v_review.checkout_id is not null and not exists(
    select 1
    from public.shopping_receipt_reviews r
    where r.checkout_id=v_review.checkout_id
      and r.user_id=v_user
      and r.id<>v_review.id
      and r.status in ('pending','new_product_pending')
  ) then
    update public.shopping_checkouts
    set status='done',updated_at=now()
    where id=v_review.checkout_id and user_id=v_user;
  end if;

  return jsonb_build_object(
    'confirmed',true,
    'already_confirmed',false,
    'inventory_applied',v_inventory_applied,
    'inventory_delta',v_delta
  );
end;
$$;

grant execute on function public.confirm_shopping_receipt_review(uuid,uuid) to authenticated;
