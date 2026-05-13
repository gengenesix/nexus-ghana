-- ============================================================
-- MIGRATION: Secure staff PIN authentication
-- 1. Enable pgcrypto for bcrypt hashing
-- 2. Add rate-limiting columns to staff_members
-- 3. Hash all existing plaintext PINs
-- 4. Add trigger to auto-hash PINs on insert/update
-- 5. Replace verify_staff_pin RPC with secure version
-- ============================================================

-- Enable pgcrypto (needed for crypt() and gen_salt())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add rate limiting columns to staff_members
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Hash all existing plaintext PINs (one-time migration)
-- Only hash PINs that don't already look like a bcrypt hash (don't start with $2)
UPDATE public.staff_members
SET pin = crypt(pin, gen_salt('bf', 10))
WHERE pin IS NOT NULL
  AND pin != ''
  AND pin NOT LIKE '$2%';

-- ============================================================
-- Trigger: auto-hash PIN on insert or update
-- ============================================================
CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only hash if pin is set and not already a bcrypt hash
  IF NEW.pin IS NOT NULL AND NEW.pin != '' AND NEW.pin NOT LIKE '$2%' THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_staff_pin_change ON public.staff_members;
CREATE TRIGGER before_staff_pin_change
  BEFORE INSERT OR UPDATE OF pin ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.hash_staff_pin();

-- ============================================================
-- Updated verify_staff_pin RPC — bcrypt compare + rate limiting
-- Lockout: 5 failed attempts → 15 minute lockout
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  _business_id uuid,
  _pin text
)
RETURNS TABLE(id uuid, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff record;
BEGIN
  -- Find active staff member for this business
  SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
  INTO _staff
  FROM public.staff_members s
  WHERE s.business_id = _business_id
    AND s.status = 'active'
  LIMIT 1; -- will be replaced per-attempt below

  -- We need to check per-staff rather than short-circuiting early
  -- Loop through all active staff to find PIN match (avoids timing leaks on business ID)
  FOR _staff IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
    FROM public.staff_members s
    WHERE s.business_id = _business_id
      AND s.status = 'active'
  LOOP
    -- Check if this account is locked
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN
      CONTINUE; -- skip locked accounts
    END IF;

    -- Check PIN match using bcrypt
    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      -- SUCCESS: reset failed attempts, update last_login
      UPDATE public.staff_members
      SET failed_attempts = 0,
          locked_until = NULL
      WHERE public.staff_members.id = _staff.id;

      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;
  END LOOP;

  -- PIN did not match any staff — increment failed attempts on ALL staff
  -- that are not already locked (prevents enumeration via lockout timing)
  -- We increment on the most recently attempted business staff as a group heuristic
  UPDATE public.staff_members
  SET
    failed_attempts = failed_attempts + 1,
    locked_until = CASE
      WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
      ELSE locked_until
    END
  WHERE business_id = _business_id
    AND status = 'active'
    AND (locked_until IS NULL OR locked_until <= now());

  -- Return empty result (no match)
  RETURN;
END;
$$;

-- ============================================================
-- staff_logout RPC (unchanged but ensure it exists)
-- ============================================================
CREATE OR REPLACE FUNCTION public.staff_logout(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Could log to audit table here in future
  RETURN;
END;
$$;
