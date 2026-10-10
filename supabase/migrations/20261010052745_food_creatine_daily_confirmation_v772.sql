-- V772: Separate, durable creatine confirmation. No booking before a deliberate tap.
create table if not exists public.food_creatine_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intake_date date not null,
  supplement_code text not null default 'esn_creatine_stick'
    check (supplement_code = 'esn_creatine_stick'),
  inventory_id uuid not null references public.food_inventory(id),
  inventory_name text,
  variant_label text,
  quantity_g numeric(8,2) not null default 4 check (quantity_g = 4),
  creatine_g numeric(8,2) not null default 3 check (creatine_g = 3),
  movement_id uuid unique references public.food_inventory_movements(id),
  confirmed_at timestamptz,
  unique(user_id,intake_date,supplement_code),
  check (intake_date >= date '2026-10-11')
);
create index if not exists food_creatine_intakes_user_date_idx
  on public.food_creatine_intakes(user_id,intake_date desc);
alter table public.food_creatine_intakes enable row level security;
create policy "Own confirmed creatine intakes are readable"
  on public.food_creatine_intakes for select to authenticated
  using (user_id=(select auth.uid()));
revoke all on public.food_creatine_intakes from public,anon,authenticated;
grant select on public.food_creatine_intakes to authenticated;

create or replace function public.confirm_daily_creatine_intake(p_intake_date date,p_inventory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_intake_id uuid;
  v_prior public.food_creatine_intakes%rowtype;
  v_stock public.food_inventory%rowtype;
  v_after numeric;
  v_movement uuid;
  v_variant text;
begin
  if v_user is null then raise exception 'Nicht angemeldet'; end if;
  if p_intake_date is null or p_intake_date < date '2026-10-11'
    or p_intake_date > v_today then
    raise exception 'Kreatin kann nur für bereits erreichte Tage ab dem 11.10.2026 bestätigt werden';
  end if;
  if p_inventory_id is null then raise exception 'Bitte Kreatin-Sorte wählen'; end if;

  -- Unique key reserves the day first. Concurrent confirmations can never deduct twice.
  insert into public.food_creatine_intakes
    (user_id,intake_date,supplement_code,inventory_id,quantity_g,creatine_g)
  values
    (v_user,p_intake_date,'esn_creatine_stick',p_inventory_id,4,3)
  on conflict (user_id,intake_date,supplement_code) do nothing
  returning id into v_intake_id;

  if v_intake_id is null then
    select * into v_prior
    from public.food_creatine_intakes
    where user_id=v_user and intake_date=p_intake_date
      and supplement_code='esn_creatine_stick';
    return jsonb_build_object(
      'already_confirmed',true,
      'intake_date',v_prior.intake_date,
      'variant',v_prior.variant_label,
      'quantity_g',v_prior.quantity_g,
      'remaining_g',null,
      'confirmed_at',v_prior.confirmed_at
    );
  end if;

  select * into v_stock
  from public.food_inventory
  where id=p_inventory_id and user_id=v_user and is_active=true
  for update;

  if not found then raise exception 'Kreatin-Vorrat nicht gefunden'; end if;
  if lower(coalesce(v_stock.name,'')) !~ '^esn .*creatine.*sticks'
     and lower(coalesce(v_stock.name,'')) !~ '^esn .*kreatin.*sticks' then
    raise exception 'Ausgewählter Vorrat ist kein ESN-Kreatin-Stick';
  end if;
  if lower(coalesce(v_stock.unit,'')) <> 'g' then
    raise exception 'Kreatin muss im Vorrat in Gramm geführt werden';
  end if;
  if v_stock.quantity is null or v_stock.quantity < 4 then
    raise exception 'Nicht genügend Kreatin auf Vorrat: mindestens 1 Stick (4 g) nötig';
  end if;

  v_after:=v_stock.quantity-4;
  v_variant:=coalesce(nullif(btrim(v_stock.variant_label),''),v_stock.name);

  perform public.consume_food_inventory_lots(v_stock.id,4,'g');

  update public.food_inventory
  set quantity=v_after,
      quantity_label=public.food_inventory_lot_label(v_stock.id,v_after,'g'),
      forecast_label=null,
      tone=case when v_after=0 then 'empty' else
        case when tone='empty' then 'stock' else tone end end,
      opened=true,
      updated_at=now()
  where id=v_stock.id and user_id=v_user;

  insert into public.food_inventory_movements
    (user_id,inventory_id,kind,delta,quantity_before,quantity_after,note)
  values
    (v_user,v_stock.id,'consume',-4,v_stock.quantity,v_after,
     'ESN-Kreatin · 1 Stick · bestätigt für '||to_char(p_intake_date,'DD.MM.YYYY'))
  returning id into v_movement;

  update public.food_creatine_intakes
  set inventory_name=v_stock.name,variant_label=v_variant,
      movement_id=v_movement,confirmed_at=now()
  where id=v_intake_id;

  return jsonb_build_object(
    'already_confirmed',false,
    'intake_date',p_intake_date,
    'variant',v_variant,
    'quantity_g',4,
    'remaining_g',v_after,
    'confirmed_at',now()
  );
end;
$$;
revoke all on function public.confirm_daily_creatine_intake(date,uuid) from public,anon;
grant execute on function public.confirm_daily_creatine_intake(date,uuid) to authenticated;
comment on table public.food_creatine_intakes is 'Once-daily user-confirmed ESN creatine sticks; booking happens atomically in RPC.';
comment on function public.confirm_daily_creatine_intake(date,uuid) is 'Confirms one daily creatine stick only after user action and atomically decrements 4g stock, lot and movement log; idempotent by user and date.';
