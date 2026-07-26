-- Rename "membership(s)" → "member(s)" in CODE IDENTIFIERS only (owner request).
-- Behaviour is IDENTICAL — same access gate, same RLS, same rows. This frees the
-- word "membership" for a future real membership PRODUCT. Marketing copy that
-- speaks of the public "Rider Community Membership" is intentionally NOT touched
-- (that's positioning, handled in the FE copy, left as-is).
--
-- Renames: table memberships → members; the two membership-named functions; and
-- rewrites the 6 function bodies that reference the table. A backward-compatible
-- VIEW `memberships` + wrapper `ensure_my_membership()` are kept temporarily so
-- the FE keeps working during the rename, then the FE is updated and these shims
-- can be dropped in a later migration.

BEGIN;

-- 1. Rename the table (constraints/indexes/policies ride along, keeping old
--    internal names — cosmetic; the object identity is what matters).
ALTER TABLE public.memberships RENAME TO members;

-- backward-compat VIEW so any not-yet-updated reader of `memberships` still works
CREATE OR REPLACE VIEW public.memberships AS SELECT * FROM public.members;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;

-- 2. is_active_member() — same logic, now reading members.
CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN COALESCE((SELECT p.is_suspended FROM profiles p WHERE p.user_id = auth.uid()), false) THEN false
    WHEN is_admin() THEN true
    ELSE EXISTS (SELECT 1 FROM members m WHERE m.user_id = auth.uid() AND m.status = 'active')
  END;
$function$;

-- 3. ensure_my_member_access() — the renamed ensure_my_membership (identical body,
--    reads/writes members). Keep ensure_my_membership() as a thin wrapper for the
--    FE transition.
CREATE OR REPLACE FUNCTION public.ensure_my_member_access()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_status  text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT status INTO v_status FROM members WHERE user_id = auth.uid();
  IF v_status = 'active' THEN RETURN true; END IF;

  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN RETURN false; END IF;

  SELECT cl.org_id INTO v_org FROM clients cl
   WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL
   ORDER BY cl.created_at DESC LIMIT 1;
  IF v_org IS NULL THEN RETURN false; END IF;

  IF v_status IS NULL THEN
    INSERT INTO members (user_id, tier, status, org_id)
      VALUES (auth.uid(), 'community', 'active', v_org)
      ON CONFLICT (user_id) DO UPDATE SET status = 'active';
    RETURN true;
  ELSIF v_status = 'paused' THEN
    UPDATE members SET status = 'active' WHERE user_id = auth.uid();
    RETURN true;
  END IF;
  RETURN false;
END;
$function$;

-- back-compat wrapper (FE still calls ensure_my_membership until updated)
CREATE OR REPLACE FUNCTION public.ensure_my_membership()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public.ensure_my_member_access(); $function$;

-- 4. redeem_my_pending_invitation — rewrite the member read (body used memberships).
--    Pull its current body, swap the table name. We re-create it referencing members.
DO $rebuild$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'redeem_my_pending_invitation';
  v_src := replace(v_src, 'FROM memberships', 'FROM members');
  v_src := replace(v_src, 'from memberships', 'from members');
  v_src := replace(v_src, 'INTO memberships', 'INTO members');
  v_src := replace(v_src, 'UPDATE memberships', 'UPDATE members');
  v_src := replace(v_src, 'INSERT INTO memberships', 'INSERT INTO members');
  EXECUTE v_src;
END $rebuild$;

-- 5. The community post-join trigger fn (memberships_post_join_event) + the other
--    body readers (my_onboarding_state, admin_client_accounts, admin_client_overview,
--    redeem_invitation): rewrite each by swapping the table name in its own body,
--    preserving all logic. Rename memberships_post_join_event → members_post_join_event.
DO $rebuild$
DECLARE
  fn text;
  v_src text;
  v_new text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'my_onboarding_state','admin_client_accounts','admin_client_overview','redeem_invitation'])
  LOOP
    SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = fn;
    IF v_src IS NULL THEN CONTINUE; END IF;
    v_src := regexp_replace(v_src, '\mmemberships\M', 'members', 'g');
    EXECUTE v_src;
  END LOOP;

  -- the community post-join trigger fn: create the renamed version
  -- members_post_join_event with the same body (table ref swapped), then re-point
  -- the trigger (which now sits on `members`) at it, and drop the old fn.
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'memberships_post_join_event';
  IF v_src IS NOT NULL THEN
    -- rename ONLY the CREATE FUNCTION target, then swap bare table refs in the body
    v_new := replace(v_src,
      'FUNCTION public.memberships_post_join_event()',
      'FUNCTION public.members_post_join_event()');
    v_new := regexp_replace(v_new, '\mmemberships\M', 'members', 'g');
    EXECUTE v_new;
  END IF;
END $rebuild$;

-- re-point the trigger (rode along onto `members`) at the renamed function, then
-- retire the old trigger + old function name.
DROP TRIGGER IF EXISTS trg_memberships_post_join_event ON public.members;
CREATE TRIGGER trg_members_post_join_event
  AFTER INSERT OR UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.members_post_join_event();
DROP FUNCTION IF EXISTS public.memberships_post_join_event();

-- 6. Rename the admin_client_accounts OUTPUT column membership_status →
--    member_status so the FE type (ClientAccountRow.member_status) matches. The
--    body already reads `members` after step 5's rewrite; here we only fix the
--    RETURNS TABLE column identifier (needs DROP for the signature change).
DO $rename_out$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='admin_client_accounts';
  IF v_src IS NOT NULL THEN
    v_src := replace(v_src, 'membership_status text', 'member_status text');
    v_src := replace(v_src, 'AS membership_status', 'AS member_status');
    v_src := replace(v_src, 'as membership_status', 'as member_status');
    EXECUTE 'DROP FUNCTION IF EXISTS public.admin_client_accounts()';
    EXECUTE v_src;
  END IF;
END $rename_out$;

-- 7. Rename the admin_client_overview OUTPUT jsonb key 'membership' → 'member' to
--    match the FE Overview.member field (body-only; no signature change).
DO $rename_key$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='admin_client_overview';
  IF v_src IS NOT NULL THEN
    v_src := replace(v_src, '''membership'',', '''member'',');
    EXECUTE v_src;
  END IF;
END $rename_key$;

COMMIT;
