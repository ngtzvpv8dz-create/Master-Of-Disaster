-- V543 FOOD foundation. Planning never mutates confirmed inventory by itself.
create table if not exists public.food_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast','snack','lunch','dinner')),
  title text not null,
  status text not null check (status in ('planned','prepared','consumed')),
  sort_order smallint not null check (sort_order > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, meal_date, meal_type)
);

create table if not exists public.food_meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.food_meals(id) on delete cascade,
  label text not null,
  quantity numeric,
  unit text,
  quantity_confirmed boolean not null default true,
  sort_order smallint not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (meal_id, sort_order)
);

create table if not exists public.food_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  quantity_label text not null,
  forecast_label text,
  tone text not null default 'stock' check (tone in ('fresh','priority','stock','empty')),
  note text,
  sort_order smallint not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists food_meals_user_date_idx on public.food_meals (user_id, meal_date, sort_order);
create index if not exists food_meal_ingredients_meal_idx on public.food_meal_ingredients (meal_id, sort_order);
create index if not exists food_meal_ingredients_user_idx on public.food_meal_ingredients (user_id);
create index if not exists food_inventory_user_order_idx on public.food_inventory (user_id, sort_order);

alter table public.food_meals enable row level security;
alter table public.food_meal_ingredients enable row level security;
alter table public.food_inventory enable row level security;

create policy food_meals_owner_all on public.food_meals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy food_meal_ingredients_owner_all on public.food_meal_ingredients for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy food_inventory_owner_all on public.food_inventory for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.food_meals, public.food_meal_ingredients, public.food_inventory to authenticated;
revoke all on public.food_meals, public.food_meal_ingredients, public.food_inventory from anon;

create or replace view public.food_inventory_overview with (security_invoker=true) as
select user_id,name,quantity_label,forecast_label,tone,note,sort_order from public.food_inventory;
grant select on public.food_inventory_overview to authenticated;
revoke all on public.food_inventory_overview from anon;

with app_user as (select user_id from public.app_state order by updated_at desc limit 1),
seed(meal_type,title,status,sort_order,note) as (values
 ('breakfast','Skyr-Bananen-Bowl','consumed',1,'Frühstück ist bestätigt gegessen.'),
 ('snack','Apfel & Mandeln','prepared',2,'Menge geplant; noch nicht als vollständig gegessen bestätigt.'),
 ('lunch','Roggenbrot mit Pute & Gurke','prepared',3,'Zusammengestellt; noch nicht als vollständig gegessen bestätigt.'),
 ('dinner','Hähnchen, Kartoffeln & Brokkoli','planned',4,'Für heute Abend geplant. Noch nichts davon wurde vom Bestand abgezogen.')
)
insert into public.food_meals(user_id,meal_date,meal_type,title,status,sort_order,note)
select app_user.user_id,date '2026-09-18',seed.meal_type,seed.title,seed.status,seed.sort_order,seed.note from app_user cross join seed
on conflict (user_id,meal_date,meal_type) do update set title=excluded.title,status=excluded.status,sort_order=excluded.sort_order,note=excluded.note,updated_at=now();

with ingredient(meal_type,label,quantity,unit,quantity_confirmed,sort_order) as (values
 ('breakfast','250 g Skyr Natur',250::numeric,'g',true,1),('breakfast','1 Banane',1,'Stück',true,2),('breakfast','3 EL zarte Haferflocken',3,'EL',true,3),
 ('snack','1 Apfel',1,'Stück',true,1),('snack','25 g Mandeln natur',25,'g',true,2),
 ('lunch','2 Scheiben Roggen-Vollkornbrot · 111 g',111,'g',true,1),('lunch','100 g Putenbrust',100,'g',true,2),('lunch','30 g Frischkäse Balance',30,'g',true,3),('lunch','118 g Gurke auf dem Brot',118,'g',true,4),('lunch','106 g Tomaten separat',106,'g',true,5),
 ('dinner','200 g Hähnchenbrust',200,'g',true,1),('dinner','300 g Kartoffeln',300,'g',true,2),('dinner','300 g Brokkoli',300,'g',true,3),('dinner','2–3 EL Magerquark als Dip',null,'EL',false,4)
), target as (select m.id,m.user_id,m.meal_type from public.food_meals m where m.meal_date=date '2026-09-18' and m.user_id=(select user_id from public.app_state order by updated_at desc limit 1))
insert into public.food_meal_ingredients(user_id,meal_id,label,quantity,unit,quantity_confirmed,sort_order)
select target.user_id,target.id,ingredient.label,ingredient.quantity,ingredient.unit,ingredient.quantity_confirmed,ingredient.sort_order from target join ingredient using(meal_type)
on conflict (meal_id,sort_order) do update set label=excluded.label,quantity=excluded.quantity,unit=excluded.unit,quantity_confirmed=excluded.quantity_confirmed;

with app_user as (select user_id from public.app_state order by updated_at desc limit 1),
seed(name,quantity,unit,quantity_label,forecast_label,tone,note,sort_order) as (values
 ('Gurke',324::numeric,'g','324 g',null,'fresh','442 g gewogen · 118 g fürs Mittag vorbereitet',1),
 ('Tomaten · Fruchtig & Süß',394,'g','394 g',null,'fresh','500-g-Packung · 106 g separat zum Mittag',2),
 ('Brokkoli',500,'g','500 g','200 g nach dem Abendessen','priority','300 g sind erst geplant, nicht verbraucht',3),
 ('Hähnchenbrustfilet',600,'g','600 g','400 g nach dem Abendessen','priority','200 g sind erst geplant, nicht verbraucht',4),
 ('Kartoffeln',2500,'g','2.500 g','2.200 g nach dem Abendessen','stock','300 g fürs Abendessen geplant',5),
 ('Skyr Natur',250,'g','250 g',null,'priority','250 g beim Frühstück gegessen',6),
 ('Frischkäse Balance',270,'g','270 g',null,'fresh','30 g fürs Mittag vorbereitet',7),
 ('Magerquark',250,'g','250 g','Dip-Menge noch ungenau','stock','2–3 EL geplant; keine Grammzahl erfunden',8),
 ('Roggen-Vollkornbrot',389,'g','ca. 389 g · 7 Scheiben',null,'fresh','500 g / 9 Scheiben · 2 Scheiben = ca. 111 g',9),
 ('Putenbrust',0,'g','0 g',null,'empty','100-g-Packung fürs Mittag verwendet',10),
 ('Bananen',4,'Stück','4 Stück',null,'fresh','5 gekauft · 1 beim Frühstück gegessen',11),
 ('Äpfel grün',8,'Stück','8 Stück gekauft','7 nach dem Snack','stock','1 Stück geplant, noch nicht bestätigt gegessen',12),
 ('Mandeln natur',200,'g','200 g gekauft','175 g nach dem Snack','stock','25 g geplant, noch nicht bestätigt gegessen',13),
 ('Zarte Haferflocken',null,'g','Rest nicht grammgenau',null,'stock','500-g-Packung · 3 EL beim Frühstück verwendet',14),
 ('Hackfleisch gemischt',800,'g','800 g',null,'stock','Noch keiner heutigen Mahlzeit zugeordnet',15),
 ('Pepsi Zero Cherry',7.5,'l','6 × 1,25 l',null,'stock','Getränkevorrat',16)
)
insert into public.food_inventory(user_id,name,quantity,unit,quantity_label,forecast_label,tone,note,sort_order)
select app_user.user_id,seed.* from app_user cross join seed
on conflict (user_id,name) do update set quantity=excluded.quantity,unit=excluded.unit,quantity_label=excluded.quantity_label,forecast_label=excluded.forecast_label,tone=excluded.tone,note=excluded.note,sort_order=excluded.sort_order,updated_at=now();
