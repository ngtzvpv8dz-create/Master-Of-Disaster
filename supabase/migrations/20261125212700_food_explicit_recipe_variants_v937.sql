-- V937: preserve explicit recipe variant identity and complete position-level reconciliation.
CREATE OR REPLACE FUNCTION public.food_explicit_recipe_stock_v937(p_name text, p_label text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
select case
when lower(btrim(coalesce(p_name,''))) in ('wraps','tortilla wraps vollkorn','tortilla-wraps vollkorn','wraps, vollkorn','karotten-wraps · edeka herzstücke','rote-bete-wraps · edeka herzstücke','wraps, karotte','wraps, rote bete') then
 case when concat_ws(' ',p_name,p_label) ~* 'nach MHD|Sorte aus Vorrat' then null
 when concat_ws(' ',p_name,p_label) ~* 'vollkorn' then 'Tortilla Wraps Vollkorn'
 when concat_ws(' ',p_name,p_label) ~* 'karotten|wraps, karotte' then 'Karotten-Wraps · EDEKA Herzstücke'
 when concat_ws(' ',p_name,p_label) ~* 'rote.bete' then 'Rote-Bete-Wraps · EDEKA Herzstücke' end
when lower(btrim(coalesce(p_name,''))) in ('mais','mais dose','mais, konserve','sonnenmais konserve') and concat_ws(' ',p_name,p_label) ~* 'konserve|dose' then 'Sonnenmais Konserve'
when lower(btrim(coalesce(p_name,''))) in ('champignons','champignons braun','champignons, braun, frisch','champignons, braun') and concat_ws(' ',p_name,p_label) ~* 'braun' then 'Champignons braun'
when lower(btrim(coalesce(p_name,''))) in ('chio dip salsa','chio dip mild salsa','chio dip hot salsa','salsa mild','salsa scharf','salsa, mild','salsa, scharf') then
 case when concat_ws(' ',p_name,p_label) ~* 'mild' then 'Chio Dip Mild Salsa'
 when concat_ws(' ',p_name,p_label) ~* 'scharf|hot' then 'Chio Dip Hot Salsa' end
when lower(btrim(coalesce(p_name,''))) in ('feta / hirtenkäse','feta / hirtenkäse leicht','hirtenkäse','hirtenkäse leicht','hirtenkäse, leicht','hirtenkäse normal','hirtenkäse, normal') then
 case when concat_ws(' ',p_name,p_label) ~* 'leicht|light|fettreduziert|27 %' then 'Hirtenkäse'
 when concat_ws(' ',p_name,p_label) ~* 'normal|45 %' then 'Hirtenkäse normal' end
when lower(btrim(coalesce(p_name,''))) in ('schnittkäse','käseaufschnitt leicht','schnittkäse, fettreduziert') and concat_ws(' ',p_name,p_label) ~* 'leicht|fettreduziert' then 'Käseaufschnitt leicht'
end
$function$
;

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
   v_name:=case when lower(new.name) like '%hell%' then 'Miso-Paste hell' else 'Miso-Paste dunkel' end;
   select id into new.inventory_id from public.food_inventory
   where user_id=new.user_id and is_active and unit=new.unit and lower(name)=lower(v_name);
   -- A missing inventory row must not block future recipe planning.
   new.name:=v_name;
   return new;
 end if;
 -- Preserve explicitly requested compatible product variants. Generic MHD-based
 -- recipe choices retain the existing family allocation behavior.
 v_name:=public.food_explicit_recipe_stock_v937(new.name,new.label);
 if v_name is not null then
   select id into new.inventory_id from public.food_inventory
   where user_id=new.user_id and is_active and unit=new.unit and lower(name)=lower(v_name);
   new.name:=v_name;
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
 WITH base AS MATERIALIZED (
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
                    'meal'::text AS text,
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
         SELECT classified.user_id,
            classified.source_kind,
            classified.parent_id,
            classified.ingredient_id,
            classified.original_name,
            classified.final_name AS canonical_name,
            classified.family_name,
            classified.final_resolution AS resolution
           FROM classified
        ), details AS (
         SELECT b.user_id,
            b.source_kind,
            b.parent_id,
            b.ingredient_id,
            b.original_name,
            b.canonical_name,
            b.family_name,
            b.resolution,
            COALESCE(r.label, i.label, ''::text) AS source_label,
            COALESCE(m.status, 'template'::text) AS status,
            m.prepared_sources_snapshot AS snapshot
           FROM base b
             LEFT JOIN food_recipe_ingredients r ON b.source_kind = 'recipe'::text AND b.ingredient_id = r.id AND b.user_id = r.user_id
             LEFT JOIN food_meal_ingredients i ON b.source_kind = 'meal'::text AND b.ingredient_id = i.id AND b.user_id = i.user_id
             LEFT JOIN food_meals m ON b.source_kind = 'meal'::text AND b.parent_id = m.id AND b.user_id = m.user_id
          WHERE b.resolution = 'family_only'::text
        ), evidence AS (
         SELECT d.user_id,
            d.source_kind,
            d.parent_id,
            d.ingredient_id,
            d.original_name,
            d.canonical_name,
            d.family_name,
            d.resolution,
            d.source_label,
            d.status,
            d.snapshot,
            e.names
           FROM details d
             LEFT JOIN LATERAL ( SELECT array_agg(DISTINCT v.name ORDER BY v.name) FILTER (WHERE v.name IS NOT NULL) AS names
                   FROM jsonb_array_elements(
                        CASE
                            WHEN jsonb_typeof(d.snapshot -> 'sources'::text) = 'array'::text THEN d.snapshot -> 'sources'::text
                            ELSE '[]'::jsonb
                        END) s(value)
                     CROSS JOIN LATERAL ( SELECT concat_ws(' '::text, s.value ->> 'name'::text, s.value ->> 'label'::text) AS txt) x
                     CROSS JOIN LATERAL ( SELECT
                                CASE
                                    WHEN d.original_name = 'Wraps'::text AND x.txt ~* 'wrap'::text THEN
                                    CASE
WHEN x.txt ~* 'vollkorn'::text THEN 'Wraps, Vollkorn'::text
WHEN x.txt ~* 'karotten'::text THEN 'Wraps, Karotte'::text
WHEN x.txt ~* 'rote.bete'::text THEN 'Wraps, Rote Bete'::text
ELSE NULL::text
                                    END
                                    WHEN d.original_name = 'Chio Dip Salsa'::text AND x.txt ~* 'salsa'::text THEN
                                    CASE
WHEN x.txt ~* 'mild'::text THEN 'Salsa, mild'::text
WHEN x.txt ~* 'hot|scharf'::text THEN 'Salsa, scharf'::text
ELSE NULL::text
                                    END
                                    WHEN d.original_name = 'Feta / Hirtenkäse'::text AND x.txt ~* 'feta|hirtenkäse'::text THEN
                                    CASE
WHEN x.txt ~* 'leicht|27 %'::text THEN 'Hirtenkäse, leicht'::text
WHEN x.txt ~* 'normal|45 %'::text THEN 'Hirtenkäse, normal'::text
WHEN x.txt ~* 'hirtenkäse'::text THEN 'Hirtenkäse'::text
WHEN x.txt ~* 'feta'::text THEN 'Feta'::text
ELSE NULL::text
                                    END
                                    WHEN d.original_name = 'Kiwi'::text AND x.txt ~* 'kiwi'::text THEN
                                    CASE
WHEN x.txt ~* 'green|grün'::text THEN 'Kiwi, grün'::text
WHEN x.txt ~* 'gold'::text THEN 'Kiwi, gold'::text
ELSE 'Kiwi, frisch, Farbe nicht dokumentiert'::text
                                    END
                                    WHEN d.original_name = 'Schnittkäse'::text AND x.txt ~* 'schnittkäse|käseaufschnitt|gouda'::text THEN
                                    CASE
WHEN x.txt ~* 'leicht|fettreduziert'::text THEN 'Schnittkäse, fettreduziert'::text
ELSE 'Schnittkäse'::text
                                    END
                                    WHEN d.original_name = 'Asia-Gemüse'::text AND x.txt ~* 'asiatisch|asia.gemüse|wokgemüse'::text THEN
                                    CASE
WHEN x.txt ~* 'bio'::text THEN 'Wokgemüse, tiefgekühlt, Bio'::text
ELSE 'Wokgemüse, tiefgekühlt'::text
                                    END
                                    WHEN d.original_name = 'Mais'::text AND x.txt ~* 'sonnenmais|dosenmais|mais konserve'::text THEN 'Mais, Konserve'::text
                                    WHEN d.original_name = 'Blattsalat'::text AND x.txt ~* 'blattsalat'::text THEN
                                    CASE
WHEN x.txt ~* 'mix'::text THEN 'Blattsalat, Mischung'::text
ELSE 'Blattsalat, frisch'::text
                                    END
                                    ELSE NULL::text
                                END AS name) v
                  WHERE d.status = 'completed'::text) e ON true
        ), classified AS (
         SELECT evidence.user_id,
            evidence.source_kind,
            evidence.parent_id,
            evidence.ingredient_id,
            evidence.original_name,
            evidence.family_name,
                CASE
                    WHEN cardinality(evidence.names) > 0 THEN array_to_string(evidence.names, ' + '::text)
                    WHEN evidence.original_name = 'Wasser'::text THEN 'Wasser'::text
                    WHEN evidence.original_name = 'Wraps'::text THEN 'Wraps (Sorte nach Vorrat und MHD)'::text
                    WHEN evidence.original_name = 'Chio Dip Salsa'::text THEN 'Salsa'::text
                    WHEN evidence.original_name = 'Feta / Hirtenkäse'::text THEN
                    CASE
                        WHEN evidence.source_label ~* 'leicht|light'::text THEN 'Hirtenkäse, leicht'::text
                        WHEN evidence.source_label ~* 'normal'::text THEN 'Hirtenkäse, normal'::text
                        ELSE 'Feta oder Hirtenkäse'::text
                    END
                    WHEN evidence.original_name = 'Kiwi'::text THEN
                    CASE
                        WHEN evidence.source_label ~* 'green|grün'::text THEN 'Kiwi, grün'::text
                        WHEN evidence.source_label ~* 'gold'::text THEN 'Kiwi, gold'::text
                        ELSE 'Kiwi, frisch'::text
                    END
                    WHEN evidence.original_name = 'Schnittkäse'::text THEN
                    CASE
                        WHEN evidence.source_label ~* 'leicht|fettreduziert'::text THEN 'Schnittkäse, fettreduziert'::text
                        ELSE 'Schnittkäse'::text
                    END
                    WHEN evidence.original_name = 'Asia-Gemüse'::text THEN 'Wokgemüse, tiefgekühlt'::text
                    WHEN evidence.original_name = ANY (ARRAY['Blattsalat'::text, 'Blattsalat roh'::text]) THEN 'Blattsalat, frisch'::text
                    WHEN evidence.original_name = 'Mageres Rindfleisch'::text THEN 'Rindfleisch, mager'::text
                    WHEN evidence.original_name = 'Tomatensalsa'::text THEN 'Salsa, Tomate'::text
                    WHEN evidence.original_name = 'Öl'::text THEN 'Speiseöl zum Anbraten'::text
                    WHEN evidence.original_name = 'Mais'::text AND evidence.source_label ~* 'konserve|dose|sonnenmais'::text THEN 'Mais, Konserve'::text
                    WHEN evidence.original_name IS NULL AND evidence.family_name = 'Vollkornbrot'::text THEN 'Roggenvollkornbrot'::text
                    WHEN evidence.original_name IS NULL AND evidence.family_name = 'Schwein'::text AND evidence.source_label ~* 'schnitzel'::text THEN 'Schweineschnitzel, paniert'::text
                    WHEN evidence.original_name IS NULL AND evidence.family_name = 'Kartoffeln'::text AND evidence.source_label ~* 'kartoffelbrei'::text THEN 'Kartoffelbrei'::text
                    WHEN evidence.original_name IS NULL AND evidence.family_name = 'Fleischbällchen'::text AND evidence.source_label ~* 'köttbullar'::text THEN 'Köttbullar'::text
                    WHEN evidence.original_name IS NULL THEN evidence.family_name
                    ELSE evidence.canonical_name
                END AS canonical_name,
                CASE
                    WHEN cardinality(evidence.names) > 0 THEN 'historical_documented'::text
                    WHEN evidence.original_name = 'Wasser'::text THEN 'nonstock'::text
                    WHEN evidence.original_name ~* '^(protein coffee classic coffee|maxinutrition maxpresso protein coffee|esn isoclear|barebells vegan protein bar|aldi |monster energy|knorr würzige|ja! steinofen|schinkenkrakauer|burrito.bowl)'::text THEN 'named_product'::text
                    WHEN evidence.status = 'completed'::text THEN 'historical_recorded'::text
                    WHEN evidence.original_name = ANY (ARRAY['Wraps'::text, 'Chio Dip Salsa'::text, 'Feta / Hirtenkäse'::text, 'Kiwi'::text, 'Schnittkäse'::text, 'Asia-Gemüse'::text, 'Blattsalat'::text, 'Blattsalat roh'::text, 'Mageres Rindfleisch'::text, 'Mandelmus'::text, 'Tomatensalsa'::text, 'Öl'::text]) THEN 'flexible'::text
                    WHEN evidence.original_name = 'Mais'::text AND evidence.source_label ~* 'konserve|dose|sonnenmais'::text THEN 'matched_position'::text
                    ELSE 'review_required'::text
                END AS resolution
           FROM evidence
        )
 SELECT base.user_id,
    base.source_kind,
    base.parent_id,
    base.ingredient_id,
    base.original_name,
    base.canonical_name,
    base.family_name,
    base.resolution
   FROM base
  WHERE base.resolution <> 'family_only'::text
UNION ALL
 SELECT classified.user_id,
    classified.source_kind,
    classified.parent_id,
    classified.ingredient_id,
    classified.original_name,
    classified.canonical_name,
    classified.family_name,
    classified.resolution
   FROM classified;;
revoke all on public.food_catalog_recipe_positions_v1 from public, anon;
grant select on public.food_catalog_recipe_positions_v1 to authenticated;
