
create table if not exists public.food_planned_extras (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_date date not null,
 source_key text not null,
 inventory_id uuid references public.food_inventory(id),
 product_id uuid references public.shopping_products(id),
 title text not null,
 kind text not null default 'snack' check (kind in ('snack','drink')),
 quantity numeric not null check (quantity>0),
 unit text not null,
 calories_kcal numeric,
 protein_g numeric,
 carbohydrates_g numeric,
 fat_g numeric,
 caffeine_mg numeric,
 status text not null default 'planned' check (status in ('planned','confirmed','skipped')),
 confirmed_extra_id uuid references public.food_extra_consumptions(id) on delete set null,
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (user_id,plan_date,source_key)
);
create index if not exists food_planned_extras_owner_date_idx on public.food_planned_extras (user_id,plan_date,status);
alter table public.food_planned_extras enable row level security;
create policy food_planned_extras_owner_all on public.food_planned_extras
 for all to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.food_planned_extras to authenticated;

create or replace function public.confirm_food_planned_extra_v1(p_plan_id uuid)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_user uuid:=auth.uid();
 v_plan public.food_planned_extras%rowtype;
 v_inv public.food_inventory%rowtype;
 v_extra uuid;
begin
 if v_user is null then raise exception 'Bitte anmelden'; end if;
 select * into v_plan from public.food_planned_extras
 where id=p_plan_id and user_id=v_user for update;
 if not found then raise exception 'Geplantes Extra nicht gefunden'; end if;
 if v_plan.status='confirmed' then return v_plan.confirmed_extra_id; end if;
 if v_plan.status!='planned' then raise exception 'Dieses Extra wurde entfernt'; end if;
 if v_plan.plan_date > (now() at time zone 'Europe/Berlin')::date then
  raise exception 'Zukünftige Getränke und Snacks können erst am geplanten Tag bestätigt werden';
 end if;
 if v_plan.inventory_id is not null then
   select * into v_inv from public.food_inventory
   where id=v_plan.inventory_id and user_id=v_user and is_active=true for update;
   if not found or v_inv.unit is distinct from v_plan.unit or coalesce(v_inv.quantity,0)<v_plan.quantity then
     raise exception 'Vorrat fehlt oder stimmt nicht. Bitte Bestand prüfen';
   end if;
 end if;
 insert into public.food_extra_consumptions
 (user_id,consumption_date,consumed_at,product_id,title,kind,quantity,unit,
  calories_kcal,protein_g,carbohydrates_g,fat_g,caffeine_mg,nutrition_source,note,source_reference)
 values(v_user,v_plan.plan_date,now(),v_plan.product_id,v_plan.title,v_plan.kind,v_plan.quantity,v_plan.unit,
  v_plan.calories_kcal,v_plan.protein_g,v_plan.carbohydrates_g,v_plan.fat_g,v_plan.caffeine_mg,
  'Genussplanung: gespeicherter Produkt-Nährwert-Snapshot',v_plan.note,'food-planned-extra-v1-'||v_plan.id::text)
 returning id into v_extra;
 if v_plan.inventory_id is not null then
   perform public.consume_food_inventory(v_plan.inventory_id,v_plan.quantity,v_plan.unit,v_inv.quantity);
 end if;
 update public.food_planned_extras set status='confirmed',confirmed_extra_id=v_extra,updated_at=now()
 where id=v_plan.id;
 return v_extra;
end $$;

create or replace function public.undo_food_planned_extra_v1(p_plan_id uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_user uuid:=auth.uid();
 v_plan public.food_planned_extras%rowtype;
 v_inv public.food_inventory%rowtype;
begin
 if v_user is null then raise exception 'Bitte anmelden'; end if;
 select * into v_plan from public.food_planned_extras
 where id=p_plan_id and user_id=v_user for update;
 if not found then raise exception 'Geplantes Extra nicht gefunden'; end if;
 if v_plan.status!='confirmed' then return false; end if;
 if not exists(select 1 from public.food_extra_consumptions where id=v_plan.confirmed_extra_id and user_id=v_user and source_reference='food-planned-extra-v1-'||v_plan.id::text) then
  raise exception 'Bestätigter Snack wurde verändert. Bitte erst die Buchungen prüfen';
 end if;
 if v_plan.inventory_id is not null then
  select * into v_inv from public.food_inventory
  where id=v_plan.inventory_id and user_id=v_user and is_active=true for update;
  if not found or v_inv.unit is distinct from v_plan.unit then
   raise exception 'Vorratsartikel ist nicht mehr verfügbar oder hat eine andere Einheit';
  end if;
  insert into public.food_inventory_lots
    (user_id,inventory_id,product_id,opened_packages,opened_remaining_quantity,
     opened_remaining_unit,package_quantity,package_unit,source,note)
  values(v_user,v_inv.id,v_plan.product_id,1,v_plan.quantity,v_plan.unit,
     v_plan.quantity,v_plan.unit,'manual','Rückbuchung eines geplanten Genuss-Extras '||v_plan.plan_date::text);
  perform public.adjust_food_inventory(v_inv.id,v_inv.quantity+v_plan.quantity,'Genuss-Extra rückgängig',null);
 end if;
 delete from public.food_extra_consumptions
 where id=v_plan.confirmed_extra_id and user_id=v_user
 and source_reference='food-planned-extra-v1-'||v_plan.id::text;
 update public.food_planned_extras set status='planned',confirmed_extra_id=null,updated_at=now()
 where id=v_plan.id;
 return true;
end $$;
revoke all on function public.confirm_food_planned_extra_v1(uuid) from public;
revoke all on function public.undo_food_planned_extra_v1(uuid) from public;
grant execute on function public.confirm_food_planned_extra_v1(uuid) to authenticated;
grant execute on function public.undo_food_planned_extra_v1(uuid) to authenticated;
