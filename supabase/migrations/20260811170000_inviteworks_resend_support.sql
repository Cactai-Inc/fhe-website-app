-- TASK INVITEWORKS — RESEND is not REGENERATE.
--
-- Owner ruling, 2026-08-11: an invitation link stays alive until it expires or
-- staff deliberately deactivate it. "I'll send it again" must NOT be what kills
-- the working link. This migration adds everything RESEND needs — none of it
-- changes what an existing live link does:
--
--   record_invitation_resend()        one 'resent' entry on the invitation's trail
--   invitation_replacement_notice()   what the retired-link PAGE may say
--   invitation_request_resend()       the rate-limited "send it to me again" claim
--
-- The change that DOES alter live-link behaviour — removing the unconditional
-- supersede from provision_client_invitation — is deliberately NOT in this file.
-- It is written, dry-run and held for owner sign-off (see the report).
--
-- No self-contained COMMIT: dry-run wrapper first, then apply.

-- ── 1. A resend is an event on the SAME invitation, not a new row ────────────
-- 'resent' already exists in status_events_vocab (sort_order 12, is_true_status
-- false) — it was defined and never written. This is its writer.
--
-- p_self_service marks the ones the INVITEE triggered from the retired-link
-- page, so the rate limit counts those without a staff resend eating the
-- person's own budget.
CREATE OR REPLACE FUNCTION public.record_invitation_resend(
  p_invitation_id uuid,
  p_self_service  boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_org uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR coalesce(has_staff_access(), false)) THEN
    RAISE EXCEPTION 'not authorized to record an invitation resend';
  END IF;

  SELECT org_id INTO v_org FROM invitations WHERE id = p_invitation_id;
  IF v_org IS NULL THEN RETURN false; END IF;

  INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
  VALUES (v_org, 'account', p_invitation_id, 'resent',
          CASE WHEN p_self_service THEN 'self-service' ELSE 'staff' END,
          auth.uid());
  RETURN true;
END;
$fn$;

-- ── 2. What the retired-link page is allowed to say ─────────────────────────
-- A masked address and a date are not a credential, so a holder of a RETIRED
-- token may be told where the current invitation went — but never the token
-- itself, and the page never links or redirects to it.
--
-- Returns NULL when: the token is unknown, the token is still LIVE (that page
-- is not shown), or there is no current invitation to point at.
CREATE OR REPLACE FUNCTION public.invitation_replacement_notice(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_old     invitations%ROWTYPE;
  v_new     invitations%ROWTYPE;
  v_local   text;
  v_domain  text;
  v_masked  text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN RETURN NULL; END IF;

  SELECT * INTO v_old FROM invitations WHERE token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- still usable: the caller should be activating, not reading this page
  IF v_old.status = 'sent' AND v_old.expires_at > now() AND v_old.deleted_at IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_new FROM invitations i
   WHERE i.org_id = v_old.org_id
     AND lower(i.email) = lower(v_old.email)
     AND i.status = 'sent'
     AND i.expires_at > now()
     AND i.deleted_at IS NULL
   ORDER BY i.created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_local  := split_part(v_new.email, '@', 1);
  v_domain := split_part(v_new.email, '@', 2);
  -- keep the first character and the last, mask the middle: enough for a person
  -- to recognise their own address, not enough to learn someone else's.
  v_masked := CASE
    WHEN length(v_local) <= 2 THEN left(v_local, 1) || '•••'
    ELSE left(v_local, 1) || repeat('•', greatest(length(v_local) - 2, 3)) || right(v_local, 1)
  END || '@' || v_domain;

  RETURN jsonb_build_object(
    'masked_email', v_masked,
    'sent_at',      v_new.created_at,
    'expires_at',   v_new.expires_at);
END;
$fn$;

-- ── 3. "Send it to me again", rate limited, address on file only ────────────
-- Given a RETIRED token, resolve that person's CURRENT live invitation and
-- claim one send against the rate limit. The caller never supplies an address:
-- the address comes off the invitation row, so this can only ever mail the
-- person it was already going to.
--
-- Limit: 3 self-service sends per invitation per hour, counted off the 'resent'
-- trail this migration writes — no new table, and staff resends (detail
-- 'staff') do not consume the invitee's budget.
CREATE OR REPLACE FUNCTION public.invitation_request_resend(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_old   invitations%ROWTYPE;
  v_new   invitations%ROWTYPE;
  v_count int;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  SELECT * INTO v_old FROM invitations WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false); END IF;

  SELECT * INTO v_new FROM invitations i
   WHERE i.org_id = v_old.org_id
     AND lower(i.email) = lower(v_old.email)
     AND i.status = 'sent'
     AND i.expires_at > now()
     AND i.deleted_at IS NULL
   ORDER BY i.created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false); END IF;

  SELECT count(*) INTO v_count
    FROM status_events e
   WHERE e.entity_type = 'account' AND e.entity_id = v_new.id
     AND e.status = 'resent' AND e.detail = 'self-service'
     AND e.created_at > now() - interval '1 hour';
  IF v_count >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'rate_limited', true);
  END IF;

  RETURN jsonb_build_object(
    'allowed',       true,
    'invitation_id', v_new.id,
    'email',         v_new.email,
    'token',         v_new.token,
    'expires_at',    v_new.expires_at);
END;
$fn$;

-- Grants. NOTE: `REVOKE ... FROM public` is NOT enough on this project —
-- Supabase's default privileges GRANT EXECUTE to anon and authenticated at
-- CREATE time, so those are role-specific grants that a PUBLIC revoke leaves
-- untouched (verified: proacl carried anon=X after the first apply). Every
-- role that must not reach a function is revoked BY NAME.
REVOKE ALL ON FUNCTION public.record_invitation_resend(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_invitation_resend(uuid, boolean) TO authenticated, service_role;

-- the notice is read by a SIGNED-OUT person holding a retired link
REVOKE ALL ON FUNCTION public.invitation_replacement_notice(text) FROM public;
GRANT EXECUTE ON FUNCTION public.invitation_replacement_notice(text) TO anon, authenticated, service_role;

-- service_role ONLY: it returns a LIVE TOKEN, and only the serverless sender
-- may hold one. It is never exposed to a browser. (The body also refuses any
-- non-service_role caller — belt and braces, because this one leaks a
-- credential if either layer is wrong.)
REVOKE ALL ON FUNCTION public.invitation_request_resend(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invitation_request_resend(text) TO service_role;

-- Same correction for the delivery recorder added in 20260811160000: it was
-- created with the same inherited anon grant. Its body already refuses a
-- non-staff caller; this closes the reach as well as the effect.
REVOKE ALL ON FUNCTION public.record_invitation_delivery(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_invitation_delivery(uuid, boolean, text) TO authenticated, service_role;
