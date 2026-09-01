-- ROLE GUARD (Update B backend). profiles_update_own lets a member update their own
-- row with no column restriction — which would let them self-escalate `role` /
-- `is_admin` / hop `org_id` via a direct PostgREST update. The admin UI now edits
-- roles first-class (adminSetRole), so close the hole properly:
--   * only an admin may change role / is_admin / org_id
--   * only a SUPER_ADMIN may grant or revoke SUPER_ADMIN
--   * service-role / no-JWT paths (auth.uid() IS NULL — provisioning, crons) pass
CREATE OR REPLACE FUNCTION public.profiles_role_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- privileged/system contexts (service key, definer jobs with no JWT) pass through
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN

    IF NOT is_admin() THEN
      RAISE EXCEPTION 'only an admin may change role, admin flag, or org';
    END IF;

    IF (NEW.role = 'SUPER_ADMIN' OR OLD.role = 'SUPER_ADMIN')
       AND app_role() <> 'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'only a super admin may grant or revoke super admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_guard_trg ON public.profiles;
CREATE TRIGGER profiles_role_guard_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_role_guard();
