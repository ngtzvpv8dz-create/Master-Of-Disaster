-- FOOD v1: avoid repeated correlated catalog lookups per ingredient candidate.
-- Same matching priorities; preserve invoker permissions and owner-scoped RLS.
CREATE OR REPLACE VIEW public.food_catalog_recipe_identity_v1 WITH (security_invoker=true) AS
 WITH source_rows AS (
         SELECT food_recipe_ingredients.user_id,
            food_recipe_ingredients.inventory_id,
            COALESCE(NULLIF(btrim(food_recipe_ingredients.name), ''::text), food_recipe_ingredients.label) AS source_name
           FROM food_recipe_ingredients
        UNION ALL
         SELECT food_meal_ingredients.user_id,
            food_meal_ingredients.inventory_id,
            COALESCE(NULLIF(btrim(food_meal_ingredients.name), ''::text), food_meal_ingredients.label) AS "coalesce"
           FROM food_meal_ingredients
        ), source_keys AS (
         SELECT source_rows.user_id,
            source_rows.inventory_id,
            source_rows.source_name,
            count(*) AS position_count
           FROM source_rows
          GROUP BY source_rows.user_id, source_rows.inventory_id, source_rows.source_name
        ), aliases(source_name, target_name) AS (
         VALUES ('Spinat TK'::text,'Blattspinat, tiefgekühlt'::text), ('TK Spinat'::text,'Blattspinat, tiefgekühlt'::text), ('Blattspinat TK'::text,'Blattspinat, tiefgekühlt'::text), ('Spinat frisch'::text,'Blattspinat, frisch'::text), ('Babyspinat frisch'::text,'Blattspinat, frisch'::text), ('Spinat'::text,'Blattspinat, Zustand offen'::text), ('Blattspinat'::text,'Blattspinat, Zustand offen'::text), ('Mango (essbar)'::text,'Mango, frisch'::text), ('Mango frisch'::text,'Mango, frisch'::text), ('Apfel'::text,'Äpfel'::text), ('Ayran Natur'::text,'Ayran'::text), ('Batate'::text,'Süßkartoffeln, frisch'::text), ('Beerenmischung TK'::text,'Beerenmix, tiefgekühlt'::text), ('Blaubeeren'::text,'Heidelbeeren'::text), ('Blaubeeren frisch'::text,'Heidelbeeren'::text), ('Brokkoli TK'::text,'Brokkoli, tiefgekühlt'::text), ('Buschbohnen frisch'::text,'Grüne Bohnen, frisch'::text), ('Chia Samen'::text,'Chiasamen'::text), ('Edamame TK ohne Schote'::text,'Sojabohnen, Edamame/Mukimame, ausgelöst, tiefgekühlt'::text), ('Griechischer Joghurt 2 %'::text,'Joghurt, griechisch, natur, 2 % Fett'::text), ('Griechischer Joghurt 9,4 %'::text,'Joghurt, griechischer Art, natur, 9,4 % Fett'::text), ('Grüne Bohnen TK'::text,'Grüne Bohnen, tiefgekühlt'::text), ('Karotten / Möhren'::text,'Möhren'::text), ('Kichererbsen abgetropft'::text,'Kichererbsen, Konserve/Glas'::text), ('Kreuzkümmel gemahlen'::text,'Kreuzkümmel'::text), ('Mais abgetropft'::text,'Mais Dose'::text), ('Mandarinen/Clementinen'::text,'Mandarine'::text), ('Minze getrocknet'::text,'Minze, getrocknet'::text), ('Paprika orange'::text,'Paprika, orange, frisch'::text), ('Paprika TK bunt'::text,'Paprika, bunt, tiefgekühlt, Streifen'::text), ('Pita'::text,'Pitabrot'::text), ('Quinoa weiß'::text,'Quinoa, weiß'::text), ('Rinderhackfleisch Light'::text,'Rinderhack, mager, etwa 5 % Fett'::text), ('Thunfisch im eigenen Saft'::text,'Thunfisch, eigener Saft, Konserve'::text), ('TK-Erbsen'::text,'Erbsen, tiefgekühlt'::text), ('Zimt gemahlen'::text,'Zimt'::text), ('Zwiebeln TK'::text,'Zwiebeln, tiefgekühlt'::text), ('Zwiebeln TK gewürfelt'::text,'Zwiebeln, tiefgekühlt'::text), ('Zwiebeln TK in Scheiben'::text,'Zwiebeln, tiefgekühlt'::text), ('ELO Frost Zwiebelwürfel TK'::text,'Zwiebeln, tiefgekühlt'::text), ('Tortilla Wraps Vollkorn'::text,'Tortilla-Wraps Vollkorn'::text), ('Bananen'::text,'Banane'::text), ('Basilikum frisch (Balkon)'::text,'Basilikum, frisch'::text), ('Cashews'::text,'Cashewkerne, natur'::text), ('Chio Dip Mild Salsa'::text,'Salsa mild'::text), ('Chio Dip Hot Salsa'::text,'Salsa scharf'::text), ('Frischkäse leicht'::text,'Frischkäse, natur, fettreduziert'::text), ('Frischkäse Balance'::text,'Frischkäse, natur, fettreduziert'::text), ('Hackfleisch gemischt'::text,'Gemischtes Hack'::text), ('Körniger Frischkäse'::text,'Frischkäse, körnig'::text), ('Naturjoghurt 1,5 %'::text,'Joghurt, natur, 1,5 % Fett'::text), ('Paprika gelb'::text,'Paprika, gelb, frisch'::text), ('Paprika rot'::text,'Paprika, rot, frisch'::text), ('Blockpaprika grün'::text,'Paprika, grün, frisch'::text), ('Blockpaprika orange'::text,'Paprika, orange, frisch'::text), ('Paprikapulver edelsüß'::text,'Paprikapulver, edelsüß'::text), ('Pfeffer schwarz'::text,'Pfeffer, schwarz'::text), ('Roggen-Vollkornbrot'::text,'Roggenvollkornbrot'::text), ('Zarte Haferflocken'::text,'Haferflocken zart'::text), ('Teriyaki-Sauce'::text,'Teriyaki-soße'::text), ('Hokkaido-Kürbisbrot'::text,'Kürbisbrot'::text), ('Mini Pflaumentomaten'::text,'Mini-Pflaumentomaten, frisch'::text), ('Mozzarella Light'::text,'Mozzarella, fettreduziert, Milchart offen'::text), ('Quinoa'::text,'Quinoa, Farbe offen'::text), ('Joghurt griechischer Art Pur · 9,4 % Fett'::text,'Joghurt, griechischer Art, natur, 9,4 % Fett'::text), ('Rote-Bete-Wraps · EDEKA Herzstücke'::text,'Wraps, Rote Bete'::text), ('Sonnenmais Konserve'::text,'Mais Dose'::text), ('Spitzpaprika Kapia Sweet'::text,'Spitzpaprika, Kapia, frisch'::text), ('Wild-Heidelbeeren'::text,'Heidelbeeren, tiefgekühlt'::text), ('Eier'::text,'Hühnereier'::text), ('Eier Größe M'::text,'Hühnereier'::text), ('H-Milch 1,5 %'::text,'Milch, Kuhmilch, haltbar, 1,5 % Fett'::text), ('Oregano gerebelt'::text,'Oregano getrocknet'::text), ('Knoblauchzehen'::text,'Knoblauch, frisch'::text), ('Penne Rigate'::text,'Penne'::text), ('Trockenbackhefe'::text,'Trockenhefe'::text), ('Leinsamen geschrotet braun'::text,'Geschrotete Leinsamen'::text)
        ), family_aliases(source_name, target_family) AS (
         VALUES ('Wasser'::text,'Wasser'::text), ('Mandu TK'::text,'Gefüllte Teigwaren'::text), ('Hokkaido-Kürbis TK'::text,'Kürbis'::text), ('TK-Kirschen'::text,'Kirschen'::text), ('Wraps'::text,'Wraps und Tortillas'::text), ('Feta / Hirtenkäse'::text,'Käse'::text), ('Feta / Hirtenkäse leicht'::text,'Käse'::text), ('Schnittkäse'::text,'Käse'::text), ('Sojasauce'::text,'Soßen'::text), ('Tomatensalsa'::text,'Soßen'::text), ('Chio Dip Salsa'::text,'Soßen'::text), ('Kiwi'::text,'Kiwi'::text), ('Champignons'::text,'Champignons'::text), ('Kaki'::text,'Kaki'::text), ('Blattsalat'::text,'Blattsalat'::text), ('Blattsalat roh'::text,'Blattsalat'::text), ('Kokosmilch light'::text,'Kokosmilch'::text), ('Sesamkörner'::text,'Sesam'::text), ('Mandelmus'::text,'Mandeln'::text), ('Mageres Rindfleisch'::text,'Rind'::text), ('Pide-Fladenbrot'::text,'Fladenbrote'::text), ('Öl'::text,'Speiseöle'::text), ('Erdnussbutter crunchy'::text,'Erdnussaufstriche'::text), ('Leinsamen geschrotet braun'::text,'Leinsamen'::text), ('Putenbrustfilet'::text,'Pute'::text), ('Knoblauchzehen'::text,'Knoblauch'::text), ('Protein Coffee Classic Coffee'::text,'Protein-Kaffee'::text), ('ESN Isoclear Fresh Cherry'::text,'Proteinpulver'::text), ('ESN Isoclear Strawberry Lime'::text,'Proteinpulver'::text), ('Asia-Gemüse'::text,'Gemüsemischungen'::text), ('Knusperbrot Weizen'::text,'Knäcke- und Knusperbrot'::text), ('Kokosraspeln'::text,'Kokos'::text), ('Bio Basilikum'::text,'Basilikum'::text), ('Buschbohnen'::text,'Grüne Bohnen'::text), ('Barebells Vegan Protein Bar Caramel Peanut'::text,'Knabberzeug'::text), ('Zwiebelmett'::text,'Schwein'::text), ('Nussmischung'::text,'Nüsse und Saaten'::text)
        ), catalog AS (
         SELECT food_catalog_ingredients.user_id,
            food_catalog_ingredients.id AS catalog_ingredient_id,
            NULL::uuid AS product_variant_id,
            food_catalog_ingredients.name AS canonical_name,
            food_catalog_ingredients.family_name,
            food_catalog_ingredients.catalog_role,
            food_catalog_ingredients.source_details
           FROM food_catalog_ingredients
        UNION ALL
         SELECT food_catalog_product_variants.user_id,
            NULL::uuid AS uuid,
            food_catalog_product_variants.id,
            food_catalog_product_variants.variant_name,
            food_catalog_product_variants.family_name,
            'Produktvariante'::text AS text,
            '{}'::jsonb AS jsonb
           FROM food_catalog_product_variants
        ), catalog_lookup AS MATERIALIZED (
         SELECT c_1.user_id,
            c_1.catalog_ingredient_id,
            c_1.product_variant_id,
            c_1.canonical_name,
            c_1.family_name,
            c_1.catalog_role,
            lower(btrim(c_1.canonical_name)) AS lookup_key,
            true AS direct
           FROM catalog c_1
        UNION ALL
         SELECT c_1.user_id,
            c_1.catalog_ingredient_id,
            c_1.product_variant_id,
            c_1.canonical_name,
            c_1.family_name,
            c_1.catalog_role,
            lower(btrim(j.n)) AS lower,
            false
           FROM catalog c_1
             CROSS JOIN LATERAL jsonb_array_elements_text(
                CASE
                    WHEN jsonb_typeof(c_1.source_details -> 'original_names'::text) = 'array'::text THEN c_1.source_details -> 'original_names'::text
                    ELSE '[]'::jsonb
                END) j(n)
        ), all_matches AS MATERIALIZED (
         SELECT s_1.user_id,
            s_1.inventory_id,
            s_1.source_name,
            c_1.catalog_ingredient_id,
            c_1.product_variant_id,
            c_1.canonical_name,
            c_1.family_name,
            c_1.catalog_role,
            1 AS priority
           FROM source_keys s_1
             JOIN aliases a_1 ON lower(btrim(s_1.source_name)) = lower(btrim(a_1.source_name))
             JOIN catalog_lookup c_1 ON c_1.user_id = s_1.user_id AND c_1.direct AND c_1.lookup_key = lower(btrim(a_1.target_name))
        UNION ALL
         SELECT s_1.user_id,
            s_1.inventory_id,
            s_1.source_name,
            c_1.catalog_ingredient_id,
            c_1.product_variant_id,
            c_1.canonical_name,
            c_1.family_name,
            c_1.catalog_role,
                CASE
                    WHEN c_1.direct THEN 2
                    ELSE 3
                END AS "case"
           FROM source_keys s_1
             JOIN catalog_lookup c_1 ON c_1.user_id = s_1.user_id AND c_1.lookup_key = lower(btrim(s_1.source_name))
        UNION ALL
         SELECT s_1.user_id,
            s_1.inventory_id,
            s_1.source_name,
            c_1.catalog_ingredient_id,
            c_1.product_variant_id,
            c_1.canonical_name,
            c_1.family_name,
            c_1.catalog_role,
            4
           FROM source_keys s_1
             JOIN shopping_products p ON p.user_id = s_1.user_id AND p.inventory_id = s_1.inventory_id
             JOIN food_catalog_product_links l ON l.product_id = p.id AND l.user_id = s_1.user_id
             JOIN catalog c_1 ON c_1.user_id = s_1.user_id AND (c_1.catalog_ingredient_id = l.catalog_ingredient_id OR c_1.product_variant_id = l.product_variant_id)
        ), ranked AS (
         SELECT all_matches.user_id,
            all_matches.inventory_id,
            all_matches.source_name,
            all_matches.catalog_ingredient_id,
            all_matches.product_variant_id,
            all_matches.canonical_name,
            all_matches.family_name,
            all_matches.catalog_role,
            all_matches.priority,
            min(all_matches.priority) OVER (PARTITION BY all_matches.user_id, all_matches.inventory_id, all_matches.source_name) AS best_priority
           FROM all_matches
        ), best_by_source AS (
         SELECT ranked.user_id,
            ranked.inventory_id,
            ranked.source_name,
            min(ranked.canonical_name) AS canonical_name,
            min(ranked.family_name) AS family_name,
            min(ranked.catalog_role) AS catalog_role,
            (array_agg(DISTINCT ranked.catalog_ingredient_id) FILTER (WHERE ranked.catalog_ingredient_id IS NOT NULL))[1] AS catalog_ingredient_id,
            (array_agg(DISTINCT ranked.product_variant_id) FILTER (WHERE ranked.product_variant_id IS NOT NULL))[1] AS product_variant_id,
            count(DISTINCT ranked.canonical_name) AS candidate_count
           FROM ranked
          WHERE ranked.priority = ranked.best_priority
          GROUP BY ranked.user_id, ranked.inventory_id, ranked.source_name
        )
 SELECT s.user_id,
    s.inventory_id,
    s.source_name,
    s.position_count,
        CASE
            WHEN c.candidate_count = 1 THEN c.canonical_name
            ELSE s.source_name
        END AS canonical_name,
        CASE
            WHEN c.candidate_count = 1 THEN c.family_name
            ELSE COALESCE(fa.target_family, pl.family_name, NULLIF(i.family_name, ''::text), t.family_name,
            CASE
                WHEN s.source_name ~* 'paniertes Schweineschnitzel'::text THEN 'Schwein'::text
                WHEN s.source_name ~* 'Bratensoße'::text THEN 'Bratensoße'::text
                WHEN s.source_name ~* 'Gemüse: Erbsen, Karotten, Mais'::text THEN 'Gemüsemischungen'::text
                WHEN s.source_name ~* 'grüne Bohnen'::text THEN 'Grüne Bohnen'::text
                WHEN s.source_name ~* 'Kartoffelbrei'::text THEN 'Kartoffeln'::text
                WHEN s.source_name ~* 'Köttbullar'::text THEN 'Fleischbällchen'::text
                ELSE NULL::text
            END)
        END AS family_name,
        CASE
            WHEN c.candidate_count = 1 THEN c.catalog_ingredient_id
            ELSE NULL::uuid
        END AS catalog_ingredient_id,
        CASE
            WHEN c.candidate_count = 1 THEN c.product_variant_id
            ELSE NULL::uuid
        END AS product_variant_id,
        CASE
            WHEN c.candidate_count = 1 AND c.catalog_role = 'Zuordnung offen'::text THEN 'variant_open'::text
            WHEN c.candidate_count = 1 THEN 'matched'::text
            WHEN c.candidate_count > 1 THEN 'ambiguous'::text
            WHEN COALESCE(fa.target_family, pl.family_name, NULLIF(i.family_name, ''::text), t.family_name,
            CASE
                WHEN s.source_name ~* 'paniertes Schweineschnitzel'::text THEN 'Schwein'::text
                WHEN s.source_name ~* 'Bratensoße'::text THEN 'Bratensoße'::text
                WHEN s.source_name ~* 'Gemüse: Erbsen, Karotten, Mais'::text THEN 'Gemüsemischungen'::text
                WHEN s.source_name ~* 'grüne Bohnen'::text THEN 'Grüne Bohnen'::text
                WHEN s.source_name ~* 'Kartoffelbrei'::text THEN 'Kartoffeln'::text
                WHEN s.source_name ~* 'Köttbullar'::text THEN 'Fleischbällchen'::text
                ELSE NULL::text
            END) IS NOT NULL THEN 'family_only'::text
            ELSE 'unmapped'::text
        END AS resolution
   FROM source_keys s
     LEFT JOIN aliases a ON lower(btrim(s.source_name)) = lower(btrim(a.source_name))
     LEFT JOIN family_aliases fa ON lower(btrim(s.source_name)) = lower(btrim(fa.source_name))
     LEFT JOIN best_by_source c ON c.user_id = s.user_id AND NOT c.inventory_id IS DISTINCT FROM s.inventory_id AND NOT c.source_name IS DISTINCT FROM s.source_name
     LEFT JOIN food_inventory i ON i.id = s.inventory_id AND i.user_id = s.user_id
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN count(DISTINCT l.proposed_family_name) = 1 THEN min(l.proposed_family_name)
                    ELSE NULL::text
                END AS family_name
           FROM shopping_products p
             JOIN food_catalog_product_links l ON l.product_id = p.id AND l.user_id = s.user_id
          WHERE p.user_id = s.user_id AND p.inventory_id = s.inventory_id) pl ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN count(DISTINCT f.name) = 1 THEN min(f.name)
                    ELSE NULL::text
                END AS family_name
           FROM food_ingredient_family_terms ft
             JOIN food_ingredient_families f ON f.id = ft.family_id AND f.user_id = s.user_id
          WHERE ft.user_id = s.user_id AND lower(btrim(ft.term)) = lower(btrim(s.source_name))) t ON true;
