-- TASK ONBOARD §3 — the send-state screen, and the "I never received it" escape hatch.
--
-- Owner: "they see a screen that renders the actual email sending state with outcome …
-- below that is a link they can click if they never received it and it notifies us …
-- I need to receive an in app dashboard notice AND an email telling me what happened,
-- hopefully an error code for the email not sending or something."
--
-- Today /api/sign-start computes the send outcome (sendInvitationEmail already returns
-- {ok, messageId, error}) and THROWS IT AWAY behind a neutral 200. The person waiting
-- for the email cannot see what happened and neither can the owner.
--
-- THE MODEL IS request_alert_sends: one row per attempt, provable by query. LESSONS.md
-- records that fire-and-forget plus best-effort-200 is how two real leads were lost, so
-- nothing here is inferred from a status code:
--   signup_attempts     — one row per /sign provisioning attempt, carrying the send
--                         outcome and the provider's own error text.
--   signup_alert_sends  — one row per owner-alert email attempt, idempotency-keyed, so
--                         "the owner was told" is a fact and not an assumption.
--
-- ANTI-ENUMERATION IS PRESERVED. The screen learns whether the SEND succeeded — it
-- never learns whether the address was already known. Rate-limited requests report
-- being rate limited, which is keyed on the requester (ip+user-agent hash), not on the
-- email, so it is not an oracle either.

CREATE TABLE IF NOT EXISTS signup_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid REFERENCES organizations(id),
  email          text NOT NULL,
  first_name     text,
  last_name      text,
  phone          text,
  path           text,
  categories     text[],
  invitation_id  uuid REFERENCES invitations(id),
  /** did the activation email actually leave the building? */
  email_ok       boolean NOT NULL DEFAULT false,
  /** the transport's own words — the "error code" the owner asked for */
  email_error    text,
  message_id     text,
  /** true when the requester tripped sign_start_register_attempt and nothing was
   *  provisioned. Recorded so a person reporting "no email" can be told the truth. */
  rate_limited   boolean NOT NULL DEFAULT false,
  requester_hash text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  /** set the first time this person clicks "I never received it" */
  help_requested_at timestamptz
);

CREATE INDEX IF NOT EXISTS signup_attempts_email_idx ON signup_attempts (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS signup_attempts_help_idx  ON signup_attempts (help_requested_at)
  WHERE help_requested_at IS NOT NULL;

COMMENT ON TABLE signup_attempts IS
  'ONBOARD §3: one row per /sign signup attempt, carrying the REAL activation-email '
  'outcome (ok / provider error / rate-limited) so the send-state screen can render it '
  'and staff can see later that an account was created but never emailed.';

CREATE TABLE IF NOT EXISTS signup_alert_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  attempt_id      uuid NOT NULL REFERENCES signup_attempts(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  recipient_email text,
  succeeded       boolean NOT NULL,
  error           text,
  message_id      text,
  attempted_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_alert_sends_attempt_idx ON signup_alert_sends (attempt_id);

COMMENT ON TABLE signup_alert_sends IS
  'ONBOARD §3: one row per attempt to tell the owner that somebody never got their '
  'activation email. Mirrors request_alert_sends exactly — a send nobody can prove '
  'is a send nobody should claim.';

ALTER TABLE signup_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_alert_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS signup_attempts_staff    ON signup_attempts;
DROP POLICY IF EXISTS signup_alert_sends_staff ON signup_alert_sends;
CREATE POLICY signup_attempts_staff    ON signup_attempts    FOR SELECT USING (has_staff_access());
CREATE POLICY signup_alert_sends_staff ON signup_alert_sends FOR SELECT USING (has_staff_access());

-- ── record the attempt (service-role, from /api/sign-start) ──────────────────
CREATE OR REPLACE FUNCTION public.record_signup_attempt(
  p_org uuid, p_email text, p_first_name text, p_last_name text, p_phone text,
  p_path text, p_categories text[], p_invitation_id uuid,
  p_email_ok boolean, p_email_error text, p_message_id text,
  p_rate_limited boolean, p_requester_hash text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO signup_attempts (org_id, email, first_name, last_name, phone, path,
                               categories, invitation_id, email_ok, email_error,
                               message_id, rate_limited, requester_hash)
    VALUES (p_org, lower(btrim(p_email)), nullif(btrim(coalesce(p_first_name,'')),''),
            nullif(btrim(coalesce(p_last_name,'')),''), nullif(btrim(coalesce(p_phone,'')),''),
            p_path, p_categories, p_invitation_id, coalesce(p_email_ok, false),
            p_email_error, p_message_id, coalesce(p_rate_limited, false), p_requester_hash)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ── "I never received it" — the in-app half, and the email's payload ─────────
-- The dashboard notice is raised HERE (one insert per staff account, with the
-- diagnostic in the body so it is readable without opening anything), and the same
-- diagnostic is returned to the endpoint so the email says the same thing. Repeat
-- clicks do not raise a second notice; they still return the payload so a retried
-- email can be sent and recorded.
CREATE OR REPLACE FUNCTION public.claim_signup_help_alert(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_a       signup_attempts%ROWTYPE;
  v_first   boolean := false;
  v_name    text;
  v_diag    text;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO v_a FROM signup_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;

  IF v_a.help_requested_at IS NULL THEN
    UPDATE signup_attempts SET help_requested_at = now() WHERE id = p_attempt_id;
    v_first := true;
  END IF;

  v_name := nullif(btrim(coalesce(v_a.first_name,'') || ' ' || coalesce(v_a.last_name,'')), '');
  v_diag := CASE
    WHEN v_a.rate_limited THEN 'rate limited — no invitation was created for this attempt'
    WHEN v_a.email_ok     THEN 'the transport accepted it' ||
                               coalesce(' (message id ' || v_a.message_id || ')', '')
    ELSE coalesce(v_a.email_error, 'the send failed with no reported reason')
  END;

  -- the in-app dashboard notice, once, with the diagnostic in the body
  IF v_first AND v_a.org_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    SELECT v_a.org_id, p.user_id, 'signup_email_help',
           coalesce(v_name, v_a.email) || ' never received their activation email',
           v_a.email || ' · ' || coalesce(v_a.path, 'sign') || ' · ' || v_diag,
           '/app/records?tab=leads'
      FROM profiles p
     WHERE p.org_id = v_a.org_id
       AND coalesce(p.role, 'USER') IN ('ADMIN','MANAGER','EMPLOYEE','OWNER','SUPERADMIN');
  END IF;

  RETURN jsonb_build_object(
    'found', true, 'first', v_first, 'org_id', v_a.org_id,
    'email', v_a.email, 'name', v_name, 'phone', v_a.phone, 'path', v_a.path,
    'invitation_id', v_a.invitation_id, 'email_ok', v_a.email_ok,
    'rate_limited', v_a.rate_limited, 'error', v_a.email_error,
    'message_id', v_a.message_id, 'diagnostic', v_diag,
    'attempted_at', to_char(v_a.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_signup_alert_send(
  p_attempt_id uuid, p_key text, p_recipient text,
  p_ok boolean, p_error text, p_message_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT org_id INTO v_org FROM signup_attempts WHERE id = p_attempt_id;
  IF v_org IS NULL THEN RETURN; END IF;
  INSERT INTO signup_alert_sends (org_id, attempt_id, idempotency_key, recipient_email,
                                  succeeded, error, message_id)
    VALUES (v_org, p_attempt_id, p_key, p_recipient, coalesce(p_ok, false), p_error, p_message_id)
    ON CONFLICT (idempotency_key) DO NOTHING;
END;
$function$;

-- ── the owner's email, as CONTENT the owner can edit (D13) ───────────────────
INSERT INTO email_templates (email_key, title, description, category, subject, body,
                             from_address_rule, recipient_note, transactional, version, active)
SELECT 'SIGNUP_EMAIL_HELP',
       'Signup: activation email never arrived',
       'Sent to the ops inbox when somebody who signed up at /sign clicks "I never received it". '
         || 'Carries the send outcome and the transport''s own error so the cause is in the email.',
       'INBOUND',
       'Activation email never arrived — {{MSG.WHO}}',
       '<p><strong>{{MSG.WHO_HTML}}</strong> signed up and says the activation email never arrived.</p>'
       || '<ul style="padding-left:18px">'
       || '<li><strong>Email:</strong> {{MSG.EMAIL_HTML}}</li>'
       || '{{#if MSG.PHONE_HTML}}<li><strong>Phone:</strong> {{MSG.PHONE_HTML}}</li>{{/if}}'
       || '{{#if MSG.PATH_HTML}}<li><strong>Signed up as:</strong> {{MSG.PATH_HTML}}</li>{{/if}}'
       || '<li><strong>What happened:</strong> {{MSG.DIAGNOSTIC_HTML}}</li>'
       || '{{#if MSG.INVITATION_ID}}<li><strong>Invitation:</strong> {{MSG.INVITATION_ID}}</li>{{/if}}'
       || '<li><strong>Attempted:</strong> {{MSG.ATTEMPTED_AT_HTML}}</li>'
       || '</ul>'
       || '<p>They have been told support was notified and will reach out.</p>'
       || '<p><a href="{{MSG.LINK}}">Open the app</a> to resend their invitation.</p>'
       || '{{#if ORG.FOOTER_HTML}}<hr/><p style="color:#666;font-size:12px;white-space:pre-line">{{ORG.FOOTER_HTML}}</p>{{/if}}',
       'tenant', 'The tenant ops inbox.', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE email_key = 'SIGNUP_EMAIL_HELP');

REVOKE ALL ON FUNCTION public.record_signup_attempt(uuid, text, text, text, text, text, text[], uuid, boolean, text, text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_signup_help_alert(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_signup_alert_send(uuid, text, text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_signup_attempt(uuid, text, text, text, text, text, text[], uuid, boolean, text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_signup_help_alert(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_signup_alert_send(uuid, text, text, boolean, text, text) TO service_role;
