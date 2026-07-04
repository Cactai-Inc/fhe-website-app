/*
  # FHE CRM — Lesson Sessions spine (BOOKING_FLOWS_PLAN: real lesson date/times)

  ADDITIVE ONLY — live production data. Before this migration NO table stored a
  confirmed lesson datetime (availability_slots/bookings_v2 are orphaned
  order-era relics and are NOT built on): staff confirmed times by phone and the
  member's Schedule page showed community events only. This migration adds the
  lesson-session spine end to end:

  1. lesson_sessions — the confirmed lesson bookings: org-scoped, one row per
     scheduled lesson (client, starts_at/ends_at, status SCHEDULED → COMPLETED /
     CANCELLED / NO_SHOW, optional engagement/request linkage, the debited
     lesson_credits row). RLS mirrors lesson_credits (20260630070000): a
     RESTRICTIVE tenancy boundary + RESTRICTIVE mod.lessons gate + staff RCUD
     (has_staff_access()) + a client reads OWN rows (client_id =
     current_client_id()).

  2. RPCs (SECURITY DEFINER, staff/service_role fenced like
     provision_lesson_invitation, org stamped explicitly from the client row —
     never DEFAULT current_org(), which is NULL for service-role callers):
       - schedule_lesson_session — books a session, rejects overlapping
         SCHEDULED sessions for the client, flips a linked request to
         'converted', notifies the member's app user (lesson_scheduled).
       - complete_lesson_session — SCHEDULED → COMPLETED; atomically debits the
         OLDEST lesson_credits row with credits_remaining > 0 (row-locked
         UPDATE), stamps lesson_sessions.credit_id, returns the live remaining
         balance. No credits → still COMPLETED, debited:false.
       - cancel_lesson_session — SCHEDULED → CANCELLED (member notified,
         lesson_cancelled) or NO_SHOW.
       - my_lesson_sessions — the authenticated member's own sessions,
         upcoming-first then recent past (member-facing, not staff-gated).

  3. PURCHASE → CREDITS SYNC — provision_lesson_invitation v3 (same 8-param
     signature as v2, 20260703080000): when the tier yields lessons_included
     (the existing v_lessons snapshot) the provision ALSO grants the punch-card
     credits (lesson_credits row, package_key = tier label). Before v3 the
     client_purchases snapshot and the lesson_credits ledger were never synced.

  4. BACKFILL — existing paid client_purchases rows with lessons_included get
     their missing lesson_credits rows. Idempotent: NOT EXISTS on (client via
     engagement, package_key = tier_label, credits_total = lessons_included),
     so re-running the statement never duplicates.
*/

-- ============================================================
-- 1. lesson_sessions — confirmed lesson bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS lesson_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
  request_id    uuid REFERENCES requests(id) ON DELETE SET NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'SCHEDULED'
                  CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  location      text,
  notes         text,
  credit_id     uuid REFERENCES lesson_credits(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  deleted_by    uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS lesson_sessions_org_idx          ON lesson_sessions (org_id);
CREATE INDEX IF NOT EXISTS lesson_sessions_client_start_idx ON lesson_sessions (client_id, starts_at);
CREATE INDEX IF NOT EXISTS lesson_sessions_status_idx       ON lesson_sessions (status);

DROP TRIGGER IF EXISTS lesson_sessions_set_updated_at ON lesson_sessions;
CREATE TRIGGER lesson_sessions_set_updated_at BEFORE UPDATE ON lesson_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_lesson_sessions ON lesson_sessions;
CREATE TRIGGER audit_lesson_sessions AFTER INSERT OR UPDATE OR DELETE ON lesson_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

ALTER TABLE lesson_sessions ENABLE ROW LEVEL SECURITY;

-- seam 1: tenancy boundary (RESTRICTIVE) — mirrors lesson_credits_org_boundary.
DROP POLICY IF EXISTS lesson_sessions_org_boundary ON lesson_sessions;
CREATE POLICY lesson_sessions_org_boundary ON lesson_sessions AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- seam 2: module gate (RESTRICTIVE) — a mod.lessons-OFF tenant sees zero rows.
DROP POLICY IF EXISTS lesson_sessions_module_gate ON lesson_sessions;
CREATE POLICY lesson_sessions_module_gate ON lesson_sessions AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_module('mod.lessons')) WITH CHECK (has_module('mod.lessons'));

-- seam 3: access — staff RCUD; a client reads ONLY their own sessions.
DROP POLICY IF EXISTS lesson_sessions_staff_write ON lesson_sessions;
CREATE POLICY lesson_sessions_staff_write ON lesson_sessions
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());

DROP POLICY IF EXISTS lesson_sessions_client_read_own ON lesson_sessions;
CREATE POLICY lesson_sessions_client_read_own ON lesson_sessions
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND client_id = current_client_id());

-- ============================================================
-- 2a. schedule_lesson_session — staff confirm a real lesson date/time
-- ============================================================
CREATE OR REPLACE FUNCTION schedule_lesson_session(
  p_client_id     uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_engagement_id uuid DEFAULT NULL,
  p_request_id    uuid DEFAULT NULL,
  p_location      text DEFAULT NULL,
  p_notes         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org     uuid;
  v_contact uuid;
  v_id      uuid;
  v_user    uuid;
BEGIN
  -- staff in an org session, or the service-role API — same fence as
  -- provision_lesson_invitation.
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to schedule lessons';
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'a lesson needs a start and an end, and the end must be after the start';
  END IF;

  -- org from the CLIENT row (explicit stamp — DEFAULT current_org() is NULL for
  -- service-role callers); staff may only book inside their own tenant.
  SELECT cl.org_id, cl.contact_id INTO v_org, v_contact
    FROM clients cl WHERE cl.id = p_client_id AND cl.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown client: %', p_client_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'client % is not in your organization', p_client_id;
  END IF;

  -- no double-booking: reject an overlap with another SCHEDULED session for
  -- the same client in the same org.
  IF EXISTS (
    SELECT 1 FROM lesson_sessions s
    WHERE s.client_id = p_client_id AND s.org_id = v_org
      AND s.status = 'SCHEDULED' AND s.deleted_at IS NULL
      AND s.starts_at < p_ends_at AND s.ends_at > p_starts_at
  ) THEN
    RAISE EXCEPTION 'this client already has a lesson scheduled that overlaps % – %',
      to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'), to_char(p_ends_at, 'HH12:MI AM');
  END IF;

  INSERT INTO lesson_sessions
      (org_id, client_id, engagement_id, request_id, starts_at, ends_at, location, notes, created_by)
    VALUES
      (v_org, p_client_id, p_engagement_id, p_request_id, p_starts_at, p_ends_at,
       NULLIF(trim(coalesce(p_location, '')), ''), NULLIF(trim(coalesce(p_notes, '')), ''), auth.uid())
    RETURNING id INTO v_id;

  -- a booked lesson closes the request-inbox loop: the request is converted.
  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'converted' WHERE id = p_request_id;
  END IF;

  -- tell the member, if they have an app account (clients.contact_id →
  -- profiles.contact_id); silently skipped otherwise.
  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_contact;
  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, v_user, 'lesson_scheduled',
              'Your lesson is booked — ' || to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'),
              '/app/schedule');
  END IF;

  RETURN jsonb_build_object(
    'session_id',    v_id,
    'client_id',     p_client_id,
    'starts_at',     p_starts_at,
    'ends_at',       p_ends_at,
    'status',        'SCHEDULED',
    'location',      NULLIF(trim(coalesce(p_location, '')), ''),
    'engagement_id', p_engagement_id,
    'request_id',    p_request_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text) IS
  'Staff book a confirmed lesson session for a client. Org stamped from the client row; overlapping SCHEDULED sessions rejected; a linked request flips to ''converted''; the member''s app user is notified (lesson_scheduled).';

-- ============================================================
-- 2b. complete_lesson_session — mark taught + debit the punch card
-- ============================================================
CREATE OR REPLACE FUNCTION complete_lesson_session(
  p_session_id   uuid,
  p_debit_credit boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_s         lesson_sessions%ROWTYPE;
  v_credit    uuid;
  v_remaining integer;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to complete lessons';
  END IF;

  SELECT * INTO v_s FROM lesson_sessions
    WHERE id = p_session_id AND deleted_at IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown lesson session: %', p_session_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_s.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'lesson session % is not in your organization', p_session_id;
  END IF;
  IF v_s.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'only a SCHEDULED lesson can be completed (this one is %)', v_s.status;
  END IF;

  UPDATE lesson_sessions SET status = 'COMPLETED' WHERE id = p_session_id;

  IF p_debit_credit THEN
    -- atomically decrement the OLDEST live credit row with balance: the inner
    -- SELECT ... FOR UPDATE locks the row, so two concurrent completes can
    -- never double-spend the same credit.
    UPDATE lesson_credits lc
       SET credits_remaining = lc.credits_remaining - 1
     WHERE lc.id = (
        SELECT id FROM lesson_credits
        WHERE client_id = v_s.client_id AND org_id = v_s.org_id
          AND deleted_at IS NULL AND credits_remaining > 0
        ORDER BY purchased_at, created_at
        LIMIT 1
        FOR UPDATE
      )
     RETURNING lc.id INTO v_credit;

    IF v_credit IS NOT NULL THEN
      UPDATE lesson_sessions SET credit_id = v_credit WHERE id = p_session_id;
    END IF;

    SELECT coalesce(sum(credits_remaining), 0)::int INTO v_remaining
      FROM lesson_credits
      WHERE client_id = v_s.client_id AND org_id = v_s.org_id AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'session_id',        p_session_id,
    'status',            'COMPLETED',
    'debited',           v_credit IS NOT NULL,
    'credit_id',         v_credit,
    'credits_remaining', v_remaining
  );
END;
$fn$;

REVOKE ALL ON FUNCTION complete_lesson_session(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION complete_lesson_session(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION complete_lesson_session(uuid, boolean) IS
  'Mark a SCHEDULED lesson COMPLETED and (by default) debit ONE credit from the client''s oldest lesson_credits row with balance (row-locked — no double-spend). Returns {status, debited, credit_id, credits_remaining}; a client with no credits still completes (debited:false).';

-- ============================================================
-- 2c. cancel_lesson_session — CANCELLED (member notified) or NO_SHOW
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_lesson_session(
  p_session_id uuid,
  p_no_show    boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_s      lesson_sessions%ROWTYPE;
  v_status text := CASE WHEN p_no_show THEN 'NO_SHOW' ELSE 'CANCELLED' END;
  v_user   uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to cancel lessons';
  END IF;

  SELECT * INTO v_s FROM lesson_sessions
    WHERE id = p_session_id AND deleted_at IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown lesson session: %', p_session_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_s.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'lesson session % is not in your organization', p_session_id;
  END IF;
  IF v_s.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'only a SCHEDULED lesson can be cancelled (this one is %)', v_s.status;
  END IF;

  UPDATE lesson_sessions SET status = v_status WHERE id = p_session_id;

  -- a cancellation is news the member needs; a no-show is a staff record.
  IF v_status = 'CANCELLED' THEN
    SELECT p.user_id INTO v_user
      FROM clients cl JOIN profiles p ON p.contact_id = cl.contact_id
      WHERE cl.id = v_s.client_id;
    IF v_user IS NOT NULL THEN
      INSERT INTO notifications (org_id, user_id, kind, title, link)
        VALUES (v_s.org_id, v_user, 'lesson_cancelled',
                'Your lesson on ' || to_char(v_s.starts_at, 'FMMonth FMDD, HH12:MI AM') || ' was cancelled',
                '/app/schedule');
    END IF;
  END IF;

  RETURN jsonb_build_object('session_id', p_session_id, 'status', v_status);
END;
$fn$;

REVOKE ALL ON FUNCTION cancel_lesson_session(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION cancel_lesson_session(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION cancel_lesson_session(uuid, boolean) IS
  'Flip a SCHEDULED lesson to CANCELLED (default — the member''s app user is notified, lesson_cancelled) or NO_SHOW (p_no_show => true, no notification). Staff-gated.';

-- ============================================================
-- 2d. my_lesson_sessions — the member's own sessions (upcoming first)
-- ============================================================
CREATE OR REPLACE FUNCTION my_lesson_sessions()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', s.status, 'location', s.location, 'notes', s.notes)
      ORDER BY s.ord), '[]'::jsonb)
  FROM (
    SELECT ls.*, row_number() OVER (
        ORDER BY (ls.starts_at >= now()) DESC,
                 CASE WHEN ls.starts_at >= now() THEN ls.starts_at END ASC,
                 CASE WHEN ls.starts_at <  now() THEN ls.starts_at END DESC
      ) AS ord
    FROM lesson_sessions ls
    WHERE ls.client_id = current_client_id()
      AND ls.deleted_at IS NULL
      AND has_module('mod.lessons')
    ORDER BY (ls.starts_at >= now()) DESC,
             CASE WHEN ls.starts_at >= now() THEN ls.starts_at END ASC,
             CASE WHEN ls.starts_at <  now() THEN ls.starts_at END DESC
    LIMIT 50
  ) s
$fn$;

REVOKE ALL ON FUNCTION my_lesson_sessions() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_lesson_sessions() TO authenticated;

COMMENT ON FUNCTION my_lesson_sessions() IS
  'The signed-in member''s own lesson sessions (jsonb array): upcoming soonest-first, then recent past, limit 50. Empty array for non-clients or a mod.lessons-OFF tenant.';

-- ============================================================
-- 3. provision_lesson_invitation v3 — purchase ALSO grants the credits
--    (v2 body from 20260703080000, unchanged except the lesson_credits grant;
--     same 8-param signature → CREATE OR REPLACE, no drop needed.)
-- ============================================================
CREATE OR REPLACE FUNCTION provision_lesson_invitation(
  p_email          text,
  p_first_name     text,
  p_last_name      text,
  p_tier_id        uuid,
  p_mark_paid      boolean DEFAULT false,
  p_payment_method text DEFAULT NULL,
  p_notes          text DEFAULT NULL,
  p_request_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_tier       offering_tiers%ROWTYPE;
  v_org        uuid;
  v_service    text;
  v_contact    uuid;
  v_client     uuid;
  v_eng        uuid;
  v_inv_id     uuid;
  v_token      text;
  v_lessons    integer;
  v_cadence    text;
  v_email      text := lower(trim(p_email));
BEGIN
  -- staff in an org session, or the service-role API — never anonymous
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;
  IF NULLIF(trim(coalesce(p_first_name,'')),'') IS NULL OR NULLIF(trim(coalesce(p_last_name,'')),'') IS NULL THEN
    RAISE EXCEPTION 'first and last name are required';
  END IF;

  -- the tier tells us the tenant AND the service — no current_org() dependence
  SELECT t.* INTO v_tier FROM offering_tiers t WHERE t.id = p_tier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown offering tier: %', p_tier_id;
  END IF;
  SELECT o.org_id, o.service_type INTO v_org, v_service
    FROM offerings o WHERE o.id = v_tier.offering_id;
  v_service := coalesce(v_service, 'RIDING_LESSON');

  -- lesson quantity / cadence snapshot from the tier shape
  v_lessons := CASE
    WHEN v_tier.label ~ '(\d+)-Lesson' THEN (regexp_match(v_tier.label, '(\d+)-Lesson'))[1]::int
    WHEN v_tier.price_unit = 'session' THEN 1
    ELSE NULL END;
  v_cadence := CASE
    WHEN v_tier.price_unit = 'month' AND v_tier.label ~ '^(\d+)x' THEN
      (regexp_match(v_tier.label, '^(\d+)x'))[1] || ' lesson' ||
      CASE WHEN (regexp_match(v_tier.label, '^(\d+)x'))[1]::int > 1 THEN 's' ELSE '' END || '/week'
    ELSE NULL END;

  -- contact: reuse by email (not bound to someone else's profile) or create
  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (v_org, trim(p_first_name), trim(p_last_name), v_email)
      RETURNING id INTO v_contact;
  ELSE
    -- heal placeholder names (contact heal: a nameless profile stands in with its
    -- email until a legal name arrives — the admin-entered name IS the legal name)
    UPDATE contacts SET
        first_name = CASE WHEN NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,''))
                          THEN trim(p_first_name) ELSE first_name END,
        last_name  = CASE WHEN NULLIF(trim(coalesce(last_name,'')),'')  IS NULL THEN trim(p_last_name)  ELSE last_name END
      WHERE id = v_contact;
  END IF;

  SELECT id INTO v_client FROM clients WHERE contact_id = v_contact AND deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'provisioned invitation')
      RETURNING id INTO v_client;
  END IF;

  INSERT INTO engagements (org_id, client_id, service_type, status, notes)
    VALUES (v_org, v_client, v_service, 'AWAITING_SIGNATURE',
            coalesce(p_notes, v_tier.label || ' (provisioned invitation)'))
    RETURNING id INTO v_eng;

  INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_eng, v_contact, 'CLIENT', true, 1);

  -- the money record: an INVOICE, PAID when the owner says they already paid
  INSERT INTO transactions (org_id, engagement_id, txn_type, amount, service_fee, status, payment_terms)
    VALUES (v_org, v_eng, 'INVOICE', v_tier.price_amount, v_tier.price_amount,
            CASE WHEN p_mark_paid THEN 'PAID' ELSE 'PENDING' END,
            CASE WHEN p_mark_paid THEN 'Paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 ELSE 'Due before first session' END);

  INSERT INTO client_purchases (org_id, engagement_id, tier_id, tier_label, amount,
                                lessons_included, cadence, paid, payment_method, notes)
    VALUES (v_org, v_eng, v_tier.id, v_tier.label, v_tier.price_amount,
            v_lessons, v_cadence, p_mark_paid, p_payment_method, p_notes);

  -- v3: the purchase lands on the punch-card ledger too — a tier that yields a
  -- lesson count grants the credits the Sessions flow will debit.
  IF v_lessons IS NOT NULL AND v_lessons > 0 THEN
    INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining)
      VALUES (v_org, v_client, v_tier.label, v_lessons, v_lessons);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  -- v2: the invitation carries the request linkage (FK rejects an unknown request)
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status)
    VALUES (v_org, p_request_id, v_email, v_token, now() + interval '14 days', 'sent')
    RETURNING id INTO v_inv_id;

  -- v2: an invitation sent from the Request Inbox flips its request to 'invited'
  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'invited' WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id,
    'token',         v_token,
    'engagement_id', v_eng,
    'contact_id',    v_contact,
    'tier_label',    v_tier.label,
    'amount',        v_tier.price_amount,
    'request_id',    p_request_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION provision_lesson_invitation(text, text, text, uuid, boolean, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION provision_lesson_invitation(text, text, text, uuid, boolean, text, text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION provision_lesson_invitation(text, text, text, uuid, boolean, text, text, uuid) IS
  'Staff/service-role provisioning in one call: contact + client + engagement + invoice + purchase snapshot + invitation. v2: optional trailing p_request_id stamps invitations.request_id and flips the source request to ''invited''. v3: a tier with a lesson count ALSO grants the lesson_credits punch-card row (package_key = tier label).';

-- ============================================================
-- 4. BACKFILL — credits for existing paid lesson purchases (idempotent).
--    Written as a plain re-runnable INSERT: the NOT EXISTS guard on
--    (client via engagement, package_key = tier_label,
--     credits_total = lessons_included) makes a re-run a no-op.
-- ============================================================
INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining, purchased_at)
SELECT cp.org_id, e.client_id, cp.tier_label, cp.lessons_included, cp.lessons_included, cp.created_at
FROM client_purchases cp
JOIN engagements e ON e.id = cp.engagement_id
WHERE cp.lessons_included IS NOT NULL
  AND cp.lessons_included > 0
  AND cp.paid
  AND e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lesson_credits lc
    WHERE lc.client_id = e.client_id
      AND lc.deleted_at IS NULL
      AND lc.package_key = cp.tier_label
      AND lc.credits_total = cp.lessons_included
  );
