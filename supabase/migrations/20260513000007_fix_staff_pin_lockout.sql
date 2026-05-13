-- ============================================================
-- MIGRATION: Fix verify_staff_pin mass-lockout vulnerability
--
-- Problem: on any failed PIN, ALL staff at the business had
-- their failed_attempts incremented, allowing anyone to lock
-- out every employee with 5 wrong guesses.
--
-- Fix: accept an optional _staff_id so lockout only applies
-- to the specific staff member being authenticated.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  _business_id uuid,
  _pin         text,
  _staff_id    uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff record;
BEGIN

  -- ── Targeted path: staff_id known ──────────────────────────
  IF _staff_id IS NOT NULL THEN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
    INTO _staff
    FROM public.staff_members s
    WHERE s.id          = _staff_id
      AND s.business_id = _business_id
      AND s.status      = 'active';

    -- Not found or not active → silent reject
    IF NOT FOUND THEN
      RETURN;
    END IF;

    -- Account locked → silent reject
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN
      RETURN;
    END IF;

    -- PIN match
    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0,
             locked_until    = NULL
       WHERE public.staff_members.id = _staff.id;

      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;

    -- PIN mismatch — only increment THIS staff member
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until    = CASE
             WHEN failed_attempts + 1 >= 5
             THEN now() + interval '15 minutes'
             ELSE locked_until
           END
     WHERE public.staff_members.id = _staff.id;

    RETURN; -- empty result = wrong PIN
  END IF;

  -- ── Legacy / fallback path: no staff_id ─────────────────────
  -- Loop all active staff, find PIN match.
  -- On failure: do NOT increment anyone (no mass-lockout risk).
  FOR _staff IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
    FROM public.staff_members s
    WHERE s.business_id = _business_id
      AND s.status      = 'active'
  LOOP
    -- Skip locked accounts
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN
      CONTINUE;
    END IF;

    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0,
             locked_until    = NULL
       WHERE public.staff_members.id = _staff.id;

      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;
  END LOOP;

  RETURN; -- no match
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, uuid) TO authenticated;
