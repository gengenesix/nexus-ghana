-- Fix RLS on staff_members INSERT
-- The old policy used get_business_id() which can return NULL
-- during onboarding because the business was just created.
-- This version uses a direct EXISTS check instead.

DROP POLICY IF EXISTS "sm_insert" ON public.staff_members;

CREATE POLICY "sm_insert" ON public.staff_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
       WHERE id = business_id
         AND owner_id = auth.uid()
    )
  );
