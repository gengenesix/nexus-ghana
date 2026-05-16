-- ============================================================
-- Migration 000020: Definitive staff login fix
--
-- Fixes ALL login-related DB function bugs in one shot.
-- Safe to re-run — all statements are DROP IF EXISTS + CREATE.
--
-- What this fixes:
--   1. resolve_staff_login had wrong parameter name "p_code"
--      Frontend sends "p_access_code" → PostgREST parameter mismatch → error
--   2. verify_staff_pin referenced s.permissions + s.user_type (don't exist)
--      and used _staff_id uuid but kiosk sends text → crash on every PIN login
--   3. Both functions now have consistent, correct signatures
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. resolve_staff_login(p_access_code, p_staff_id) → email|NULL
--    Called by anon during staff email+password login.
--    Returns the email for a given Access Code + Staff ID, or NULL.
-- ══════════════════════════════════════════════════════════════

-- Must DROP before re-creating when changing parameter names
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
  JOIN   public.businesses    b ON b.id = sm.business_id
  WHERE  UPPER(b.access_code)   = UPPER(TRIM(p_access_code))
    AND  sm.staff_id             = TRIM(p_staff_id)
    AND  sm.status               = 'active'
    AND  sm.supabase_user_id    IS NOT NULL
    AND  sm.email               IS NOT NULL
    AND  TRIM(sm.email)         != ''
  LIMIT 1;

  RETURN v_email;  -- NULL if not found — always same shape, prevents enumeration
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 2. verify_staff_pin(_business_id, _pin, _staff_id_text) → row
--    Called by kiosk PIN login.
--    Looks up staff by text staff_id (e.g. "kwame.asante"), not UUID.
--    Returns id, name, role, custom_role_id — no phantom columns.
-- ══════════════════════════════════════════════════════════════

-- Drop all old overloads before recreating
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, text);
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text);

CREATE FUNCTION public.verify_staff_pin(
  _business_id   uuid,
  _pin           text,
  _staff_id_text text DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text, custom_role_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _s record;
BEGIN

  -- ── Targeted: staff_id text provided ──────────────────────────────────
  IF _staff_id_text IS NOT NULL AND TRIM(_staff_id_text) != '' THEN

    SELECT s.id, s.name, s.role, s.custom_role_id,
           s.pin, s.failed_attempts, s.locked_until
      INTO _s
      FROM public.staff_members s
     WHERE s.staff_id    = TRIM(_staff_id_text)
       AND s.business_id = _business_id
       AND s.status      = 'active';

    IF NOT FOUND THEN RETURN; END IF;
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN RETURN; END IF;

    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL,
             last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.custom_role_id;
      RETURN;
    END IF;

    -- Wrong PIN
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE
             WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
             ELSE locked_until END
     WHERE id = _s.id;
    RETURN;
  END IF;

  -- ── Fallback: scan all staff in business (no staff_id provided) ───────
  FOR _s IN
    SELECT s.id, s.name, s.role, s.custom_role_id,
           s.pin, s.failed_attempts, s.locked_until
      FROM public.staff_members s
     WHERE s.business_id = _business_id AND s.status = 'active'
  LOOP
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN CONTINUE; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL,
             last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.custom_role_id;
      RETURN;
    END IF;
  END LOOP;

END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, text) TO anon;
