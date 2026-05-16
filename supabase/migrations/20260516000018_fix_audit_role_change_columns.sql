-- ============================================================
-- Migration 000018: Fix audit_role_change() trigger column names
--
-- Root cause:
--   Migration 000015 created audit_role_change() using column names
--   old_value, new_value, and performed_by — none of which exist on
--   the audit_logs table. The actual columns are:
--     old_values   jsonb   (plural)
--     new_values   jsonb   (plural)
--     staff_id     uuid    (the actor — NOT performed_by)
--     staff_name   text    (actor's display name)
--     details      jsonb   (extra context)
--     record_type  text    (non-null with default '')
--
--   Every role change attempt threw:
--     "column old_value of relation audit_logs does not exist"
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_staff_id uuid;
  v_actor_name     text;
BEGIN
  -- Only fire when role actually changes
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- Resolve the actor's staff record.
  -- Business owners have no staff_members row → both will be NULL, which is fine
  -- (staff_id is nullable; staff_name defaults to '').
  SELECT id, name
  INTO   v_actor_staff_id, v_actor_name
  FROM   public.staff_members
  WHERE  supabase_user_id = auth.uid()
    AND  business_id       = NEW.business_id
  LIMIT 1;

  INSERT INTO public.audit_logs (
    business_id,
    staff_id,
    staff_name,
    action,
    module,
    record_type,
    record_id,
    old_values,
    new_values,
    details
  ) VALUES (
    NEW.business_id,
    v_actor_staff_id,
    COALESCE(v_actor_name, 'Owner'),
    'role_change',
    'staff',
    'staff_member',
    NEW.id::text,
    json_build_object('role', OLD.role),
    json_build_object('role', NEW.role),
    json_build_object(
      'target_staff_id',   NEW.id,
      'target_staff_name', NEW.name,
      'changed_by_uid',    auth.uid()::text
    )
  );

  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_audit_role_change ON public.staff_members;
CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_change();
