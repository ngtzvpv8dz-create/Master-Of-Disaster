-- V804 · Separater TK-Lebenszyklus fuer fertig zubereitete Meal-Prep-Reste.
-- Die Portionen sind bewusst keine food_inventory_lots fuer rohe Zutaten.
CREATE TABLE IF NOT EXISTS public.food_mealprep_freezer_portions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 leftover_id uuid NOT NULL REFERENCES public.food_leftovers(id) ON DELETE CASCADE,
 meal_id uuid UNIQUE REFERENCES public.food_meals(id) ON DELETE SET NULL,
 servings numeric NOT NULL CHECK(servings>0),
 status text NOT NULL DEFAULT 'frozen'
   CHECK(status IN ('frozen','thawing','thawed','consumed','cancelled')),
 frozen_on date,
 needed_on date,
 thaw_started_at timestamptz,
 thawed_at timestamptz,
 consumed_at timestamptz,
 note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_mealprep_freezer_owner_status ON public.food_mealprep_freezer_portions(user_id,status,needed_on);
CREATE INDEX IF NOT EXISTS idx_food_mealprep_freezer_leftover ON public.food_mealprep_freezer_portions(leftover_id);
ALTER TABLE public.food_mealprep_freezer_portions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_food_mealprep_freezer_portions" ON public.food_mealprep_freezer_portions;
CREATE POLICY "owner_food_mealprep_freezer_portions"
 ON public.food_mealprep_freezer_portions FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.food_mealprep_freezer_portions TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_food_mealprep_freezer(p_portion_id uuid, p_action text)
 RETURNS food_mealprep_freezer_portions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.food_mealprep_freezer_portions%rowtype;
BEGIN
 SELECT * INTO v_row FROM public.food_mealprep_freezer_portions
 WHERE id=p_portion_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TK-Meal-Prep-Portion nicht gefunden'; END IF;
 IF p_action='start_thaw' AND v_row.status='frozen' THEN
   UPDATE public.food_mealprep_freezer_portions SET status='thawing',thaw_started_at=now(),updated_at=now()
   WHERE id=p_portion_id RETURNING * INTO v_row;
 ELSIF p_action='finish_thaw' AND v_row.status='thawing' THEN
   UPDATE public.food_mealprep_freezer_portions SET status='thawed',thawed_at=now(),updated_at=now()
   WHERE id=p_portion_id RETURNING * INTO v_row;
 ELSE RAISE EXCEPTION 'Ungueltiger Statuswechsel'; END IF;
 RETURN v_row;
END; $function$
;

CREATE OR REPLACE FUNCTION public.register_food_mealprep_frozen(p_leftover_id uuid, p_servings numeric DEFAULT 1, p_meal_id uuid DEFAULT NULL::uuid, p_needed_on date DEFAULT NULL::date)
 RETURNS food_mealprep_freezer_portions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_user uuid:=auth.uid(); v_leftover public.food_leftovers%rowtype;
v_meal public.food_meals%rowtype; v_capacity numeric; v_tracked numeric;
v_row public.food_mealprep_freezer_portions%rowtype;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;
 IF p_servings IS NULL OR p_servings<=0 THEN RAISE EXCEPTION 'Ungueltige Portionsmenge'; END IF;
 SELECT * INTO v_leftover FROM public.food_leftovers WHERE id=p_leftover_id AND user_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restportion nicht gefunden'; END IF;
 IF p_meal_id IS NOT NULL THEN
   SELECT * INTO v_meal FROM public.food_meals WHERE id=p_meal_id AND user_id=v_user AND leftover_id=p_leftover_id AND status='planned';
   IF NOT FOUND THEN RAISE EXCEPTION 'Geplante Mahlzeit passt nicht zu dieser Restportion'; END IF;
   IF p_servings>v_meal.eaten_servings THEN RAISE EXCEPTION 'Mehr Portionen als fuer die Mahlzeit vorgesehen'; END IF;
 END IF;
 SELECT COALESCE(SUM(servings),0) INTO v_tracked
 FROM public.food_mealprep_freezer_portions
 WHERE leftover_id=p_leftover_id AND status NOT IN ('consumed','cancelled');
 SELECT greatest(v_leftover.available_servings,COALESCE(SUM(eaten_servings),0))
 INTO v_capacity
 FROM public.food_meals
 WHERE leftover_id=p_leftover_id AND status='planned';
 IF v_tracked+p_servings>v_capacity THEN RAISE EXCEPTION 'Bereits alle Restportionen als TK-Portionen erfasst'; END IF;
 INSERT INTO public.food_mealprep_freezer_portions
 (user_id,leftover_id,meal_id,servings,status,frozen_on,needed_on,note)
 VALUES (v_user,p_leftover_id,p_meal_id,p_servings,'frozen',current_date,p_needed_on,
 'Vom Nutzer in der TK-Ansicht als tatsaechlich eingefroren bestaetigt.')
 RETURNING * INTO v_row;
 RETURN v_row;
END; $function$
;

CREATE OR REPLACE FUNCTION public.sync_food_mealprep_freezer_meal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_portion_id uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.leftover_id IS NOT NULL AND NEW.status='planned' THEN
   SELECT id INTO v_portion_id FROM public.food_mealprep_freezer_portions
   WHERE leftover_id=NEW.leftover_id AND user_id=NEW.user_id
   AND meal_id IS NULL AND status IN ('frozen','thawing','thawed')
   ORDER BY created_at,id LIMIT 1 FOR UPDATE;
   IF v_portion_id IS NOT NULL THEN
     UPDATE public.food_mealprep_freezer_portions
     SET meal_id=NEW.id,needed_on=CASE WHEN status='frozen' THEN NEW.meal_date-1 ELSE needed_on END,
     updated_at=now() WHERE id=v_portion_id;
   END IF;
  END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
   UPDATE public.food_mealprep_freezer_portions SET
     status='consumed',consumed_at=now(),updated_at=now()
   WHERE meal_id=NEW.id AND user_id=NEW.user_id
   AND status IN ('frozen','thawing','thawed');
  END IF;
 END IF;
 RETURN NEW;
END; $function$
;

REVOKE ALL ON FUNCTION public.register_food_mealprep_frozen(uuid,numeric,uuid,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_food_mealprep_freezer(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_food_mealprep_frozen(uuid,numeric,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_food_mealprep_freezer(uuid,text) TO authenticated;
DROP TRIGGER IF EXISTS sync_food_mealprep_freezer_meal ON public.food_meals;
CREATE TRIGGER sync_food_mealprep_freezer_meal
 AFTER INSERT OR UPDATE OF status ON public.food_meals
 FOR EACH ROW EXECUTE FUNCTION public.sync_food_mealprep_freezer_meal();
