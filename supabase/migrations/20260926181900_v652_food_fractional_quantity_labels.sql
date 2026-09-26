-- V652 · FOOD: Dezimalmengen exakt anzeigen
-- Behebt Rundung von z. B. 454,5 g -> 455 g durch PostgreSQL-to_char(...D##).
-- Anzeige bleibt auf maximal zwei Nachkommastellen und nutzt deutsches Dezimalkomma.

create or replace function public.food_quantity_label(p_quantity numeric, p_unit text)
returns text
language sql
immutable
set search_path to 'public','pg_temp'
as $function$
  select case
    when p_quantity is null then 'Menge offen'
    when p_unit is null or p_unit='' then
      replace(rtrim(rtrim(round(p_quantity, 2)::text, '0'), '.'), '.', ',')
    else
      replace(rtrim(rtrim(round(p_quantity, 2)::text, '0'), '.'), '.', ',') || ' ' || p_unit
  end;
$function$;

-- Nur eindeutig durch die alte Rundungslogik erzeugte Labels reparieren.
-- Individuelle Labels wie "7,5 l (6 × 1,25 l)" bleiben erhalten.
update public.food_inventory
set quantity_label = public.food_quantity_label(quantity, unit),
    updated_at = now()
where quantity is not null
  and quantity <> trunc(quantity)
  and quantity_label = (
    round(quantity)::text ||
    case when coalesce(unit,'')='' then '' else ' ' || unit end
  );
