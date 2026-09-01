-- Self-heal for the stale-session dead-end.
--
-- When someone is already signed in (e.g. a half-created account from an earlier
-- attempt) and clicks their invite link, the app has a live session and routes
-- straight to /app — SKIPPING the acceptance flow entirely. They land on the
-- member gate with no membership and see "Finishing setting up your account /
-- Refresh", a dead-end that never actually completes anything.
--
-- ensure_my_membership() only heals CLIENTS (those with a live clients row). A
-- staff invitee has no client row — their account is granted by an unredeemed
-- invitation. This function closes that gap: it finds a live, unaccepted invite
-- addressed to the CALLER'S OWN email and redeems it, granting exactly what the
-- normal acceptance flow would. The gate calls it before ever showing a dead-end.
--
-- Security: keyed strictly to the caller's own auth email — a user can only
-- redeem an invitation issued to their own address. Returns true if the account
-- is now active (membership or staff), false if there was nothing to redeem.

CREATE OR REPLACE FUNCTION public.redeem_my_pending_invitation()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  -- The newest live, unaccepted invitation addressed to the caller's own email.
  SELECT token INTO v_token
    FROM invitations
   WHERE lower(email) = v_email
     AND status = 'sent'
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_token IS NULL THEN
    RETURN false;
  END IF;

  -- Redeem it exactly as the acceptance flow would (creates profile with org,
  -- role, membership, staff_profiles). redeem_invitation re-checks the email
  -- match and raises on mismatch; here it always matches by construction.
  PERFORM public.redeem_invitation(v_token);

  RETURN EXISTS (
    SELECT 1 FROM memberships WHERE user_id = auth.uid() AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid()
      AND (role IN ('ADMIN','MANAGER','EMPLOYEE','SUPER_ADMIN') OR is_admin)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.redeem_my_pending_invitation() TO authenticated;
