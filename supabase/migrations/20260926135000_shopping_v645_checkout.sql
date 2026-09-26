-- V645 · Checkout workflow + non-restockable inventory
alter table public.food_inventory
  add column if not exists shopping_excluded boolean not null default false;

update public.food_inventory
set shopping_excluded=true,
    updated_at=now(),
    note=concat_ws(' · ',note,'Nicht automatisch nachkaufen: selbstgemachtes Kürbisbrot, Restbestand verdorben.')
where name='Hokkaido-Kürbisbrot';

create table if not exists public.shopping_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  finance_transaction_id uuid null references public.finance_transactions(id) on delete set null,
  status text not null default 'review' check (status in ('review','done')),
  retailer text null,
  total_amount numeric null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_checkouts_user_status_idx
  on public.shopping_checkouts(user_id,status,completed_at desc);

create table if not exists public.shopping_checkout_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_id uuid not null references public.shopping_checkouts(id) on delete cascade,
  shopping_key text not null,
  label text not null,
  quantity numeric null,
  unit text null,
  source text not null default 'food',
  created_at timestamptz not null default now()
);

create unique index if not exists shopping_checkout_items_key_uq
  on public.shopping_checkout_items(checkout_id,shopping_key);

alter table public.shopping_receipt_reviews
  add column if not exists checkout_id uuid null references public.shopping_checkouts(id) on delete set null,
  add column if not exists inventory_applied_at timestamptz null;

alter table public.shopping_checkouts enable row level security;
alter table public.shopping_checkout_items enable row level security;

drop policy if exists shopping_checkouts_owner_all on public.shopping_checkouts;
create policy shopping_checkouts_owner_all on public.shopping_checkouts
for all to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

drop policy if exists shopping_checkout_items_owner_all on public.shopping_checkout_items;
create policy shopping_checkout_items_owner_all on public.shopping_checkout_items
for all to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

grant select,insert,update,delete on public.shopping_checkouts to authenticated;
grant select,insert,update,delete on public.shopping_checkout_items to authenticated;

drop trigger if exists mod_backup_audit_row_change on public.shopping_checkouts;
create trigger mod_backup_audit_row_change
after insert or update or delete on public.shopping_checkouts
for each row execute function backup_internal.capture_row_change();

drop trigger if exists mod_backup_audit_row_change on public.shopping_checkout_items;
create trigger mod_backup_audit_row_change
after insert or update or delete on public.shopping_checkout_items
for each row execute function backup_internal.capture_row_change();

create or replace function public.complete_shopping_checkout(
  p_transaction_id uuid,
  p_cart_snapshot jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_checkout uuid;
  v_tx public.finance_transactions%rowtype;
  v_item jsonb;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_tx
  from public.finance_transactions
  where id=p_transaction_id and user_id=v_user;

  if not found then raise exception 'Receipt transaction not found'; end if;

  insert into public.shopping_checkouts(user_id,finance_transaction_id,status,retailer,total_amount)
  values(v_user,p_transaction_id,'review',v_tx.merchant,v_tx.total_amount)
  returning id into v_checkout;

  for v_item in select value from jsonb_array_elements(coalesce(p_cart_snapshot,'[]'::jsonb))
  loop
    insert into public.shopping_checkout_items(
      user_id,checkout_id,shopping_key,label,quantity,unit,source
    ) values(
      v_user,
      v_checkout,
      coalesce(v_item->>'key',''),
      coalesce(v_item->>'label','Unbekannter Einkaufsartikel'),
      nullif(v_item->>'quantity','')::numeric,
      nullif(v_item->>'unit',''),
      coalesce(nullif(v_item->>'source',''),'food')
    )
    on conflict (checkout_id,shopping_key) do nothing;
  end loop;

  delete from public.food_shopping_cart_state where user_id=v_user;

  update public.shopping_items
  set status='done',return_status=null,completed_at=now(),updated_at=now()
  where user_id=v_user and status='cart';

  insert into public.shopping_receipt_reviews(
    user_id,finance_item_id,checkout_id,retailer,receipt_label,normalized_label,
    status,product_id,notes,resolved_at,updated_at
  )
  select
    fi.user_id,
    fi.id,
    v_checkout,
    v_tx.merchant,
    fi.item_name,
    lower(regexp_replace(trim(fi.item_name),'\s+',' ','g')),
    case when existing.status in ('confirmed','ignored') then existing.status else 'pending' end,
    case
      when existing.product_id is not null then existing.product_id
      else alias.product_id
    end,
    case
      when existing.status in ('confirmed','ignored') then existing.notes
      when alias.product_id is not null then 'Bekanntes Produkt als Vorschlag gefunden.'
      else 'Noch keine eindeutige Produktzuordnung.'
    end,
    case when existing.status in ('confirmed','ignored') then existing.resolved_at else null end,
    now()
  from public.finance_items fi
  left join public.shopping_receipt_reviews existing
    on existing.user_id=fi.user_id and existing.finance_item_id=fi.id
  left join lateral (
    select a.product_id
    from public.shopping_receipt_aliases a
    where a.user_id=fi.user_id
      and a.active=true
      and a.is_default=true
      and lower(trim(a.retailer))=lower(trim(v_tx.merchant))
      and a.normalized_label=lower(regexp_replace(trim(fi.item_name),'\s+',' ','g'))
    order by a.updated_at desc
    limit 1
  ) alias on true
  where fi.user_id=v_user and fi.transaction_id=p_transaction_id
  on conflict (user_id,finance_item_id) do update
  set checkout_id=excluded.checkout_id,
      retailer=excluded.retailer,
      receipt_label=excluded.receipt_label,
      normalized_label=excluded.normalized_label,
      product_id=coalesce(public.shopping_receipt_reviews.product_id,excluded.product_id),
      status=case
        when public.shopping_receipt_reviews.status in ('confirmed','ignored')
          then public.shopping_receipt_reviews.status
        else 'pending'
      end,
      notes=case
        when public.shopping_receipt_reviews.status in ('confirmed','ignored')
          then public.shopping_receipt_reviews.notes
        else excluded.notes
      end,
      resolved_at=case
        when public.shopping_receipt_reviews.status in ('confirmed','ignored')
          then public.shopping_receipt_reviews.resolved_at
        else null
      end,
      updated_at=now();

  return v_checkout;
end;
$$;

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
  v_delta numeric;
  v_before numeric;
  v_after numeric;
  v_applied boolean:=false;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_review
  from public.shopping_receipt_reviews
  where id=p_review_id and user_id=v_user
  for update;
  if not found then raise exception 'Review not found'; end if;

  select * into v_product
  from public.shopping_products
  where id=p_product_id and user_id=v_user and active=true;
  if not found then raise exception 'Product not found'; end if;

  select * into v_finance
  from public.finance_items
  where id=v_review.finance_item_id and user_id=v_user;
  if not found then raise exception 'Finance item not found'; end if;

  insert into public.shopping_receipt_aliases(
    user_id,retailer,receipt_label,normalized_label,product_id,is_default
  )
  values(
    v_user,v_review.retailer,v_review.receipt_label,v_review.normalized_label,v_product.id,
    not exists(
      select 1 from public.shopping_receipt_aliases a
      where a.user_id=v_user and a.active=true and a.is_default=true
        and lower(trim(a.retailer))=lower(trim(v_review.retailer))
        and a.normalized_label=v_review.normalized_label
    )
  )
  on conflict do nothing;

  if v_review.inventory_applied_at is null
     and v_product.inventory_id is not null
     and v_product.package_quantity is not null
     and v_product.package_quantity>0 then

    select * into v_inventory
    from public.food_inventory
    where id=v_product.inventory_id and user_id=v_user
    for update;

    if found and lower(coalesce(v_inventory.unit,''))=lower(coalesce(v_product.package_unit,'')) then
      v_delta:=v_product.package_quantity*coalesce(v_finance.quantity,1);
      v_before:=coalesce(v_inventory.quantity,0);
      v_after:=v_before+v_delta;

      update public.food_inventory
      set quantity=v_after,
          quantity_label=trim(to_char(v_after,'FM999999990D99'))||case when coalesce(unit,'')<>'' then ' '||unit else '' end,
          tone='fresh',
          is_active=true,
          updated_at=now()
      where id=v_inventory.id;

      insert into public.food_inventory_movements(
        user_id,inventory_id,kind,delta,quantity_before,quantity_after,note
      ) values(
        v_user,v_inventory.id,'add',v_delta,v_before,v_after,
        'Einkauf gegenprüft: '||v_review.retailer||' · '||v_review.receipt_label
      );
      v_applied:=true;
    end if;
  end if;

  update public.shopping_receipt_reviews
  set status='confirmed',
      product_id=v_product.id,
      notes='Produkt in der Einkaufskontrolle bestätigt.',
      inventory_applied_at=case when v_applied then now() else inventory_applied_at end,
      resolved_at=now(),
      updated_at=now()
  where id=v_review.id;

  if v_review.checkout_id is not null and not exists(
    select 1 from public.shopping_receipt_reviews r
    where r.checkout_id=v_review.checkout_id
      and r.user_id=v_user
      and r.id<>v_review.id
      and r.status in ('pending','new_product_pending')
  ) then
    update public.shopping_checkouts
    set status='done',updated_at=now()
    where id=v_review.checkout_id and user_id=v_user;
  end if;

  return jsonb_build_object('confirmed',true,'inventory_applied',v_applied);
end;
$$;

create or replace function public.ignore_shopping_receipt_review(p_review_id uuid)
returns boolean
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_checkout uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  update public.shopping_receipt_reviews
  set status='ignored',product_id=null,
      notes='Für diese Bonposition ist kein konkreter Produktstamm nötig.',
      resolved_at=now(),updated_at=now()
  where id=p_review_id and user_id=v_user
  returning checkout_id into v_checkout;

  if not found then raise exception 'Review not found'; end if;

  if v_checkout is not null and not exists(
    select 1 from public.shopping_receipt_reviews r
    where r.checkout_id=v_checkout and r.user_id=v_user
      and r.status in ('pending','new_product_pending')
  ) then
    update public.shopping_checkouts set status='done',updated_at=now()
    where id=v_checkout and user_id=v_user;
  end if;
  return true;
end;
$$;

grant execute on function public.complete_shopping_checkout(uuid,jsonb) to authenticated;
grant execute on function public.confirm_shopping_receipt_review(uuid,uuid) to authenticated;
grant execute on function public.ignore_shopping_receipt_review(uuid) to authenticated;
