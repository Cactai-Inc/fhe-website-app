-- GUARDREST — make the RLS read gate agree with the frontend gate for MANAGER/EMPLOYEE.
--
-- THE MISMATCH. App.tsx routes ~25 `/app/ops/*` pages behind `requireStaff`, which is
-- AuthContext's isStaff = SUPER_ADMIN | ADMIN | MANAGER | EMPLOYEE — the client-side twin
-- of has_staff_access(). But documents_select / contacts_select / horses_select gate on
-- is_admin(), which is ADMIN | SUPER_ADMIN only. A MANAGER therefore walks through the
-- nav onto a page titled as the full queue and RLS returns only the rows they personally
-- own or are a party to.
--
-- Dormant only for want of an account: production profiles.role holds ADMIN(2),
-- SUPER_ADMIN(1), USER(10) and no MANAGER or EMPLOYEE. But mod.employees was enabled for
-- the FHE org at 2026-08-12 15:02 UTC, so the first instructor account makes it live.
--
-- THE DIRECTION, AND WHY THIS ONE. Two ways to make them agree; the layer counts decide it:
--   * has_staff_access() — 185 SECURITY DEFINER functions, plus the frontend route gate
--   * is_admin()        —  27 SECURITY DEFINER functions, plus these 3 RLS policies
-- Those 185 already let a MANAGER run contact_dossier, staff_update_horse, credits_roster,
-- confirm_booking and the rest of barn ops. Narrowing the frontend to is_admin() would
-- leave every one of them open while locking the UI, which relocates the incoherence
-- rather than closing it — and it would need ~185 further guard edits to be honest. It
-- would also contradict the owner's reversal of the InstructorHome retirement
-- (TASK-ADMINSWEEP M-6: "wire up, don't retire"), which says instructor accounts are
-- coming, not going.
-- So the three RLS policies are the outlier, and they are what moves.
--
-- SCOPE. READ only. The org boundary is unchanged and still does the confining: each of
-- these tables carries a RESTRICTIVE `org_id = current_org()` policy that is AND-ed with
-- the permissive one, so this widens a staff member's view within their own org and
-- nothing else. In particular it does NOT re-admit the platform owner: admin@cactai.io
-- has org_id NULL by design (D1a), so the restrictive test is NULL for it and it still
-- reads no FHE rows.
-- Write policies (documents_admin_write / contacts_admin_write / horses_admin_write) stay
-- is_admin(). Staff writes already travel through SECURITY DEFINER RPCs that bypass RLS
-- and gate on has_staff_access(), so this is the existing architecture, not a new gap.

ALTER POLICY documents_select ON public.documents
  USING (
    has_staff_access()
    OR caller_owns_document(id)
    OR caller_is_document_party(id)
    OR (horse_id IS NOT NULL AND client_can_read_horse(horse_id))
  );

ALTER POLICY contacts_select ON public.contacts
  USING (
    has_staff_access()
    OR (deleted_at IS NULL AND id = current_contact_id())
  );

ALTER POLICY horses_select ON public.horses
  USING (
    has_staff_access()
    OR client_can_read_horse(id)
  );

DO $verify$
DECLARE r record; v_bad int := 0;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual::text AS q
      FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname IN ('documents_select','contacts_select','horses_select')
  LOOP
    IF r.q !~ 'has_staff_access\(\)' THEN
      v_bad := v_bad + 1;
      RAISE WARNING 'GUARDREST: %.% did not take the widened gate: %', r.tablename, r.policyname, r.q;
    ELSIF r.q ~ 'is_admin\(\)' THEN
      v_bad := v_bad + 1;
      RAISE WARNING 'GUARDREST: %.% still carries is_admin(): %', r.tablename, r.policyname, r.q;
    ELSE
      RAISE NOTICE 'GUARDREST ok: %.% -> %', r.tablename, r.policyname, r.q;
    END IF;
  END LOOP;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'GUARDREST: % select policy/policies did not land as intended.', v_bad;
  END IF;
END
$verify$;
