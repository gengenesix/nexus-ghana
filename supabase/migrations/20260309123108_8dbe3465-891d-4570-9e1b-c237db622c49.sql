-- Add staff_id (username), last_login, and is_online columns
ALTER TABLE public.staff_members 
  ADD COLUMN IF NOT EXISTS staff_id text,
  ADD COLUMN IF NOT EXISTS last_login timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

-- Create index on staff_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_staff_members_staff_id ON public.staff_members(business_id, staff_id);

-- Update verify_staff_pin to also accept staff_id login and track last_login
CREATE OR REPLACE FUNCTION public.verify_staff_pin(_business_id uuid, _pin text)
RETURNS TABLE(id uuid, name text, role text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mark the staff member as online and update last_login
  UPDATE public.staff_members sm
  SET is_online = true, last_login = now()
  WHERE sm.business_id = _business_id
    AND sm.pin = _pin
    AND sm.status = 'active';

  RETURN QUERY
  SELECT sm.id, sm.name, sm.role, sm.status
  FROM public.staff_members sm
  WHERE sm.business_id = _business_id
    AND sm.pin = _pin
    AND sm.status = 'active'
  LIMIT 1;
END;
$$;

-- Function to log out staff (set offline)
CREATE OR REPLACE FUNCTION public.staff_logout(_staff_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.staff_members SET is_online = false WHERE id = _staff_id;
$$;