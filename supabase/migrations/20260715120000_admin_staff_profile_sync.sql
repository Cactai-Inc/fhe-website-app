-- Every admin/staff account should have an Employees (staff_profiles) record, so
-- the Employees table always matches the Team roster. Previously a staff_profiles
-- row was created ONLY at invite redemption when the invite carried a title, so
-- the founding admin (never invited) was missing from Employees while an invited
-- admin appeared. Owner decision: every admin = an employee record.
--
-- 1) ensure_staff_profile(user_id): idempotent upsert of the row for one account.
-- 2) A trigger on profiles so promoting/creating a staff-role account (or flipping
--    is_admin) auto-ensures the row.
-- 3) Backfill every existing staff-role account.

CREATE OR REPLACE FUNCTION public.ensure_staff_profile(p_user_id uuid, p_title text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND OR v_profile.org_id IS NULL THEN
    RETURN;
  END IF;
  -- Only staff-role accounts get an employee record.
  IF NOT (v_profile.role IN ('ADMIN','MANAGER','EMPLOYEE','SUPER_ADMIN') OR v_profile.is_admin) THEN
    RETURN;
  END IF;

  INSERT INTO staff_profiles (org_id, profile_user_id, contact_id, title, active)
  VALUES (v_profile.org_id, p_user_id, v_profile.contact_id, p_title, true)
  ON CONFLICT (org_id, profile_user_id) DO UPDATE
    SET title      = coalesce(excluded.title, staff_profiles.title),
        contact_id = coalesce(staff_profiles.contact_id, excluded.contact_id),
        -- re-activate if it had been soft-deactivated but the person is staff again
        active     = true,
        deleted_at = NULL,
        updated_at = now();
END;
$function$;

-- Keep it in sync: any profile insert/update that lands on a staff role ensures
-- the employee record. Fires AFTER so the profile row is settled.
CREATE OR REPLACE FUNCTION public.profiles_sync_staff_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.role IN ('ADMIN','MANAGER','EMPLOYEE','SUPER_ADMIN') OR NEW.is_admin) THEN
    PERFORM ensure_staff_profile(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_profiles_sync_staff_profile ON profiles;
CREATE TRIGGER trg_profiles_sync_staff_profile
  AFTER INSERT OR UPDATE OF role, is_admin, org_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_sync_staff_profile();

-- Backfill every existing staff-role account that has no employee record.
INSERT INTO staff_profiles (org_id, profile_user_id, contact_id, active)
SELECT p.org_id, p.user_id, p.contact_id, true
FROM profiles p
WHERE p.org_id IS NOT NULL
  AND (p.role IN ('ADMIN','MANAGER','EMPLOYEE','SUPER_ADMIN') OR p.is_admin)
  AND NOT EXISTS (
    SELECT 1 FROM staff_profiles sp
    WHERE sp.profile_user_id = p.user_id AND sp.deleted_at IS NULL
  )
ON CONFLICT (org_id, profile_user_id) DO NOTHING;
