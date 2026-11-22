-- V1 only, 22 November 2026: weekly optional treat suggestions.
-- Deliberate shopping choice != purchase != food consumption != stock movement.
CREATE TABLE IF NOT EXISTS public.shopping_optional_treat_decisions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  idea_key text NOT NULL CHECK (idea_key IN ('chips','chocolate','ice','energy','salty')),
  status text NOT NULL CHECK (status IN ('added','dismissed')),
  shopping_item_id uuid NULL REFERENCES public.shopping_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,week_start,idea_key)
);
ALTER TABLE public.shopping_optional_treat_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shopping_optional_treat_decisions_owner ON public.shopping_optional_treat_decisions;
CREATE POLICY shopping_optional_treat_decisions_owner
  ON public.shopping_optional_treat_decisions FOR ALL TO authenticated
  USING (user_id=(SELECT auth.uid()))
  WITH CHECK (user_id=(SELECT auth.uid()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.shopping_optional_treat_decisions TO authenticated;

CREATE OR REPLACE FUNCTION public.add_optional_treat_to_shopping_v1(p_idea_key text, p_product_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_uid uuid:=auth.uid();
 v_week date:=date_trunc('week',(now() at time zone 'Europe/Berlin')::timestamp)::date;
 v_key text:=trim(coalesce(p_idea_key,''));
 v_product public.shopping_products%rowtype;
 v_label text;
 v_unit text:='Packung';
 v_category text:='Lebensmittel';
 v_item_id uuid;
 v_source text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich'; END IF;
 IF v_key NOT IN ('chips','chocolate','ice','energy','salty')
   THEN RAISE EXCEPTION 'Unbekannte Genussidee'; END IF;
 IF p_product_id IS NOT NULL THEN
   SELECT * INTO v_product FROM public.shopping_products WHERE id=p_product_id AND user_id=v_uid AND active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'V1 Produkt nicht gefunden'; END IF;
   v_label:=left(trim(concat_ws(' ',nullif(v_product.brand,''),v_product.product_name,nullif(v_product.variant,''))),180);
   IF v_label='' THEN RAISE EXCEPTION 'Produkt ohne erkennbare Bezeichnung'; END IF;
 ELSE
   v_label:=CASE v_key WHEN 'chips' THEN 'Kartoffelchips (Sorte bei Einkauf auswählen)'
      WHEN 'chocolate' THEN 'Schokolade (Sorte bei Einkauf auswählen)'
      WHEN 'ice' THEN 'Eis (Sorte bei Einkauf auswählen)'
      WHEN 'energy' THEN 'Energy-Drink (Sorte bei Einkauf auswählen)'
      WHEN 'salty' THEN 'Salziger Snack (Sorte bei Einkauf auswählen)' END;
 END IF;
 IF v_key='energy' THEN v_unit:='Dose'; v_category:='Getränke'; END IF;
 v_source:='optional-treat:'||v_week::text||':'||v_key;
 INSERT INTO public.shopping_items
  (user_id,label,quantity,unit,category,status,source,source_key,notes,product_id,purchase_data)
 VALUES (v_uid,v_label,1,v_unit,v_category,'now','manual',v_source,
   'OPTIONALER GENUSS-WUNSCH: Nicht verpflichtend. Noch kein Kauf, kein Verzehr, kein Vorratsabzug. Variante/Nährwerte beim tatsächlichen Kauf bestätigen.',
   p_product_id,'{}'::jsonb)
 ON CONFLICT (user_id,source,source_key) WHERE source_key IS NOT NULL DO NOTHING
 RETURNING id INTO v_item_id;
 IF v_item_id IS NULL THEN
   SELECT id INTO v_item_id FROM public.shopping_items
    WHERE user_id=v_uid AND source='manual' AND source_key=v_source LIMIT 1;
 END IF;
 IF v_item_id IS NULL THEN RAISE EXCEPTION 'Wunsch nicht eindeutig erstellt'; END IF;
 INSERT INTO public.shopping_optional_treat_decisions(user_id,week_start,idea_key,status,shopping_item_id)
 VALUES (v_uid,v_week,v_key,'added',v_item_id)
 ON CONFLICT (user_id,week_start,idea_key) DO UPDATE SET
 status='added',shopping_item_id=excluded.shopping_item_id,updated_at=now();
 RETURN jsonb_build_object('added',true,'shopping_item_id',v_item_id,'week_start',v_week,'idea_key',v_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.dismiss_optional_treat_shopping_v1(p_idea_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_uid uuid:=auth.uid();
 v_week date:=date_trunc('week',(now() at time zone 'Europe/Berlin')::timestamp)::date;
 v_key text:=trim(coalesce(p_idea_key,''));
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich'; END IF;
 IF v_key NOT IN ('chips','chocolate','ice','energy','salty')
   THEN RAISE EXCEPTION 'Unbekannte Genussidee'; END IF;
 INSERT INTO public.shopping_optional_treat_decisions(user_id,week_start,idea_key,status)
 VALUES(v_uid,v_week,v_key,'dismissed')
 ON CONFLICT (user_id,week_start,idea_key) DO UPDATE SET
  status=CASE WHEN shopping_optional_treat_decisions.status='added' THEN 'added' ELSE 'dismissed' END,
  updated_at=now();
 RETURN jsonb_build_object('dismissed',true,'week_start',v_week,'idea_key',v_key);
END;
$function$;
REVOKE ALL ON FUNCTION public.add_optional_treat_to_shopping_v1(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_optional_treat_shopping_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_optional_treat_to_shopping_v1(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_optional_treat_shopping_v1(text) TO authenticated;
