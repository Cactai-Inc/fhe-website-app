-- SECFIX2 G2 — replace the RLS-bypassing member_directory view with a definer RPC
--
-- THE HOLE
--   public.member_directory is a postgres-owned view with security_invoker OFF. SECFIX
--   revoked anon's SELECT (verified: anon's ACL entry is `awdDxtm` — no `r`), so it is no
--   longer publicly readable. But `authenticated` retains SELECT and, because the view
--   runs with the OWNER's rights, RLS on profiles and contacts never executes. Any caller
--   holding any JWT reads every directory row.
--
--   Verified in prod before this migration: 3 of the 10 profiles hold NO members row, and
--   they can read all 6 directory rows today. RLS is not merely bypassed in theory.
--
-- WHY NOT security_invoker = true ALONE, AND WHY NOT NEW SELECT POLICIES
--   The other four views took security_invoker. This one cannot: with RLS live,
--   profiles_select_own and contacts_select restrict a non-admin to their OWN row, so an
--   ordinary member's directory collapses 6 rows -> 1 and every other member's profile
--   page 404s. That is the lockout the task warns is worse than the exposure.
--
--   Directory-scoped SELECT policies on profiles/contacts were considered and REJECTED by
--   the orchestrator: such a policy applies everywhere those tables are read, not just in
--   the directory, and those rows carry dates of birth, home addresses and emergency
--   contacts. Widening table-level access to fix one view is the larger risk. This
--   migration adds NO policy to profiles or contacts.
--
-- THE FIX — a SECURITY DEFINER RPC that states its own gate
--   Same pattern already in use for exactly this "cross-row read RLS cannot express"
--   problem: my_documents(), contract_document_detail(), member_horses().
--
--   member_directory_list(p_user_id uuid default null)
--     - p_user_id NULL  -> the whole directory   (fetchMemberDirectory)
--     - p_user_id set   -> that one member       (fetchMemberProfile)
--     One function, so the column set and the gate cannot drift apart.
--
--   CALLER GATE (enforced in the body, not merely by the grant):
--     1. auth.uid() IS NULL            -> returns zero rows. No anonymous read.
--     2. the CALLER is is_suspended    -> returns zero rows.
--     EXECUTE is additionally granted only to authenticated and service_role; PUBLIC and
--     anon are revoked. Both gates are deliberate belt-and-braces.
--
--   COLUMN SET — narrower than the view (requirement: "only the columns the directory
--   actually needs"). The view also returned the legacy contacts.email / .mobile /
--   .whatsapp columns through a Stage A deprecation window. They are NOT returned here.
--   src/lib/community-types.ts does not declare them, so the TypeScript compiler already
--   proves nothing reads them — but `select('*')` shipped them over the wire regardless.
--   Dropping them is strictly stronger than gating them behind hide_email / hide_mobile /
--   hide_whatsapp: the data never leaves the database at all.
--
--   hide_* ENFORCEMENT — the five live community channels are nulled by their own flag,
--   character-for-character as the view did it, and preferred_contact still degrades to
--   'none' when the channel it names is hidden or empty. With RLS bypassed these flags are
--   the ONLY thing gating those columns, so they are enforced inside the function.
--
-- CALLER GATE SCOPE — deliberately NOT membership-gated. See the report.
--   is_active_member() would be the tighter gate and would still return 6 rows to a real
--   member. It is not used, because owner decision D8 states community access is gated by
--   ACCOUNT, not membership, and because a lockout is worse than the exposure. The three
--   non-member accounts that can read the directory today continue to. That is flagged in
--   docs/reports/TASK-SECFIX2-REPORT.md as a decision for the orchestrator, not settled
--   quietly here.
--
-- THE OLD PATH IS CLOSED BOTH WAYS
--   The view is kept (as documentation of the shape) but made unreadable by web roles:
--     - security_invoker = true  -> it can no longer bypass RLS even if reachable,
--     - SELECT revoked from PUBLIC, anon, authenticated -> no web role can reach it.
--   Nothing depends on it: 0 dependent views/rules (pg_depend via pg_rewrite) and 0
--   function bodies reference it (pg_proc.prosrc). Verified, not assumed. Keeping it
--   readable alongside the RPC would re-create the hole, which is why both are applied.
--
-- REVERT (restores the pre-migration state exactly):
--   ALTER VIEW public.member_directory RESET (security_invoker);
--   GRANT SELECT ON public.member_directory TO authenticated;   -- anon had no SELECT
--   DROP FUNCTION public.member_directory_list(uuid);

BEGIN;

CREATE OR REPLACE FUNCTION public.member_directory_list(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id           uuid,
  display_name      text,
  first_name        text,
  avatar_url        text,
  bio               text,
  riding_level      text,
  community_email   text,
  mobile_call       text,
  mobile_text       text,
  whatsapp_call     text,
  whatsapp_text     text,
  social_tiktok     text,
  social_instagram  text,
  social_facebook   text,
  social_linkedin   text,
  is_horse_owner    boolean,
  preferred_contact text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  -- Gate 1 — no anonymous reads.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Gate 2 — a suspended caller reads nothing.
  IF COALESCE((SELECT p2.is_suspended FROM profiles p2 WHERE p2.user_id = auth.uid()), false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    COALESCE(p.first_name, c.first_name)                                        AS first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
    CASE WHEN c.hide_community_email THEN NULL ELSE c.community_email END       AS community_email,
    CASE WHEN c.hide_mobile_call     THEN NULL ELSE c.mobile_call     END       AS mobile_call,
    CASE WHEN c.hide_mobile_text     THEN NULL ELSE c.mobile_text     END       AS mobile_text,
    CASE WHEN c.hide_whatsapp_call   THEN NULL ELSE c.whatsapp_call   END       AS whatsapp_call,
    CASE WHEN c.hide_whatsapp_text   THEN NULL ELSE c.whatsapp_text   END       AS whatsapp_text,
    c.social_tiktok,
    c.social_instagram,
    c.social_facebook,
    c.social_linkedin,
    EXISTS (
      SELECT 1 FROM horses h
      WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL
    )                                                                           AS is_horse_owner,
    CASE
      WHEN c.preferred_contact = 'email'     AND (c.hide_community_email OR c.community_email IS NULL) THEN 'none'
      WHEN c.preferred_contact = 'sms'       AND (c.hide_mobile_text     OR c.mobile_text     IS NULL) THEN 'none'
      WHEN c.preferred_contact = 'call'      AND (c.hide_mobile_call     OR c.mobile_call     IS NULL) THEN 'none'
      WHEN c.preferred_contact = 'whatsapp'  AND (c.hide_whatsapp_text   OR c.whatsapp_text   IS NULL) THEN 'none'
      WHEN c.preferred_contact = 'instagram' AND c.social_instagram IS NULL THEN 'none'
      WHEN c.preferred_contact = 'facebook'  AND c.social_facebook  IS NULL THEN 'none'
      WHEN c.preferred_contact = 'linkedin'  AND c.social_linkedin  IS NULL THEN 'none'
      WHEN c.preferred_contact = 'tiktok'    AND c.social_tiktok    IS NULL THEN 'none'
      ELSE c.preferred_contact
    END                                                                         AS preferred_contact
  FROM profiles p
  JOIN members  m ON m.user_id = p.user_id AND m.status = 'active'
  JOIN contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
  WHERE NOT p.is_suspended
    AND p.role IS DISTINCT FROM 'SUPER_ADMIN'
    AND (p_user_id IS NULL OR p.user_id = p_user_id)
  ORDER BY p.display_name NULLS LAST, p.user_id;
END;
$fn$;

COMMENT ON FUNCTION public.member_directory_list(uuid) IS
  'SECFIX2 G2. Community member directory. SECURITY DEFINER because the directory is a '
  'cross-row read that RLS cannot express (profiles_select_own / contacts_select restrict '
  'a non-admin to their own row). Gates itself: no anonymous caller, no suspended caller. '
  'Enforces the contacts.hide_* flags. Does NOT return the legacy email/mobile/whatsapp '
  'columns. Replaces the member_directory view, whose security_invoker was off.';

-- The old path, closed both ways.
ALTER VIEW public.member_directory SET (security_invoker = true);
REVOKE SELECT ON public.member_directory FROM PUBLIC, anon, authenticated;

-- EXECUTE: authenticated + service_role only. CREATE FUNCTION grants EXECUTE to PUBLIC by
-- default, so the revoke below is load-bearing, not decorative.
REVOKE ALL ON FUNCTION public.member_directory_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_directory_list(uuid) TO authenticated, service_role;

COMMIT;
