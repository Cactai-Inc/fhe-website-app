-- Stage 1j (REMEDIATION_PLAN): merge staff_profiles (2 rows — the two staff
-- accounts) into profiles (title, pay_type, staff_active).
--
-- D7 substrate note: staff_profiles feeds only the staff pickers and the
-- employees scheduling suite — none of the five dual-identity lanes read it
-- (docs/reference/DUAL_IDENTITY_TRACE.md reader list). Behavior-identity is proven by
-- md5-comparing the trace's key functions before/after this migration (they
-- are untouched) plus the FE surface staying shape-identical.
--
-- Grain change: shifts/time_entries re-key from staff_profiles.id to
-- profiles.user_id (both tables verified 0 rows). staff_profiles.contact_id
-- is asserted identical to profiles.contact_id before being discarded.

-- ── 1. Employment columns on profiles ───────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN title text,
  ADD COLUMN pay_type text,
  ADD COLUMN staff_active boolean NOT NULL DEFAULT false;

-- ── 2. Backfill (2 rows) with equivalence guard ─────────────────────────────
DO $$
DECLARE v_n int; v_mismatch int;
BEGIN
  SELECT count(*) INTO v_mismatch
    FROM staff_profiles sp JOIN profiles p ON p.user_id = sp.profile_user_id
   WHERE sp.contact_id IS DISTINCT FROM p.contact_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'staff_profiles.contact_id diverges from profiles.contact_id in % rows — merge unsafe', v_mismatch;
  END IF;

  UPDATE profiles p
     SET title = sp.title, pay_type = sp.pay_type,
         staff_active = (sp.active AND sp.deleted_at IS NULL)
    FROM staff_profiles sp
   WHERE sp.profile_user_id = p.user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN RAISE EXCEPTION 'expected 2 backfilled staff rows, got %', v_n; END IF;
END $$;

-- ── 3. shifts / time_entries re-grain (0 rows each, asserted) ───────────────
DO $$
DECLARE v_s int; v_t int;
BEGIN
  SELECT count(*) INTO v_s FROM shifts;
  SELECT count(*) INTO v_t FROM time_entries;
  IF v_s <> 0 OR v_t <> 0 THEN
    RAISE EXCEPTION 'shifts=% / time_entries=% not empty — data backfill required before re-grain', v_s, v_t;
  END IF;
END $$;

DROP POLICY shifts_self_read ON shifts;
DROP POLICY time_entries_self_read ON time_entries;
ALTER TABLE shifts       DROP COLUMN staff_profile_id;
ALTER TABLE time_entries DROP COLUMN staff_profile_id;
ALTER TABLE shifts       ADD COLUMN staff_user_id uuid NOT NULL REFERENCES profiles(user_id);
ALTER TABLE time_entries ADD COLUMN staff_user_id uuid NOT NULL REFERENCES profiles(user_id);
-- Same shape as before: PERMISSIVE self-read alongside the RESTRICTIVE
-- org/module gates and the permissive admin_write.
CREATE POLICY shifts_self_read ON shifts FOR SELECT
  USING (deleted_at IS NULL AND staff_user_id = auth.uid());
CREATE POLICY time_entries_self_read ON time_entries FOR SELECT
  USING (deleted_at IS NULL AND staff_user_id = auth.uid());

DROP FUNCTION caller_staff_profile_ids();

-- ── 4. ensure_staff_profile now marks the profile itself ────────────────────
CREATE OR REPLACE FUNCTION public.ensure_staff_profile(p_user_id uuid, p_title text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND OR v_profile.org_id IS NULL THEN RETURN; END IF;
  IF NOT (v_profile.role IN ('ADMIN','MANAGER','EMPLOYEE','SUPER_ADMIN') OR v_profile.is_admin) THEN RETURN; END IF;
  UPDATE profiles
     SET title = coalesce(p_title, title),
         staff_active = true
   WHERE user_id = p_user_id;
END;
$function$;

-- ── 5. redeem_invitation: the staff INSERT becomes a profiles UPDATE ────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='redeem_invitation';
  v_src := replace(v_src,
$old$    INSERT INTO staff_profiles (org_id, profile_user_id, title)
    VALUES (v_inv.org_id, auth.uid(), v_title)
    ON CONFLICT (org_id, profile_user_id) DO UPDATE SET title = excluded.title, updated_at = now();$old$,
$new$    UPDATE profiles SET title = v_title, staff_active = true WHERE user_id = auth.uid();$new$);
  IF v_src ILIKE '%staff_profiles%' THEN
    RAISE EXCEPTION 'redeem_invitation rewrite incomplete — staff_profiles still referenced';
  END IF;
  EXECUTE v_src;
END $$;

-- ── 6. Retire the table ─────────────────────────────────────────────────────
DROP TABLE staff_profiles;

-- ── 7. Assertions ───────────────────────────────────────────────────────────
DO $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND prosrc ILIKE '%staff_profiles%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'staff_profiles references remain in: %', v_bad;
  END IF;
END $$;
