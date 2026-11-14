-- V910 · FOOD V1: meal completion may close only the user's *linked*
-- frozen ingredient portions. Fixes:
-- "permission denied for table food_freezer_portions"
-- observed on 2026-11-14 when completing breakfast and a meal-prep lunch.
--
-- The existing food_meals AFTER UPDATE(status) trigger
-- food_freezer_portion_complete_meal() runs as the authenticated user.
-- It needs to UPDATE (status,note,updated_at) on food_freezer_portions.
-- The owner-only RLS policy existed, but UPDATE table privileges did not.
--
-- Deliberately DO NOT grant broad UPDATE or INSERT/DELETE. A SECURITY DEFINER
-- privilege escalation is unnecessary. Protect the transition with an
-- additional restrictive (AND-ed) owner-and-completed-meal RLS policy.
-- Safe to reapply to existing V1 production which was hotfixed on 14 Nov.
BEGIN;
DO $prerequisite$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='food_freezer_portions'
     AND c.relrowsecurity=true
 ) THEN
   RAISE EXCEPTION 'food_freezer_portions RLS required before permissions';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='food_freezer_portions'
     AND policyname='food_freezer_portions_owner_all' AND cmd='ALL'
     AND 'authenticated'=ANY(roles)
 ) THEN
   RAISE EXCEPTION 'owner-only RLS policy missing or changed';
 END IF;
END $prerequisite$;

GRANT UPDATE (status,note,updated_at)
  ON TABLE public.food_freezer_portions TO authenticated;

DO $install$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public'
     AND tablename='food_freezer_portions'
     AND policyname='food_freezer_portions_completion_update_v910'
 ) THEN
  CREATE POLICY food_freezer_portions_completion_update_v910
  ON public.food_freezer_portions
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    user_id=(select auth.uid())
    AND status IN ('frozen','thawing','thawed')
    AND EXISTS (
      SELECT 1
      FROM public.food_meal_ingredients i
      JOIN public.food_meals m ON m.id=i.meal_id
      WHERE i.id=food_freezer_portions.meal_ingredient_id
        AND i.user_id=food_freezer_portions.user_id
        AND m.user_id=food_freezer_portions.user_id
        AND m.status='completed'
    )
  )
  WITH CHECK (
    user_id=(select auth.uid())
    AND status='consumed'
    AND EXISTS (
      SELECT 1
      FROM public.food_meal_ingredients i
      JOIN public.food_meals m ON m.id=i.meal_id
      WHERE i.id=food_freezer_portions.meal_ingredient_id
        AND i.user_id=food_freezer_portions.user_id
        AND m.user_id=food_freezer_portions.user_id
        AND m.status='completed'
    )
  );
 END IF;
END $install$;
COMMIT;

-- Verified against real V1 database on 2026-11-14:
-- 1. Two actual meals completed under SET LOCAL ROLE authenticated in
--    BEGIN/ROLLBACK, with inventory_booked_at unchanged after rollback.
-- 2. A "thawing" portion attached to a COMPLETED meal may be updated
--    to consumed under authenticated role, then ROLLBACK retains its status.
-- 3. A frozen portion attached to a PLANNED meal cannot be updated:
--    zero affected rows even though it belongs to the same auth.uid().
-- 4. authenticated has UPDATE only on status,note,updated_at, NOT on
--    quantity, user_id, source_lot_id or meal_ingredient_id.
