-- OWNER, 2026-09-01 — the intake email field must recognise who is knocking.
-- `docs/reports/SIGNBOOK-FINDING-the-door-does-not-know-who-is-knocking.md` holds
-- his words verbatim and the measurement behind them.
--
--   *"it doesnt check if that email belongs to and account already, my test case
--   just proved that by rejecting my password setup step … if they already
--   completed that flow … the input of the email address should trigger an email
--   to them that says click here to sign into your account. and the link takes
--   them to the login page … if they didnt do that step and all they did was
--   submit the form to us then the email should be recognized as belonging to
--   that account but needing auth set up and docs signed."*
--
-- ⚠️ ONE READER OF `auth.users`, AND THIS IS IT (D18). `service_role` has USAGE on
-- the `auth` schema but NO SELECT on `auth.users` — measured:
--   has_schema_privilege('service_role','auth','USAGE')      = t
--   has_table_privilege ('service_role','auth.users','SELECT') = f
-- which is exactly why `api/register-invited.ts`'s existing-account branch could
-- never work: it read that table through PostgREST, got nothing, and answered
-- 409 "an account already exists — sign in instead" to somebody who was in the
-- middle of claiming their own invitation. A SECURITY DEFINER function owned by
-- postgres can read it; nothing else needs to.

-- ─── THE STATE OF ONE ADDRESS ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.account_state_for_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_user    uuid;
  v_contact uuid;
  v_signin  boolean := false;
BEGIN
  -- ⚠️ SERVICE ROLE ONLY. This function answers "does this address have an
  -- account", which is the exact question the door's anti-enumeration posture
  -- refuses to answer to a browser. It is for the SERVER to decide which email
  -- to send; the response the visitor sees is identical either way.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_email = '' THEN RETURN jsonb_build_object('state', 'new'); END IF;

  SELECT u.id INTO v_user FROM auth.users u
   WHERE lower(u.email) = v_email AND u.deleted_at IS NULL
   ORDER BY u.created_at LIMIT 1;

  -- ⚠️ "CAN SIGN IN" IS AN IDENTITY, NOT A PASSWORD. Measured 2026-09-01: of 18
  -- accounts, 9 carry no `encrypted_password` at all — they are Google identities
  -- and they sign in perfectly well. Testing for a password would have sent every
  -- Google member down the "set up your auth" path they finished months ago.
  IF v_user IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = v_user)
        OR EXISTS (SELECT 1 FROM auth.users u
                    WHERE u.id = v_user
                      AND coalesce(u.encrypted_password, '') <> '')
      INTO v_signin;
  END IF;

  SELECT c.id INTO v_contact FROM contacts c
   WHERE lower(c.email) = v_email AND c.deleted_at IS NULL AND NOT c.is_company
   ORDER BY c.created_at LIMIT 1;

  RETURN jsonb_build_object(
    -- 'active' — they finished; send them to the login page.
    -- 'known'  — we hold a record (a lead, an order, an invitation) and they have
    --            never set up auth; send the activation email.
    -- 'new'    — nobody; send the activation email.
    'state', CASE WHEN v_user IS NOT NULL AND v_signin THEN 'active'
                  WHEN v_contact IS NOT NULL OR v_user IS NOT NULL THEN 'known'
                  ELSE 'new' END,
    'user_id', v_user,
    'contact_id', v_contact);
END;
$function$;

REVOKE ALL ON FUNCTION public.account_state_for_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.account_state_for_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.account_state_for_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.account_state_for_email(text) TO service_role;

-- ─── THE THIRD EMAIL — "you already have an account" ─────────────────────────
-- D13: the wording is a template row, editable without a developer, exactly like
-- INVITATION and CONTRACT_INVITE beside it.
INSERT INTO email_templates (
  email_key, title, description, category, subject, body,
  recipient_note, transactional, version, active)
SELECT
  'SIGN_IN_EXISTING',
  'You already have an account',
  'Sent when somebody enters an address at a /sign/* door, or submits an order on '
    || 'the website, and that address already has a working sign-in. It replaces the '
    || 'activation email, which would send them to set up an account they finished '
    || 'setting up. Owner ruling 2026-09-01.',
  'ACCOUNT',
  'Sign in to your account — {{ORG.BRAND_NAME}}',
  '<p>{{#if PARTY.GREETING_NAME}}Hi {{PARTY.GREETING_NAME}},{{else}}Hello,{{/if}}</p>'
    || '<p>You already have an account with us, so there is nothing to set up — '
    || '<strong>click below to sign in</strong>.</p>'
    || '<p style="margin:24px 0"><a href="{{MSG.LINK}}" '
    || 'style="background:#143321;color:#fff;padding:12px 22px;text-decoration:none;'
    || 'display:inline-block">Sign in to your account</a></p>'
    || '<p style="color:#666;font-size:13px">Signing in with {{MSG.RECIPIENT_EMAIL}}. '
    || 'If you have forgotten your password, use the "forgot password" link on that page.</p>'
    || '{{#if ORG.FOOTER}}<hr/><p style="color:#666;font-size:12px;white-space:pre-line">'
    || '{{ORG.FOOTER}}</p>{{/if}}',
  'The person who entered their address. Never staff, never the ops inbox.',
  true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE email_key = 'SIGN_IN_EXISTING');
