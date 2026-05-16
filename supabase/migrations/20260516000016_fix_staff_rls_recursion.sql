-- ============================================================
-- Migration 000016: Fix staff_members_select RLS recursion
--
-- Root cause:
--   Migration 000015 created a staff_members SELECT policy that
--   contained a direct self-referential subquery:
--
--     EXISTS (SELECT 1 FROM public.staff_members sm WHERE ...)
--
--   PostgreSQL evaluates RLS policies for EVERY table access,
--   including sub-selects within the policy body. A subquery on
--   the same table as the policy creates infinite recursion, which
--   PostgreSQL surfaces as an error → useBusiness throws → BusinessGuard
--   shows "There was a problem connecting to the server."
--
-- Fix:
--   1. Create get_my_staff_role(_business_id) as SECURITY DEFINER.
--      SECURITY DEFINER bypasses RLS when it reads staff_members,
--      so no recursion occurs.
--   2. Replace the broken policy with one that calls the function
--      instead of subquerying the same table.
-- ============================================================


-- ── 1. Helper function — no-recursion role lookup ─────────────────────────
--
-- Returns the authenticated user's role in a given business.
-- SECURITY DEFINER → runs as the function owner, bypasses RLS → no recursion.

CREATE OR REPLACE FUNCTION public.get_my_staff_role(_business_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   public.staff_members
  WHERE  supabase_user_id = auth.uid()
    AND  status            = 'active'
    AND  business_id       = _business_id
  LIMIT 1;
$$;


-- ── 2. Replace the recursive SELECT policy ────────────────────────────────

DROP POLICY IF EXISTS "staff_members_select" ON public.staff_members;

CREATE POLICY "staff_members_select" ON public.staff_members
  FOR SELECT
  USING (
    business_id = get_business_id()
    AND (
      -- Business owner sees all staff in their business
      EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id       = staff_members.business_id
          AND owner_id = auth.uid()
      )
      OR
      -- Admin / Manager / Supervisor see all staff
      -- Uses SECURITY DEFINER function — no self-referential recursion
      get_my_staff_role(staff_members.business_id) IN (
        'Administrator', 'Manager', 'Supervisor', 'System Administrator'
      )
      OR
      -- All other authenticated staff see only their own row
      supabase_user_id = auth.uid()
    )
  );
