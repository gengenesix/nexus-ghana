-- ============================================================
-- Migration 000021: Auto 8-digit Staff ID + remove kiosk PIN system
--
-- Changes:
--   1. staff_members.pin made nullable (PIN kiosk login removed)
--   2. generate_unique_staff_id() — globally unique 8-digit numeric string
--   3. trg_auto_staff_id — auto-assigns staff_id on INSERT if not provided
--
-- Staff now login exclusively with:
--   Access Code + 8-digit Staff ID + Password (issued by admin)
-- ============================================================

-- 1. Make pin nullable — kiosk PIN login is retired
ALTER TABLE public.staff_members
  ALTER COLUMN pin DROP NOT NULL;

-- 2. Generate a globally unique 8-digit numeric staff ID (10000000–99999999)
CREATE OR REPLACE FUNCTION public.generate_unique_staff_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempt   int := 0;
BEGIN
  LOOP
    -- Random 8-digit integer cast to zero-padded text
    candidate := lpad(
      (floor(10000000 + random() * 90000000))::bigint::text,
      8, '0'
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.staff_members WHERE staff_id = candidate
    );
    attempt := attempt + 1;
    IF attempt > 200 THEN
      RAISE EXCEPTION 'generate_unique_staff_id: failed after 200 attempts';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Trigger function: assign staff_id before INSERT if missing
CREATE OR REPLACE FUNCTION public.trg_fn_assign_staff_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.staff_id IS NULL OR TRIM(NEW.staff_id) = '' THEN
    NEW.staff_id := generate_unique_staff_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_staff_id ON public.staff_members;
CREATE TRIGGER trg_auto_staff_id
  BEFORE INSERT ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION trg_fn_assign_staff_id();
