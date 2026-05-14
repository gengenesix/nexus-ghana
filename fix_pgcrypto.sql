CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin != '' AND NEW.pin NOT LIKE '$2%' THEN
    NEW.pin := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, uuid);

CREATE FUNCTION public.verify_staff_pin(
  _business_id uuid, _pin text, _staff_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text, permissions jsonb, user_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _s record;
BEGIN
  IF _staff_id IS NOT NULL THEN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until,
           s.permissions, s.user_type
      INTO _s FROM public.staff_members s
     WHERE s.id = _staff_id AND s.business_id = _business_id AND s.status = 'active';
    IF NOT FOUND THEN RETURN; END IF;
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN RETURN; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.permissions, _s.user_type;
      RETURN;
    END IF;
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = _s.id;
    RETURN;
  END IF;
  FOR _s IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until,
           s.permissions, s.user_type
      FROM public.staff_members s
     WHERE s.business_id = _business_id AND s.status = 'active'
  LOOP
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN CONTINUE; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.permissions, _s.user_type;
      RETURN;
    END IF;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, uuid) TO authenticated;
