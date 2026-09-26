-- V644 · Queue a finance receipt item for product verification.
create or replace function public.queue_shopping_receipt_review(p_finance_item_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_retailer text;
  v_label text;
  v_normalized text;
  v_product_id uuid;
  v_review_id uuid;
begin
  select fi.user_id, ft.merchant, fi.item_name
    into v_user_id, v_retailer, v_label
  from public.finance_items fi
  join public.finance_transactions ft
    on ft.id=fi.transaction_id and ft.user_id=fi.user_id
  where fi.id=p_finance_item_id;

  if v_user_id is null then
    raise exception 'Finance item not found';
  end if;

  if auth.uid() is not null and auth.uid()<>v_user_id then
    raise exception 'Not allowed';
  end if;

  v_normalized:=lower(regexp_replace(trim(v_label),'\s+',' ','g'));

  select a.product_id
    into v_product_id
  from public.shopping_receipt_aliases a
  where a.user_id=v_user_id
    and a.active=true
    and a.is_default=true
    and lower(trim(a.retailer))=lower(trim(v_retailer))
    and a.normalized_label=v_normalized
  order by a.updated_at desc
  limit 1;

  insert into public.shopping_receipt_reviews(
    user_id,finance_item_id,retailer,receipt_label,normalized_label,status,product_id,notes,resolved_at,updated_at
  )
  values(
    v_user_id,p_finance_item_id,v_retailer,v_label,v_normalized,'pending',v_product_id,
    case when v_product_id is null then 'Noch keine eindeutige Produktzuordnung.' else 'Bekanntes Produkt als Vorschlag gefunden.' end,
    null,now()
  )
  on conflict (user_id,finance_item_id) do update
  set retailer=excluded.retailer,
      receipt_label=excluded.receipt_label,
      normalized_label=excluded.normalized_label,
      status='pending',
      product_id=excluded.product_id,
      notes=excluded.notes,
      resolved_at=null,
      updated_at=now()
  returning id into v_review_id;

  return v_review_id;
end;
$$;

grant execute on function public.queue_shopping_receipt_review(uuid) to authenticated;
