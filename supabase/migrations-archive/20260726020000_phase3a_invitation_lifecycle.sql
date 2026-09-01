-- Phase 3a — invitation lifecycle.
--
-- Discovery established:
--   * invitations.status CHECK = sent/accepted/expired/revoked; 'expired' is
--     allowed but NEVER written (expiry is time-based via expires_at). redeem
--     only reads 'sent' and writes 'accepted', RAISEing on every failure — so a
--     failed redemption leaves no trace and the client sees a raw error.
--   * No config row governs expiry; the API hardcodes 7-day / 48h windows.
--   * Resend just flips prior 'sent' rows to 'revoked' (no supersede link).
--   * notify_staff + notifications table + mirror_admin_notification all exist.
--
-- This migration makes the lifecycle explicit and legible:
--   1. config-driven expiry (INVITATIONS/EXPIRY_DAYS) + a helper the API can read.
--   2. expanded status vocab + failure_reason / superseded_by / resend_of.
--   3. redeem_invitation records success (redeemed) vs failure
--      (redeemed_unsuccessful + reason) and notifies staff on failure — while
--      preserving the RAISE contract the FE depends on for hard mismatches.
--   4. a supersede helper so resend links the new invite to the old one.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Config-driven expiry. One org-scoped row per org; default 7 days.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.config_values (org_id, namespace, key, value_text)
SELECT o.id, 'INVITATIONS', 'EXPIRY_DAYS', '7'
  FROM public.organizations o
  ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.invitation_expiry_days(p_org uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT nullif(btrim(value_text), '')::int
       FROM config_values
      WHERE org_id = p_org AND namespace = 'INVITATIONS' AND key = 'EXPIRY_DAYS'),
    7);
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Expanded status vocabulary + lifecycle-link columns.
--    Keep the legacy values (sent/accepted/expired/revoked) for back-compat;
--    add the new lifecycle states. 'accepted' remains the historical success
--    marker; new redemptions write 'redeemed'.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_status_check;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_status_check CHECK (status = ANY (ARRAY[
    'sent','accepted','redeemed','redeemed_unsuccessful',
    'expired','revoked','superseded']));

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resend_of uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. redeem_invitation — record SUCCESS (redeemed) inline; keep the RAISE
--    contract the FE depends on for failures. A raising function cannot also
--    durably persist a failure record (its own UPDATE unwinds with the RAISE),
--    so failure recording is a SEPARATE committed call: record_invitation_failure,
--    which the FE invokes from its catch handler. This keeps redeem transactional
--    and the failure log durable + notifying.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_invitation_failure(p_token text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_any    invitations%ROWTYPE;
  v_email  text;
  v_reason text;
BEGIN
  SELECT * INTO v_any FROM invitations WHERE token = p_token ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'token_not_found'; END IF;  -- nothing to record against

  IF auth.uid() IS NOT NULL THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  END IF;

  v_reason := CASE
    WHEN v_any.status = 'sent' AND v_any.expires_at <= now() THEN 'token_expired'
    WHEN v_any.status = 'sent' AND v_email IS NOT NULL AND lower(v_any.email) IS DISTINCT FROM v_email
      THEN 'email_address_mismatch'
    WHEN v_any.status <> 'sent' THEN 'already_' || v_any.status
    ELSE 'invalid' END;

  -- only the live/expired states convert to a failure record; don't clobber a
  -- successful redemption that raced.
  UPDATE invitations
     SET status = 'redeemed_unsuccessful', failure_reason = v_reason
   WHERE id = v_any.id AND status IN ('sent','expired');

  IF FOUND THEN
    PERFORM notify_staff(v_any.org_id, 'invitation_redeem_failed',
      'An invitation could not be redeemed (' || v_reason || ')', '/app/admin');
  END IF;
  RETURN v_reason;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inv   invitations%ROWTYPE;
  v_email text;
  v_fn    text;
  v_ln    text;
  v_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in before redeeming an invitation';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  v_fn    := nullif(btrim(coalesce(v_inv.first_name, '')), '');
  v_ln    := nullif(btrim(coalesce(v_inv.last_name,  '')), '');
  v_title := nullif(btrim(coalesce(v_inv.title,      '')), '');

  PERFORM set_config('app.allow_profile_link', '1', true);

  INSERT INTO profiles (user_id, org_id, first_name, last_name)
  VALUES (auth.uid(), v_inv.org_id, v_fn, v_ln)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE profiles
     SET role       = CASE WHEN v_inv.invited_role <> 'USER' THEN v_inv.invited_role ELSE role END,
         is_admin   = CASE WHEN v_inv.invited_role = 'ADMIN' THEN true ELSE is_admin END,
         org_id     = coalesce(org_id, v_inv.org_id),
         first_name = coalesce(nullif(btrim(coalesce(first_name, '')), ''), v_fn),
         last_name  = coalesce(nullif(btrim(coalesce(last_name,  '')), ''), v_ln)
   WHERE user_id = auth.uid();

  INSERT INTO memberships (user_id, tier, status)
  VALUES (auth.uid(), 'community', 'active')
  ON CONFLICT (user_id) DO UPDATE SET status = 'active';

  IF v_inv.invited_role IN ('MANAGER','ADMIN','EMPLOYEE') AND v_title IS NOT NULL THEN
    INSERT INTO staff_profiles (org_id, profile_user_id, title)
    VALUES (v_inv.org_id, auth.uid(), v_title)
    ON CONFLICT (org_id, profile_user_id) DO UPDATE SET title = excluded.title, updated_at = now();
  END IF;

  -- Success: 'redeemed' is the new terminal success marker (accepted stays as
  -- the legacy value on historical rows).
  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;
  RETURN true;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Supersede-on-resend helper. When a new invite replaces an old one, link
--    them (resend_of on the new, superseded_by + status='superseded' on the old)
--    so the client page can show the live link above the grayed-out prior one.
--    Used by the send-invitation API instead of a bare revoke.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.supersede_invitations(
  p_org uuid, p_email text, p_new_invitation_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  WITH superseded AS (
    UPDATE invitations
       SET status = 'superseded', superseded_by = p_new_invitation_id
     WHERE org_id = p_org
       AND lower(email) = lower(p_email)
       AND id <> p_new_invitation_id
       AND status = 'sent'
       AND deleted_at IS NULL
    RETURNING 1)
  SELECT count(*) INTO v_count FROM superseded;

  UPDATE invitations SET resend_of = (
    SELECT id FROM invitations
     WHERE org_id = p_org AND lower(email) = lower(p_email)
       AND id <> p_new_invitation_id AND status = 'superseded'
     ORDER BY created_at DESC LIMIT 1)
   WHERE id = p_new_invitation_id AND resend_of IS NULL;

  RETURN v_count;
END;
$function$;

COMMIT;
