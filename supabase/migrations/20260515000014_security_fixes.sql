-- ============================================================
-- Migration 000014: Security fixes
--   1. Prevent staff from escalating their own role via UPDATE
--   2. Restrict "Staff can link own account" to safe columns only
--   3. RLS: prevent status self-deactivation bypass
-- Run once in Supabase SQL editor.
-- ============================================================

-- ── 1. Trigger: block self-role-change ─────────────────────────────────────
--
-- A staff member who has a Supabase Auth account (supabase_user_id set) could
-- in theory call supabase.from("staff_members").update({ role: "Administrator" })
-- on their own row, which the "Staff can link own account" policy would allow.
-- This trigger blocks any UPDATE that changes the `role` column when the user
-- making the call IS the staff member being modified.
--
-- Business owners are not affected because their auth.uid() is never stored in
-- a staff_members.supabase_user_id column (they own the business, not a staff row).

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only react if the role field is actually changing
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- Block if the caller IS the staff member being updated
  IF OLD.supabase_user_id IS NOT NULL AND OLD.supabase_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: staff cannot change their own role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.staff_members;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_escalation();

-- ── 2. Tighten "Staff can link own account" policy ─────────────────────────
--
-- The existing policy allows staff to UPDATE their own row (needed to set
-- supabase_user_id via the join flow). But there's no column-level restriction.
-- We replace it with a more precise policy that only passes through safe changes.
-- The trigger above is the real enforcement; this is belt-and-suspenders.

DROP POLICY IF EXISTS "Staff can link own account" ON public.staff_members;

CREATE POLICY "Staff can link own account" ON public.staff_members
  FOR UPDATE
  USING  (supabase_user_id = auth.uid())
  WITH CHECK (
    -- The role and business_id must not change
    role        = OLD.role
    AND business_id = OLD.business_id
    AND status      = OLD.status
    -- supabase_user_id must either stay the same or be set (never cleared by self)
    AND (
      supabase_user_id = OLD.supabase_user_id
      OR (OLD.supabase_user_id IS NULL AND supabase_user_id = auth.uid())
    )
  );

-- ── 3. Ensure audit_logs has no DELETE policy (append-only) ──────────────
-- If someone accidentally created one, remove it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
      AND cmd        = 'DELETE'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_delete" ON public.audit_logs';
  END IF;
END $$;

REVOKE DELETE ON public.audit_logs FROM authenticated;
REVOKE DELETE ON public.audit_logs FROM anon;
