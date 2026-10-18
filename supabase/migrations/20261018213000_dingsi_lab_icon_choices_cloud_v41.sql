-- V41 Dingsi Lab: persistent, user-owned icon variants and favorites.
-- Only lab selections; never modifies the real homescreen or icon files.
create table if not exists public.dingsi_lab_icon_choices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_variant text not null default 'I01',
  chosen_variant text,
  favorite_variants text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  constraint dingsi_lab_icon_choices_active_check
    check (active_variant ~ '^I(0[1-9]|1[0-2])$'),
  constraint dingsi_lab_icon_choices_chosen_check
    check (chosen_variant is null or chosen_variant ~ '^I(0[1-9]|1[0-2])$'),
  constraint dingsi_lab_icon_choices_favorites_check
    check (favorite_variants <@ array[
      'I01','I02','I03','I04','I05','I06',
      'I07','I08','I09','I10','I11','I12'
    ]::text[])
);
comment on table public.dingsi_lab_icon_choices is
  'Dingsi Lab Icon-Ische Variacionen: user-owned saved variant, chosen variant and favorites for remote reading.';
alter table public.dingsi_lab_icon_choices enable row level security;
revoke all on table public.dingsi_lab_icon_choices from anon;
grant select, insert, update on table public.dingsi_lab_icon_choices to authenticated;
drop policy if exists "dingsi_lab_icon_choices_select_own" on public.dingsi_lab_icon_choices;
create policy "dingsi_lab_icon_choices_select_own"
 on public.dingsi_lab_icon_choices for select to authenticated
 using ((select auth.uid()) = user_id);
drop policy if exists "dingsi_lab_icon_choices_insert_own" on public.dingsi_lab_icon_choices;
create policy "dingsi_lab_icon_choices_insert_own"
 on public.dingsi_lab_icon_choices for insert to authenticated
 with check ((select auth.uid()) = user_id);
drop policy if exists "dingsi_lab_icon_choices_update_own" on public.dingsi_lab_icon_choices;
create policy "dingsi_lab_icon_choices_update_own"
 on public.dingsi_lab_icon_choices for update to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);