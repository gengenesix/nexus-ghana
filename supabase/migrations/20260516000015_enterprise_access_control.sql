-- ============================================================
-- Migration 000015: Enterprise Access Control
--   1. No peer enumeration — staff can only SELECT their own row
--   2. resolve_staff_login() RPC — safely resolves email for
--      the Access Code + Staff ID login flow (callable by anon)
--   3. require_fresh_auth_for_role_change() trigger — role changes
--      are rejected unless the caller's JWT was issued < 10 minutes ago
--      (forces re-authentication before every role change)
--   4. audit_role_change() trigger — every role change is appended
--      to audit_logs with old/new values and the actor's uid
-- ============================================================


-- ── 1. Fix staff_members SELECT — no peer visibility ──────────────────────
--
-- Before: any authenticated member of a business could SELECT all staff rows.
-- After:
--   • Business owner → sees all staff
--   • Administrator / Manager / Supervisor staff → sees all staff
--   • All other staff → can only see their own row

DROP POLICY IF EXISTS "Business members can view staff" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members_select"            ON public.staff_members;

CREATE POLICY "staff_members_select" ON public.staff_members
  FOR SELECT
  USING (
    business_id = get_business_id()
    AND (
      -- Business owner can see everyone
      EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = staff_members.business_id
          AND owner_id = auth.uid()
      )
      OR
      -- Admin / Manager / Supervisor staff can see everyone in same business
      EXISTS (
        SELECT 1 FROM public.staff_members sm
        WHERE sm.supabase_user_id = auth.uid()
          AND sm.status = 'active'
          AND sm.role IN ('Administrator', 'Manager', 'Supervisor', 'System Administrator')
          AND sm.business_id = staff_members.business_id
      )
      OR
      -- All other staff can only read their own record
      supabase_user_id = auth.uid()
    )
  );


-- ── 2. resolve_staff_login() — safe email resolution for staff login ───────
--
-- Called by an unauthenticated client (anon) during the staff login flow.
-- Returns the email address for a given (access_code, staff_id) pair, or
-- NULL if either value is wrong — this prevents enumeration attacks by
-- always returning the same type of result regardless of failure reason.
--
-- The actual password verification is done afterwards by the client via
-- supabase.auth.signInWithPassword() — this function only resolves the email.

CREATE OR REPLACE FUNCTION public.resolve_staff_login(
  p_access_code text,
  p_staff_id    text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT sm.email INTO v_email
  FROM   public.staff_members sm
  JOIN   public.businesses    b  ON b.id = sm.business_id
  WHERE  UPPER(b.access_code)   = UPPER(TRIM(p_access_code))
    AND  sm.staff_id             = TRIM(p_staff_id)
    AND  sm.status               = 'active'
    AND  sm.supabase_user_id    IS NOT NULL   -- must have a real auth account
    AND  sm.email               IS NOT NULL
  LIMIT 1;

  RETURN v_email;  -- NULL when nothing matches
END;
$$;

-- Callable by unauthenticated visitors (login page)
GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO authenticated;


-- ── 3. Trigger: require fresh JWT for role changes ─────────────────────────
--
-- Role changes are a privileged operation. This trigger rejects any UPDATE
-- that modifies the `role` column unless the caller's JWT was issued within
-- the last 10 minutes — i.e., they recently called signInWithPassword.
--
-- Flow enforced:
--   UI opens ReAuthModal → user enters password
--   → supabase.auth.signInWithPassword() → fresh JWT (iat = now)
--   → dispatch role UPDATE → trigger checks (now - iat) < 600s → passes
--
-- The self-role-escalation trigger (migration 000014) also fires; both must pass.

CREATE OR REPLACE FUNCTION public.require_fresh_auth_for_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_iat             bigint;
  v_seconds_elapsed float;
BEGIN
  -- Only enforce when role is actually changing
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- Read JWT issued-at claim
  BEGIN
    v_iat := (auth.jwt() ->> 'iat')::bigint;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Authentication required to change roles';
  END;

  v_seconds_elapsed := EXTRACT(EPOCH FROM now()) - v_iat;

  IF v_seconds_elapsed > 600 THEN
    RAISE EXCEPTION
      'Role changes require recent authentication (session is % minutes old). '
      'Please re-enter your password and try again.',
      ROUND(v_seconds_elapsed / 60);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_fresh_auth_role_change ON public.staff_members;
CREATE TRIGGER trg_require_fresh_auth_role_change
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.require_fresh_auth_for_role_change();


-- ── 4. Trigger: audit every role change ───────────────────────────────────
--
-- Every time a staff member's role changes, an entry is appended to
-- audit_logs. Cannot be deleted (migration 000014 revoked DELETE on audit_logs).

CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_logs (
    business_id,
    action,
    module,
    record_id,
    old_value,
    new_value,
    performed_by
  ) VALUES (
    NEW.business_id,
    'role_change',
    'staff',
    NEW.id::text,
    json_build_object('role', OLD.role)::text,
    json_build_object('role', NEW.role, 'changed_by_uid', auth.uid())::text,
    auth.uid()::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.staff_members;
CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_change();


-- ── 5. Set app_metadata.role on staff creation ────────────────────────────
-- (Done in the create-staff-account Edge Function via admin API;
--  no pure-SQL equivalent without the service role key.)
-- This comment is a placeholder to document where that happens.
