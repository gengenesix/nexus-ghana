-- ============================================================
-- Migration 000012: Staff accounts for multi-tenant SaaS
-- Run once in Supabase SQL editor.
-- ============================================================

-- 1. Add supabase_user_id to staff_members
--    Nullable — kiosk/PIN-only staff have NULL here.
--    Supabase-auth staff have their auth.uid() here.
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS supabase_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_members_supabase_user_id
  ON public.staff_members(supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

-- 2. Add access_code to businesses
--    A short shareable code (e.g. "KWM-4829") that staff use to join.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS access_code varchar(10);

-- Generate codes for all existing businesses that don't have one yet
DO $$
DECLARE
  rec  record;
  code text;
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXY';
BEGIN
  FOR rec IN SELECT id FROM public.businesses WHERE access_code IS NULL LOOP
    LOOP
      code :=
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        '-' ||
        LPAD((FLOOR(RANDOM()*9000)+1000)::TEXT, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE access_code = code);
    END LOOP;
    UPDATE public.businesses SET access_code = code WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE public.businesses
  ALTER COLUMN access_code SET NOT NULL;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_access_code_unique;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_access_code_unique UNIQUE (access_code);

-- Trigger: auto-generate access_code on new business INSERT
CREATE OR REPLACE FUNCTION public.generate_business_access_code()
RETURNS trigger AS $$
DECLARE
  code    text;
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXY';
BEGIN
  IF NEW.access_code IS NULL OR NEW.access_code = '' THEN
    LOOP
      code :=
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        '-' ||
        LPAD((FLOOR(RANDOM()*9000)+1000)::TEXT, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE access_code = code);
    END LOOP;
    NEW.access_code := code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_businesses_access_code ON public.businesses;
CREATE TRIGGER trg_businesses_access_code
  BEFORE INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.generate_business_access_code();

-- 3. Update get_business_id() to resolve for both owners AND staff members
--    All existing RLS policies use this function — updating it here
--    automatically makes every table's policies work for staff too.
CREATE OR REPLACE FUNCTION public.get_business_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    -- Business owner path
    (SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1),
    -- Staff member path (Supabase-auth staff)
    (SELECT business_id FROM public.staff_members
     WHERE supabase_user_id = auth.uid() AND status = 'active' LIMIT 1)
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 4. Allow staff to SELECT their own business record
--    (existing businesses RLS only allows owner_id = auth.uid())
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'businesses' AND policyname = 'Staff can view their business'
  ) THEN
    CREATE POLICY "Staff can view their business" ON public.businesses
      FOR SELECT
      USING (
        id IN (
          SELECT business_id FROM public.staff_members
          WHERE supabase_user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

-- 5. RPC: join_business_as_staff
--    Called by new staff after they create their Supabase account.
--    Runs SECURITY DEFINER so it can read businesses without RLS blocking.
CREATE OR REPLACE FUNCTION public.join_business_as_staff(
  p_access_code text,
  p_name        text,
  p_role        text DEFAULT 'Staff'
)
RETURNS json AS $$
DECLARE
  v_business_id uuid;
  v_staff_id    uuid;
  v_email       text;
BEGIN
  -- Resolve business by access code (case-insensitive)
  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE UPPER(access_code) = UPPER(TRIM(p_access_code));

  IF v_business_id IS NULL THEN
    RETURN json_build_object('error', 'Invalid business code. Ask your manager for the correct code.');
  END IF;

  -- Prevent joining the same business twice
  IF EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE supabase_user_id = auth.uid() AND business_id = v_business_id
  ) THEN
    RETURN json_build_object('error', 'You are already a member of this business.');
  END IF;

  -- Get the email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Create the staff_members record
  INSERT INTO public.staff_members (
    business_id, name, role, supabase_user_id, status, email
  ) VALUES (
    v_business_id, TRIM(p_name), p_role, auth.uid(), 'active', v_email
  )
  RETURNING id INTO v_staff_id;

  RETURN json_build_object(
    'success', true,
    'staff_id', v_staff_id,
    'business_id', v_business_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Allow staff to update their own supabase_user_id (needed for linking)
--    The existing "Business members can update staff" policy uses get_business_id()
--    which requires them to already be linked. This covers the bootstrap case.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_members' AND policyname = 'Staff can link own account'
  ) THEN
    CREATE POLICY "Staff can link own account" ON public.staff_members
      FOR UPDATE
      USING (supabase_user_id = auth.uid())
      WITH CHECK (supabase_user_id = auth.uid());
  END IF;
END $$;

