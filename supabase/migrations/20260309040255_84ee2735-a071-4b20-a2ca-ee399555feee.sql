-- Create secure PIN verification function (never exposes PIN)
CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  _business_id uuid,
  _pin text
)
RETURNS TABLE (
  id uuid,
  name text,
  role text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.id, sm.name, sm.role, sm.status
  FROM public.staff_members sm
  WHERE sm.business_id = _business_id
    AND sm.pin = _pin
    AND sm.status = 'active'
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text) TO authenticated;