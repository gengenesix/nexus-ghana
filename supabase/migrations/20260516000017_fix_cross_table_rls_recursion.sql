-- ============================================================
-- Migration 000017: Fix cross-table RLS recursion (complete fix)
--
-- Root cause — two-table death loop:
--
--   Query on `businesses`:
--     → evaluates ALL businesses SELECT policies (PostgreSQL doesn't
--       short-circuit OR — it evaluates every permissive policy)
--     → "Staff can view their business" subqueries staff_members
--     → evaluates staff_members_select policy
--     → staff_members_select subqueries businesses (the EXISTS check)
--     → evaluates businesses SELECT policies again
--     → INFINITE RECURSION → error for EVERY user on every page load
--
-- This is why even business owners see the error: the very first
-- businesses query in useBusiness triggers the chain.
--
-- Fix: ALL cross-table references inside RLS policies must go through
-- SECURITY DEFINER functions. SECURITY DEFINER runs as the function
-- owner and bypasses RLS entirely, breaking the recursion chain.
--
-- Functions created / replaced:
--   get_my_staff_role(_business_id)  — already created in 000016; idempotent here
--   is_owner_of_business(_business_id) — NEW
--   is_staff_of_business(_business_id) — NEW
-- ============================================================


-- ── 1. get_my_staff_role (idempotent re-create from 000016) ───────────────
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


-- ── 2. is_owner_of_business — checks businesses without triggering its RLS ─
CREATE OR REPLACE FUNCTION public.is_owner_of_business(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id       = _business_id
      AND owner_id = auth.uid()
  );
$$;


-- ── 3. is_staff_of_business — checks staff_members without triggering its RLS
CREATE OR REPLACE FUNCTION public.is_staff_of_business(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE supabase_user_id = auth.uid()
      AND status            = 'active'
      AND business_id       = _business_id
  );
$$;


-- ── 4. Fix businesses "Staff can view their business" policy ──────────────
--
-- Old (broken): id IN (SELECT business_id FROM staff_members WHERE ...)
--   → direct subquery on staff_members triggers staff_members RLS
--   → staff_members RLS queries businesses → INFINITE CROSS-TABLE RECURSION
--
-- New: is_staff_of_business(id) — SECURITY DEFINER, bypasses RLS

DROP POLICY IF EXISTS "Staff can view their business" ON public.businesses;

CREATE POLICY "Staff can view their business" ON public.businesses
  FOR SELECT
  USING (is_staff_of_business(id));


-- ── 5. Fix staff_members_select policy ────────────────────────────────────
--
-- Old (broken, from 000015/000016):
--   EXISTS (SELECT 1 FROM public.businesses WHERE id = ... AND owner_id = auth.uid())
--   → direct subquery on businesses triggers businesses RLS
--   → businesses RLS queries staff_members → INFINITE CROSS-TABLE RECURSION
--
-- New: is_owner_of_business(staff_members.business_id) — SECURITY DEFINER

DROP POLICY IF EXISTS "staff_members_select" ON public.staff_members;

CREATE POLICY "staff_members_select" ON public.staff_members
  FOR SELECT
  USING (
    business_id = get_business_id()
    AND (
      -- Owner path: SECURITY DEFINER — no businesses RLS triggered
      is_owner_of_business(staff_members.business_id)
      OR
      -- Admin/Manager/Supervisor path: SECURITY DEFINER — no staff_members RLS triggered
      get_my_staff_role(staff_members.business_id) IN (
        'Administrator', 'Manager', 'Supervisor', 'System Administrator'
      )
      OR
      -- Self path: no table query, no recursion
      supabase_user_id = auth.uid()
    )
  );
