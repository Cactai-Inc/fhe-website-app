/*
  # FHE CRM — Request Inbox (BOOKING_FLOWS_PLAN §2 Flow A step 2)

  The staff rails for public booking requests: the `requests` table (written by
  the public "Submit a Booking Request" form — anon INSERT, untouched here)
  gains the working-state the Request Inbox needs. ADDITIVE ONLY: live prod
  rows are never dropped or rewritten.

  1. requests.staff_notes jsonb NOT NULL DEFAULT '[]' — the call-notes
     timeline. Array of {at: timestamptz-ish string, by_name: text, note: text}
     entries appended by append_request_note (never edited in place).
     requests.checklist jsonb — the per-service fit checklist state; NULL until
     staff start it. Flat object of checklist-item key → boolean, stored whole
     by set_request_checklist (the item list lives in the UI; the column just
     persists the ticks).

  2. Staff access: the inbox is worked by staff, not only admins. New
     PERMISSIVE read/update policies gated on has_staff_access() sit alongside
     the existing is_admin() policies (admins pass has_staff_access() too — the
     old policies stay for backwards safety). The public INSERT policy
     (requests_anon_insert) and the Class-B org boundary (20260630030000) are
     untouched.

  3. append_request_note(p_request_id, p_note) — staff-gated SECURITY DEFINER.
     Appends {at: now(), by_name: caller profile first name, note} and returns
     the updated timeline.

  4. set_request_checklist(p_request_id, p_checklist) — staff-gated. Stores the
     checklist object as-is (object shape enforced).

  5. provision_lesson_invitation v2 — adds OPTIONAL p_request_id uuid DEFAULT
     NULL as the LAST parameter. A defaulted parameter is a SIGNATURE CHANGE in
     Postgres, so the 7-arg version is explicitly DROPPED first and ONE 8-param
     function is created (a second overload would make PostgREST's named-arg
     dispatch ambiguous; the single defaulted function keeps every existing
     7-arg callsite — positional or named — working). When p_request_id is
     present: the invitations row is stamped with request_id and the request
     flips to status 'invited' — the Flow A request → invitation linkage.
*/

-- ============================================================
-- 1. requests — staff working state (additive columns)
-- ============================================================
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS staff_notes jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist   jsonb;

-- ============================================================
-- 2. staff read/update (PERMISSIVE, inside the Class-B org boundary)
-- ============================================================
DROP POLICY IF EXISTS requests_staff_read ON requests;
CREATE POLICY requests_staff_read ON requests
  FOR SELECT TO authenticated USING (has_staff_access());

DROP POLICY IF EXISTS requests_staff_update ON requests;
CREATE POLICY requests_staff_update ON requests
  FOR UPDATE TO authenticated
  USING (has_staff_access()) WITH CHECK (has_staff_access());

-- the inbox shows what was requested — selections ride along with the request
DROP POLICY IF EXISTS request_selections_staff_read ON request_selections;
CREATE POLICY request_selections_staff_read ON request_selections
  FOR SELECT TO authenticated USING (has_staff_access());

-- ============================================================
-- 3. append_request_note — the staff call-notes timeline
-- ============================================================
CREATE OR REPLACE FUNCTION append_request_note(p_request_id uuid, p_note text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_by  text;
  v_out jsonb;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'not authorized to log request notes';
  END IF;
  IF NULLIF(trim(coalesce(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'note text is required';
  END IF;

  -- by_name: the caller's profile first name (email stands in for a nameless
  -- profile; 'Staff' is the last-resort label — never NULL in the timeline).
  SELECT coalesce(NULLIF(trim(p.first_name), ''), p.email, 'Staff') INTO v_by
    FROM profiles p WHERE p.user_id = auth.uid();
  v_by := coalesce(v_by, 'Staff');

  UPDATE requests
     SET staff_notes = staff_notes || jsonb_build_object(
           'at', now(), 'by_name', v_by, 'note', trim(p_note))
   WHERE id = p_request_id
   RETURNING staff_notes INTO v_out;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown request: %', p_request_id;
  END IF;

  RETURN v_out;
END;
$fn$;

REVOKE ALL ON FUNCTION append_request_note(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION append_request_note(uuid, text) TO authenticated;

COMMENT ON FUNCTION append_request_note(uuid, text) IS
  'Append a staff call note {at, by_name, note} to requests.staff_notes. Staff-gated (has_staff_access()); returns the updated timeline.';

-- ============================================================
-- 4. set_request_checklist — the fit-checklist state
-- ============================================================
CREATE OR REPLACE FUNCTION set_request_checklist(p_request_id uuid, p_checklist jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_out jsonb;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'not authorized to update the request checklist';
  END IF;
  IF p_checklist IS NULL OR jsonb_typeof(p_checklist) <> 'object' THEN
    RAISE EXCEPTION 'checklist must be a JSON object of item key -> boolean';
  END IF;

  UPDATE requests SET checklist = p_checklist WHERE id = p_request_id
    RETURNING checklist INTO v_out;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown request: %', p_request_id;
  END IF;

  RETURN v_out;
END;
$fn$;

REVOKE ALL ON FUNCTION set_request_checklist(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION set_request_checklist(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION set_request_checklist(uuid, jsonb) IS
  'Store the lesson-fit checklist state (flat object of item key -> boolean) on a request. Staff-gated (has_staff_access()).';

-- ============================================================
-- 5. provision_lesson_invitation v2 — optional request linkage
--    (signature change: the 7-arg version must be dropped explicitly;
--     ONE function with a defaulted trailing parameter — no overload.)
-- ============================================================
DROP FUNCTION IF EXISTS provision_lesson_invitation(text, text, text, uuid, boolean, text, text);

CREATE FUNCTION provision_lesson_invitation(
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
  'Staff/service-role provisioning in one call: contact + client + engagement + invoice + purchase snapshot + invitation. v2: optional trailing p_request_id stamps invitations.request_id and flips the source request to ''invited'' (Request Inbox linkage); 7-arg callsites keep working via the default.';
