-- V936: position-specific display and explicit miso stock identity.
CREATE OR REPLACE FUNCTION public.food_ingredient_dynamic_family()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_family text; v_stock_family text; v_status text; v_name text;
begin
 if nullif(btrim(coalesce(new.name,'')),'') is null then return new; end if;
 if tg_table_name='food_meal_ingredients' then
  -- Do not interfere with the temporary unit conversions inside meal completion.
  if tg_op='UPDATE' and new.unit is distinct from old.unit
     and new.name is not distinct from old.name
     and new.inventory_id is not distinct from old.inventory_id then
    return new;
  end if;
  select status into v_status from public.food_meals where id=new.meal_id and user_id=new.user_id;
  if v_status is distinct from 'planned' then return new; end if;
  if new.allocation_override is not null and new.allocation_override <> '[]'::jsonb then return new; end if;
 end if;
 -- Explicit Miso variants are not interchangeable. Preserve exact inventory linkage.
 if lower(btrim(new.name)) in ('miso-paste hell','misopaste, hell','miso-paste dunkel','misopaste, dunkel') then
   select id,name into new.inventory_id,new.name from public.food_inventory
   where user_id=new.user_id and is_active and unit=new.unit
   and lower(name)=case when lower(new.name) like '%hell%' then 'miso-paste hell' else 'miso-paste dunkel' end;
   if new.inventory_id is null then raise exception 'Ausdrückliche Misopaste-Variante fehlt im Vorratsstamm'; end if;
   return new;
 end if;
 if new.inventory_id is not null then
  select family_name into v_stock_family from public.food_inventory
  where id=new.inventory_id and user_id=new.user_id and is_active;
 end if;
 if v_stock_family is not null then
   v_family:=v_stock_family;
 else
   -- Synonyme zuerst normalisieren (Salatgurke→Gurke, Kiwi, Chia Samen usw.).
   v_family:=public.food_canonical_ingredient_family(new.name);
   if v_family is null or lower(btrim(v_family))=lower(btrim(new.name)) then
     select f.name into v_family from public.food_ingredient_family_terms t
     join public.food_ingredient_families f on f.id=t.family_id
     where t.user_id=new.user_id and lower(btrim(t.term))=lower(btrim(new.name))
       and lower(btrim(t.unit))=lower(btrim(coalesce(new.unit,''))) limit 1;
     if v_family is null then v_family:=public.food_canonical_ingredient_family(new.name); end if;
   end if;
 end if;
 if v_family is null then return new; end if;
 v_name:=lower(btrim(new.name));
 if v_family='Spinat' and v_name ~ '(tk|tiefkühl|tiefgefroren)' then v_family:='Spinat TK'; end if;
 if v_family='Spinat' and v_name ~ '(babyspinat|frisch)' then v_family:='Spinat frisch'; end if;
 if v_family='Paprika rot' and v_name ~ '(tk|tiefkühl|gefroren)' then v_family:='Paprika rot TK'; end if;
 if v_family='Eier' and v_name ~ '(größe m|groesse m)' then v_family:='Eier Größe M'; end if;
 if v_family='Eier' and v_name ~ '(größe l|groesse l)' then v_family:='Eier Größe L'; end if;
 if v_family='Feta / Hirtenkäse' and v_name ~ '(light|leicht)' then v_family:='Feta / Hirtenkäse leicht'; end if;
 new.name:=v_family;
 new.inventory_id:=null;
 return new;
end $function$
;
create or replace view public.food_catalog_recipe_positions_v1 with (security_invoker=true) as
 WITH base AS (
         SELECT i.user_id,
            'recipe'::text AS source_kind,
            i.recipe_id AS parent_id,
            i.id AS ingredient_id,
            i.name AS original_name,
            i.label,
            i.inventory_id,
            'template'::text AS status,
            NULL::jsonb AS snapshot
           FROM food_recipe_ingredients i
        UNION ALL
         SELECT i.user_id,
            'meal'::text,
            i.meal_id,
            i.id,
            i.name,
            i.label,
            i.inventory_id,
            m.status,
            m.prepared_sources_snapshot
           FROM food_meal_ingredients i
             JOIN food_meals m ON m.id = i.meal_id AND m.user_id = i.user_id
        ), evidence AS (
         SELECT b.user_id,
            b.source_kind,
            b.parent_id,
            b.ingredient_id,
            b.original_name,
            b.label,
            b.inventory_id,
            b.status,
            b.snapshot,
            v.canonical_name AS base_name,
            v.family_name,
            v.resolution AS base_resolution,
                CASE
                    WHEN b.original_name = ANY (ARRAY['Spinat'::text, 'Blattspinat'::text]) THEN 'spinach'::text
                    WHEN b.original_name = 'Kartoffeln'::text THEN 'potatoes'::text
                    WHEN b.original_name = 'Zwiebel'::text THEN 'onions'::text
                    WHEN b.original_name = 'Miso-Paste'::text THEN 'miso'::text
                    ELSE NULL::text
                END AS kind,
            e.names
           FROM base b
             LEFT JOIN food_catalog_recipe_identity_v1 v ON v.user_id = b.user_id AND NOT v.inventory_id IS DISTINCT FROM b.inventory_id AND v.source_name = COALESCE(NULLIF(btrim(b.original_name), ''::text), b.label)
             LEFT JOIN LATERAL ( SELECT array_agg(DISTINCT x.variant ORDER BY x.variant) FILTER (WHERE x.variant IS NOT NULL) AS names
                   FROM jsonb_array_elements(
                        CASE
                            WHEN jsonb_typeof(b.snapshot -> 'sources'::text) = 'array'::text THEN b.snapshot -> 'sources'::text
                            ELSE '[]'::jsonb
                        END) s(value)
                     CROSS JOIN LATERAL ( SELECT concat_ws(' '::text, s.value ->> 'name'::text, s.value ->> 'label'::text) AS txt) d
                     CROSS JOIN LATERAL ( SELECT
                                CASE
                                    WHEN (b.original_name = ANY (ARRAY['Spinat'::text, 'Blattspinat'::text])) AND d.txt ~* 'spinat'::text THEN
                                    CASE
WHEN (s.value ->> 'frozen'::text) = 'true'::text OR d.txt ~* '(\mTK\M|tiefgefroren|tiefgekühlt)'::text THEN 'Blattspinat, tiefgekühlt'::text
WHEN (s.value ->> 'frozen'::text) = 'false'::text OR d.txt ~* 'frisch|babyspinat'::text THEN 'Blattspinat, frisch'::text
ELSE NULL::text
                                    END
                                    WHEN b.original_name = 'Kartoffeln'::text AND d.txt ~* 'kartoffel'::text THEN
                                    CASE
WHEN d.txt ~* 'vorwiegend festkochend'::text THEN 'Kartoffeln, vorwiegend festkochend'::text
WHEN d.txt ~* 'mehlig'::text THEN 'Kartoffeln, mehligkochend'::text
WHEN d.txt ~* 'festkochend'::text THEN 'Kartoffeln, festkochend'::text
ELSE NULL::text
                                    END
                                    WHEN b.original_name = 'Zwiebel'::text AND ((s.value ->> 'name'::text) = 'Zwiebel'::text OR d.txt ~* 'Speisezwiebeln|Zwiebelwürfel|Zwiebeln TK'::text) THEN
                                    CASE
WHEN (s.value ->> 'frozen'::text) = 'true'::text OR d.txt ~* '(\mTK\M|tiefgefroren|tiefgekühlt)'::text THEN 'Zwiebeln, tiefgekühlt'::text
WHEN (s.value ->> 'frozen'::text) = 'false'::text THEN 'Zwiebeln, frisch, Farbe nicht dokumentiert'::text
ELSE NULL::text
                                    END
                                    WHEN b.original_name = 'Miso-Paste'::text AND d.txt ~* 'miso'::text THEN
                                    CASE
WHEN d.txt ~* 'dunkel'::text THEN 'Misopaste, dunkel'::text
WHEN d.txt ~* 'hell|weiße'::text THEN 'Misopaste, hell'::text
ELSE NULL::text
                                    END
                                    ELSE NULL::text
                                END AS variant) x
                  WHERE b.status = 'completed'::text) e ON true
        ), classified AS (
         SELECT evidence.user_id,
            evidence.source_kind,
            evidence.parent_id,
            evidence.ingredient_id,
            evidence.original_name,
            evidence.label,
            evidence.inventory_id,
            evidence.status,
            evidence.snapshot,
            evidence.base_name,
            evidence.family_name,
            evidence.base_resolution,
            evidence.kind,
            evidence.names,
                CASE
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind IS NOT NULL AND evidence.status = 'completed'::text AND cardinality(evidence.names) > 0 THEN array_to_string(evidence.names, ' + '::text)
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind = 'miso'::text AND evidence.label ~* 'dunkl'::text THEN 'Misopaste, dunkel'::text
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind = 'miso'::text AND evidence.label ~* 'hell'::text THEN 'Misopaste, hell'::text
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind = 'potatoes'::text AND evidence.status <> 'completed'::text AND evidence.label ~* 'vorwiegend festkochend'::text THEN 'Kartoffeln, vorwiegend festkochend'::text
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind = 'potatoes'::text AND evidence.status <> 'completed'::text THEN 'Kartoffeln, festkochend oder vorwiegend festkochend'::text
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind = 'onions'::text AND evidence.status <> 'completed'::text THEN 'Zwiebeln'::text
                    ELSE COALESCE(evidence.base_name, evidence.original_name, evidence.label)
                END AS final_name,
                CASE
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind IS NOT NULL AND evidence.status = 'completed'::text AND cardinality(evidence.names) > 0 THEN 'historical_documented'::text
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind = 'miso'::text AND evidence.label ~* 'dunkl|hell'::text THEN 'matched'::text
                    WHEN evidence.base_resolution = 'variant_open'::text AND evidence.kind = 'potatoes'::text AND evidence.status <> 'completed'::text AND evidence.label ~* 'vorwiegend festkochend'::text THEN 'matched'::text
                    WHEN evidence.base_resolution = 'variant_open'::text AND (evidence.kind = ANY (ARRAY['onions'::text, 'potatoes'::text])) AND evidence.status <> 'completed'::text THEN 'flexible'::text
                    ELSE evidence.base_resolution
                END AS final_resolution
           FROM evidence
        )
 SELECT user_id,
    source_kind,
    parent_id,
    ingredient_id,
    original_name,
    final_name AS canonical_name,
    family_name,
    final_resolution AS resolution
   FROM classified;;
revoke all on public.food_catalog_recipe_positions_v1 from public, anon;
grant select on public.food_catalog_recipe_positions_v1 to authenticated;
