-- ============================================================
-- Migration 000019: Fix staff login RPCs
--
-- Bugs fixed:
--
--  A) verify_staff_pin
--     - Referenced s.permissions and s.user_type — columns that don't
--       exist on staff_members → function crashed on every PIN attempt
--     - Parameter _staff_id was type uuid but the kiosk now sends a
--       text Staff ID (e.g. "kwame.mensah") → type-cast error
--     - Did not return custom_role_id — always null for kiosk staff
--     Fix: rename parameter to _staff_id_text text, look up by
--     staff_members.staff_id text column, add custom_role_id to return.
--
--  B) resolve_staff_login
--     - staff_members.email defaults to '' (empty string).
--       "email IS NOT NULL" passes for '', returning '' as the email.
--       signInWithPassword({ email: '', password }) always fails.
--     Fix: also require TRIM(sm.email) != ''.
-- ============================================================


-- ── A. Fix verify_staff_pin ──────────────────────────────────────────────

-- Drop all overloads (uuid and text variants) before recreating
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, text);
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text);

CREATE FUNCTION public.verify_staff_pin(
  _business_id   uuid,
  _pin           text,
  _staff_id_text text DEFAULT NULL   -- the text staff_id (e.g. "kwame.mensah"), nullable
)
RETURNS TABLE(id uuid, name text, role text, custom_role_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _s record;
BEGIN

  -- ── Targeted lookup: staff_id text provided ─────────────────────────────
  IF _staff_id_text IS NOT NULL AND TRIM(_staff_id_text) != '' THEN

    SELECT s.id, s.name, s.role, s.custom_role_id,
           s.pin, s.failed_attempts, s.locked_until
      INTO _s
      FROM public.staff_members s
     WHERE s.staff_id    = TRIM(_staff_id_text)
       AND s.business_id = _business_id
       AND s.status      = 'active';

    IF NOT FOUND THEN RETURN; END IF;

    -- Check lockout
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN RETURN; END IF;

    -- Verify PIN (bcrypt)
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0,
             locked_until    = NULL,
             last_login      = now(),
             is_online       = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.custom_role_id;
      RETURN;
    END IF;

    -- Wrong PIN — increment counter, lock if >= 5
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until    = CASE
             WHEN failed_attempts + 1 >= 5
             THEN now() + interval '15 minutes'
             ELSE locked_until
           END
     WHERE id = _s.id;
    RETURN;
  END IF;

  -- ── Fallback: no staff_id → scan business (backward compat) ─────────────
  FOR _s IN
    SELECT s.id, s.name, s.role, s.custom_role_id,
           s.pin, s.failed_attempts, s.locked_until
      FROM public.staff_members s
     WHERE s.business_id = _business_id
       AND s.status      = 'active'
  LOOP
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN CONTINUE; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0,
             locked_until    = NULL,
             last_login      = now(),
             is_online       = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.custom_role_id;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, text) TO anon;


-- ── B. Fix resolve_staff_login — reject empty-string email ──────────────────

-- DROP first — PostgreSQL won't allow renaming parameters with CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.resolve_staff_login(text, text);

CREATE FUNCTION public.resolve_staff_login(
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
  WHERE  UPPER(b.access_code)       = UPPER(TRIM(p_access_code))
    AND  sm.staff_id                 = TRIM(p_staff_id)
    AND  sm.status                   = 'active'
    AND  sm.supabase_user_id        IS NOT NULL
    AND  sm.email                   IS NOT NULL
    AND  TRIM(sm.email)             != ''          -- reject empty-string default
  LIMIT 1;

  RETURN v_email;   -- NULL when nothing matches — always the same response shape
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO authenticated;
