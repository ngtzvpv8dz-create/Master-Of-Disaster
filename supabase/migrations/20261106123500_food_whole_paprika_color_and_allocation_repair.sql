-- 2026-11-06: Mixed fresh peppers, colors green/yellow/red share piece-consumption validation.
-- Explicit selection of two separate whole peppers in one meal is consumed in two movements;
-- skip an earlier piece ONLY if already consumed by the SAME meal, preserving safety against old-used pieces.
-- Verified in a transaction that was fully rolled back: Monday 2 reds and Tuesday 1 yellow.
CREATE OR REPLACE FUNCTION public.food_sync_whole_paprika_piece_consume()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_stock_unit text;
  v_piece public.food_inventory_pieces%rowtype;
  v_requested numeric;
  v_remaining integer;
  v_explicit_count integer:=0;
  v_need_g numeric;
BEGIN
  IF NEW.kind<>'consume' OR NEW.delta>=0 OR NEW.inventory_id IS NULL THEN RETURN NEW; END IF;
  SELECT f.unit INTO v_stock_unit
  FROM public.food_inventory f
  WHERE f.id=NEW.inventory_id AND f.user_id=NEW.user_id
    AND lower(btrim(f.name)) IN ('blockpaprika rot','blockpaprika gelb','blockpaprika grün');
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_requested:=abs(NEW.delta);

  -- Fresh whole red peppers are inventoried in PIECES, not in grams.
  -- Preserve precisely selected physical piece IDs from meal allocations.
  IF lower(coalesce(v_stock_unit,''))='stück' THEN
    IF v_requested<>trunc(v_requested) OR v_requested<1 THEN
      RAISE EXCEPTION 'Blockpaprika muss als ganze Stückzahl gebucht werden, erhalten: %',NEW.delta
      USING ERRCODE='23514';
    END IF;
    v_remaining:=v_requested::integer;
    IF NEW.meal_id IS NOT NULL THEN
      FOR v_piece IN
        SELECT piece.*
        FROM public.food_meal_ingredients ing
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(ing.allocation_override)='array'
            THEN ing.allocation_override ELSE '[]'::jsonb END
        ) AS alloc(item)
        JOIN public.food_inventory_pieces piece
          ON piece.id=NULLIF(alloc.item->>'piece_id','')::uuid
        WHERE ing.meal_id=NEW.meal_id
          AND ing.user_id=NEW.user_id
          AND alloc.item->>'inventory_id'=NEW.inventory_id::text
          AND piece.inventory_id=NEW.inventory_id
          AND piece.user_id=NEW.user_id
        ORDER BY ing.sort_order,piece.piece_index
        FOR UPDATE OF piece
      LOOP
        EXIT WHEN v_remaining=0;
        v_explicit_count:=v_explicit_count+1;
        IF v_piece.status<>'whole' THEN
          IF v_piece.status='consumed' AND NEW.meal_id IS NOT NULL
            AND position('[meal:'||NEW.meal_id::text||']' in coalesce(v_piece.note,''))>0 THEN
            CONTINUE;
          END IF;
          RAISE EXCEPTION 'Gewählte Blockpaprika Nr. % ist nicht mehr vollständig verfügbar',
            v_piece.piece_index USING ERRCODE='23514';
        END IF;
        UPDATE public.food_inventory_pieces
        SET status='consumed',remaining_weight_g=0,consumed_at=now(),updated_at=now(),
            note=concat_ws(E'\n',note,'Beim bestätigten Mahlzeitenabschluss als ganze Blockpaprika Nr. '||
            v_piece.piece_index||' ('||v_piece.weight_g||' g brutto) verbucht. [meal:'||NEW.meal_id::text||']')
        WHERE id=v_piece.id AND status='whole';
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Blockpaprika Nr. % konnte nicht als verbraucht gebucht werden',v_piece.piece_index
          USING ERRCODE='23514';
        END IF;
        v_remaining:=v_remaining-1;
      END LOOP;
    END IF;
    IF v_explicit_count>0 AND v_remaining>0 THEN
      RAISE EXCEPTION 'Nicht genug ausdrücklich ausgewählte ganze Blockpaprika für diese Mahlzeit'
      USING ERRCODE='23514';
    END IF;

    -- For legacy meals without a selected piece, use complete measured pieces
    -- in deterministic lot/piece order; NEVER split a pepper by grams.
    IF v_explicit_count=0 AND v_remaining>0 THEN
      FOR v_piece IN
        SELECT piece.*
        FROM public.food_inventory_pieces piece
        LEFT JOIN public.food_inventory_lots lot ON lot.id=piece.lot_id
        WHERE piece.inventory_id=NEW.inventory_id
          AND piece.user_id=NEW.user_id AND piece.status='whole'
        ORDER BY lot.purchased_on NULLS LAST,piece.piece_index,piece.id
        FOR UPDATE OF piece
      LOOP
        EXIT WHEN v_remaining=0;
        UPDATE public.food_inventory_pieces
        SET status='consumed',remaining_weight_g=0,consumed_at=now(),updated_at=now(),
            note=concat_ws(E'\n',note,'Ganze Blockpaprika als Stück verbraucht (ohne explizite Stückauswahl).')
        WHERE id=v_piece.id AND status='whole';
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Blockpaprika-Stückbuchung wurde während der Transaktion verändert'
          USING ERRCODE='23514';
        END IF;
        v_remaining:=v_remaining-1;
      END LOOP;
    END IF;
    IF v_remaining<>0 THEN
      RAISE EXCEPTION 'Nicht genug ganze, einzeln erfasste Blockpaprika vorhanden (% Stück fehlen)',
        v_remaining USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Preserve the original gram-based behavior for historical gram inventories.
  IF NOT EXISTS (
    SELECT 1 FROM public.food_inventory_pieces piece
    WHERE piece.inventory_id=NEW.inventory_id AND piece.user_id=NEW.user_id AND piece.status='whole'
  ) THEN RETURN NEW; END IF;
  v_need_g:=v_requested;
  FOR v_piece IN
    SELECT * FROM public.food_inventory_pieces piece
    WHERE piece.inventory_id=NEW.inventory_id AND piece.user_id=NEW.user_id
      AND piece.status='whole'
    ORDER BY piece.weight_g DESC,piece.piece_index
    FOR UPDATE
  LOOP
    IF v_need_g>=v_piece.weight_g THEN
      UPDATE public.food_inventory_pieces
      SET status='consumed',remaining_weight_g=0,consumed_at=now(),updated_at=now()
      WHERE id=v_piece.id;
      v_need_g:=v_need_g-v_piece.weight_g;
    END IF;
    EXIT WHEN v_need_g=0;
  END LOOP;
  IF v_need_g<>0 THEN
    RAISE EXCEPTION
      'Paprika im Frischvorrat sind einzeln gewogen: bitte ganze Paprika passend zu % g auswählen; keine Teilstücke automatisch abbuchen.',
      v_requested USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$function$

