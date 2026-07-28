-- Stage 1j follow-up: employment fields on profiles are ADMIN-ONLY.
--
-- The old staff table was admin-write-only under RLS. After the merge,
-- profiles_update_own would let any member self-set title / pay_type /
-- staff_active on their own row — a parity break caught in the 1j behavior
-- diff. The role-guard trigger now covers the employment fields exactly like
-- role/is_admin/org. Controlled privileged paths keep working:
--   - redeem_invitation already sets app.allow_profile_link='1' (verified)
--     before its employment update;
--   - ensure_staff_profile now sets the same transaction-local flag.

CREATE OR REPLACE FUNCTION public.profiles_role_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- controlled privileged paths (contract-invite redemption) set this flag
  -- transaction-locally inside a SECURITY DEFINER function.
  IF current_setting('app.allow_profile_link', true) = '1' THEN
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

  -- Stage 1j: employment fields carry the old staff table's admin-only write.
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.pay_type IS DISTINCT FROM OLD.pay_type
     OR NEW.staff_active IS DISTINCT FROM OLD.staff_active THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'only an admin may change employment fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ensure_staff_profile is a controlled path — mark it so the guard passes for
-- non-admin callers routed through it (e.g. self-heal flows).
CREATE OR REPLACE FUNCTION public.ensure_staff_profile(p_user_id uuid, p_title text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND OR v_profile.org_id IS NULL THEN RETURN; END IF;
  IF NOT (v_profile.role IN ('ADMIN','MANAGER','EMPLOYEE','SUPER_ADMIN') OR v_profile.is_admin) THEN RETURN; END IF;
  PERFORM set_config('app.allow_profile_link', '1', true);
  UPDATE profiles
     SET title = coalesce(p_title, title),
         staff_active = true
   WHERE user_id = p_user_id;
END;
$function$;

-- Assert the guard now covers the employment fields.
DO $$
BEGIN
  IF (SELECT prosrc FROM pg_proc WHERE proname='profiles_role_guard') NOT ILIKE '%staff_active%' THEN
    RAISE EXCEPTION 'profiles_role_guard missing the employment-field branch';
  END IF;
END $$;
