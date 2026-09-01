-- TASK-SIGNBOOK — the wizard ends in a booking REQUEST, not a payment.
-- CR-98 steps 6, 7, 8 and 10. Every object here CALLS an incumbent; none of them
-- is a second implementation of one (D18).
--
-- WHAT THIS ADDS
--   1. open_document_delivery_hold — widened so a person may hold delivery of
--      THEIR OWN documents. It was staff/service_role only, which is why the
--      wizard could not defer its own signing run.
--   2. hold_my_document_delivery() — the client-callable front door onto it.
--   3. deliver_executed_document_set(uuid,uuid,jsonb) — the same function with a
--      CONTEXT argument, so the one email the set produces can name the order
--      and the booking request that were made after the signatures.
--   4. submit_my_booking_request(...) — CR-98 step 7, "submit the booking
--      request", as ONE act.
--
-- ⚠️ WHAT IT DELIBERATELY DOES NOT ADD: a booking status. `requested` is
-- TASK-LIFECYCLE's to introduce (and `bookings_status_check` does not permit it
-- today). This writes through `request_open_time`, the ONE existing
-- client-request writer, and inherits whatever status that function writes — so
-- when LIFECYCLE renames it, this flow follows with no change here. See the
-- report.

-- ─── 1 · A PERSON MAY HOLD THEIR OWN DELIVERY ────────────────────────────────
-- Same body, one widened guard. Not CREATE OR REPLACE with a new argument: the
-- signature is unchanged, so no overload is possible.
CREATE OR REPLACE FUNCTION public.open_document_delivery_hold(
  p_org uuid, p_contact_id uuid, p_email text, p_source text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  -- ⚠️ THE THIRD ARM IS THE NEW ONE. A signed-in person may declare a run over
  -- their OWN contact and nobody else's — which is all the onboarding wizard
  -- ever wants, and is strictly narrower than the staff arm above it.
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR has_staff_access()
          OR (p_contact_id IS NOT NULL AND p_contact_id = current_contact_id())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_contact_id IS NULL AND coalesce(btrim(p_email), '') = '' THEN
    RAISE EXCEPTION 'a contact or an email is required';
  END IF;

  -- one open hold per subject; re-declaring an in-flight run is a no-op
  SELECT h.id INTO v_id FROM document_delivery_holds h
   WHERE h.released_at IS NULL
     AND h.opened_at > now() - interval '6 hours'
     AND ((p_contact_id IS NOT NULL AND h.contact_id = p_contact_id)
       OR (p_email IS NOT NULL AND lower(h.email) = lower(btrim(p_email))))
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO document_delivery_holds (org_id, contact_id, email, source)
    VALUES (p_org, p_contact_id, nullif(lower(btrim(p_email)), ''), p_source)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ─── 2 · THE CLIENT-CALLABLE FRONT DOOR ──────────────────────────────────────
-- CR-98 step 8 is ONE email carrying the documents AND the order AND the
-- booking request. Steps 5–7 all happen after the last signature, so without a
-- hold the document email leaves before the order exists and the owner's single
-- email is two. The 30-minute backstop that already runs hourly
-- (flush_held_executed_document_emails, /api/delivery-sweep) is what makes an
-- abandoned run safe: nothing can be held forever.
CREATE OR REPLACE FUNCTION public.hold_my_document_delivery()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_contact uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_contact IS NULL THEN RETURN NULL; END IF;  -- nothing to hold; never an error
  RETURN open_document_delivery_hold(current_org(), v_contact, NULL, 'onboarding');
END;
$function$;

REVOKE ALL ON FUNCTION public.hold_my_document_delivery() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hold_my_document_delivery() FROM anon;
GRANT EXECUTE ON FUNCTION public.hold_my_document_delivery() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hold_my_document_delivery() TO service_role;

-- ─── 3 · THE SET EMAIL LEARNS WHAT ELSE TO SAY ───────────────────────────────
-- ⚠️ DROP FIRST, DELIBERATELY. CREATE OR REPLACE with a new defaulted argument
-- OVERLOADS rather than replaces, and every existing caller (the execution
-- trigger, the hold flush, the sweep, staff) would keep resolving to the old
-- body. Dropping the two-argument signature means there is exactly one.
-- ⚠️ AND A DROP RESETS THE ACL — the grants below restore precisely what
-- pg_proc.proacl carried before this migration: postgres, authenticated,
-- service_role. No anon, and `REVOKE ... FROM PUBLIC` alone would not have been
-- enough (fhe-revoke-from-public-is-not-enough).
DROP FUNCTION IF EXISTS public.deliver_executed_document_set(uuid, uuid);

CREATE FUNCTION public.deliver_executed_document_set(
  p_contact_id uuid, p_include uuid DEFAULT NULL::uuid, p_context jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids  uuid[];
  v_org  uuid;
  v_base text;
  v_req  bigint;
BEGIN
  -- Callers are the execution trigger, the sweep (service_role) and staff.
  -- ⚠️ SIGNBOOK ADDS THE FOURTH ARM: a person may flush THEIR OWN executed set
  -- to THEMSELVES. It is what CR-98 step 8 needs — the run held since the sign
  -- step is released by the person finishing the wizard — and it grants nothing
  -- a staff caller did not already have, because the argument IS the subject:
  -- p_contact_id = current_contact_id() cannot name anybody else's documents.
  IF NOT (pg_trigger_depth() > 0
          OR coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access(), false)
          OR (p_contact_id IS NOT NULL AND p_contact_id = current_contact_id())
          OR auth.uid() IS NULL AND auth.role() IS NULL) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'no contact');
  END IF;

  WITH deliverable AS (
    SELECT d.id, d.contract_id, d.contact_id, d.generated_at, d.created_at
      FROM documents d
     WHERE d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND d.executed_email_sent_at IS NULL
       AND (d.delivery_held_at IS NOT NULL OR d.id = p_include)
       AND NOT EXISTS (
         SELECT 1 FROM signatures s
          WHERE s.document_id = d.id AND s.deleted_at IS NULL AND s.signed_at IS NULL)
  ), anchored AS (
    SELECT * FROM deliverable WHERE contact_id = p_contact_id
  )
  SELECT array_agg(x.id ORDER BY x.generated_at, x.created_at)
    INTO v_ids
    FROM (
      SELECT * FROM anchored
      UNION
      -- DEALAUTO §3: the rest of the same contract's undelivered set
      SELECT dl.* FROM deliverable dl
       WHERE dl.contract_id IS NOT NULL
         AND dl.contract_id IN (SELECT a.contract_id FROM anchored a WHERE a.contract_id IS NOT NULL)
    ) x;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'nothing to deliver');
  END IF;

  SELECT d.org_id INTO v_org FROM documents d WHERE d.id = v_ids[1];

  SELECT value_text INTO v_base FROM config_values
   WHERE org_id = v_org AND namespace = 'SYSTEM' AND key = 'APP_BASE_URL';
  IF coalesce(btrim(v_base), '') = '' THEN
    UPDATE documents SET executed_email_error = 'APP_BASE_URL not configured'
     WHERE id = ANY(v_ids);
    RETURN jsonb_build_object('sent', false, 'reason', 'no base url',
                              'documents', array_length(v_ids, 1));
  END IF;

  -- SIGNBOOK: `context` is the ONLY new line. It names the order and the booking
  -- request the person made AFTER signing, so /api/deliver-documents can put
  -- them in the body of the one email it already sends. Absent (every existing
  -- caller passes nothing) the key is simply not there and the email is
  -- byte-identical to today's.
  SELECT net.http_post(
           url     := v_base || '/api/deliver-documents',
           body    := jsonb_build_object(
                        'documentIds',
                        (SELECT jsonb_agg(x::text) FROM unnest(v_ids) x))
                      || CASE WHEN p_context IS NULL THEN '{}'::jsonb
                              ELSE jsonb_build_object('context', p_context) END,
           headers := '{"Content-Type": "application/json"}'::jsonb,
           timeout_milliseconds := 15000
         ) INTO v_req;

  UPDATE documents
     SET executed_email_sent_at = now(),
         executed_email_error   = NULL,
         delivery_held_at       = NULL
   WHERE id = ANY(v_ids);

  UPDATE document_delivery_holds SET released_at = now()
   WHERE released_at IS NULL AND contact_id = p_contact_id;
  UPDATE document_delivery_holds h SET released_at = now()
   WHERE h.released_at IS NULL
     AND h.email IS NOT NULL
     AND lower(h.email) = (SELECT lower(c.email) FROM contacts c WHERE c.id = p_contact_id);

  RETURN jsonb_build_object(
    'sent', true, 'request_id', v_req, 'documents', array_length(v_ids, 1));
END;
$function$;

REVOKE ALL ON FUNCTION public.deliver_executed_document_set(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deliver_executed_document_set(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.deliver_executed_document_set(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_executed_document_set(uuid, uuid, jsonb) TO service_role;

-- ─── 4 · CR-98 STEP 7 — "SUBMIT THE BOOKING REQUEST", AS ONE ACT ─────────────
-- ⚠️ READ THIS BEFORE CHANGING IT. Four records are touched and every one of
-- them already existed for exactly this purpose:
--
--   bookings              — written by request_open_time, NOT by this function.
--                           There is one client-request booking writer and it
--                           is that one (D18). This links the order to it.
--   booking_change_requests(kind='new')
--                         — request_open_time already opens the staff decision
--                           row. REVIEWQ R2's queue reads it. Untouched here.
--   requests(channel='booking')
--                         — the INBOUND ALERT SPINE's row. `booking` has been a
--                           legal channel since the table was made and
--                           /api/request-received already labels it "Booking
--                           request". Creating it is what makes CR-98 step 10's
--                           EMAIL happen with no endpoint change at all: the
--                           alert reads the order through purchases.request_id
--                           and the chosen time through proposed_times.
--   purchases.request_id  — the existing link inquiry_email_payload joins on.
--
-- ⚠️ AND IT MINTS NOTHING (Trap 3, CREDITFIX ×3). The order stays `draft`;
-- _mint_credits_for_purchase_item returns 0 on a draft and the two mint triggers
-- are AFTER UPDATE OF status, which this never performs.
CREATE OR REPLACE FUNCTION public.submit_my_booking_request(
  p_purchase_id  uuid,
  p_starts_at    timestamptz,
  p_ends_at      timestamptz,
  p_note         text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_contact  uuid := current_contact_id();
  v_org      uuid := current_org();
  v_pu       purchases%ROWTYPE;
  v_offering uuid;
  v_booking  uuid;
  v_request  uuid;
  v_name     text;
  v_email    text;
  v_phone    text;
  v_when     text;
  v_result   jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO v_pu FROM purchases
   WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'that order does not exist'; END IF;
  -- The caller's own order and nobody else's. Both buyer keys, because
  -- create_my_purchase stamps both and either one may be the durable identity.
  IF NOT (v_pu.buyer_user_id = v_uid
          OR (v_contact IS NOT NULL AND v_pu.buyer_contact_id = v_contact)) THEN
    RAISE EXCEPTION 'that order is not yours';
  END IF;
  -- ⚠️ A REQUEST IS MADE ON A DRAFT. An order that staff have already opened is
  -- past this step, and re-submitting it would raise a second request for work
  -- already in hand.
  IF coalesce(v_pu.status, '') <> 'draft' THEN
    RAISE EXCEPTION 'that order has already been submitted';
  END IF;
  IF EXISTS (SELECT 1 FROM bookings b
              WHERE b.purchase_id = p_purchase_id AND b.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'a time has already been requested for that order';
  END IF;

  -- What they are asking for: the first line of their own order.
  SELECT pi.offering_id INTO v_offering
    FROM purchase_items pi
   WHERE pi.purchase_id = p_purchase_id AND pi.voided_at IS NULL
   ORDER BY pi.created_at LIMIT 1;

  -- ── the booking. THE INCUMBENT WRITER, called, not copied. It validates the
  --    times, refuses a past one, opens the staff decision row and raises the
  --    in-app staff notification — CR-98 step 10's "notification".
  v_result  := request_open_time(p_starts_at, p_ends_at, v_offering, NULL, p_note);
  v_booking := (v_result->>'booking_id')::uuid;

  -- ── the alert row. Read back from the record, never from the browser.
  SELECT nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
         c.email, c.phone
    INTO v_name, v_email, v_phone
    FROM contacts c WHERE c.id = v_contact;

  IF v_email IS NOT NULL AND v_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    v_when := to_char(p_starts_at, 'FMDay, FMMon FMDD YYYY') || ' at '
              || to_char(p_starts_at, 'FMHH12:MI AM');
    INSERT INTO requests (
      org_id, contact_id, contact_name, contact_first_name, contact_last_name,
      contact_email, contact_phone, channel, category, entry_location,
      subject, notes, proposed_times, status)
    SELECT v_org, v_contact, coalesce(v_name, v_email),
           c.first_name, c.last_name, v_email,
           CASE WHEN c.phone ~ '^[-+().0-9[:space:]]{7,32}$' THEN c.phone END,
           'booking',
           CASE WHEN o.segment = 'horse' THEN 'horse_care' ELSE 'lessons' END,
           'onboarding',
           'Booking request — ' || coalesce(o.name, 'a session'),
           nullif(btrim(coalesce(p_note, '')), ''),
           jsonb_build_array(jsonb_build_object('label', v_when)),
           'new'
      FROM contacts c
      LEFT JOIN offerings o ON o.id = v_offering
     WHERE c.id = v_contact
    RETURNING id INTO v_request;
  END IF;

  -- ── the links. purchases.request_id is what inquiry_email_payload joins on to
  --    put THE ORDER in the staff alert; bookings.request_id/purchase_id are
  --    what let staff read the order and the time as one thing.
  UPDATE bookings
     SET purchase_id = p_purchase_id,
         request_id  = v_request
   WHERE id = v_booking;
  IF v_request IS NOT NULL THEN
    UPDATE purchases SET request_id = v_request WHERE id = p_purchase_id;
    INSERT INTO request_selections (request_id, org_id, offering_id, label, origin)
    SELECT v_request, v_org, pi.offering_id, pi.label, 'onboarding'
      FROM purchase_items pi
     WHERE pi.purchase_id = p_purchase_id AND pi.voided_at IS NULL;
  END IF;

  -- ── CR-98 step 8. Release the run held since the sign step and send the ONE
  --    email: every signed document attached, the order and this request in the
  --    body. Best-effort by design — a mail path must never cost the person the
  --    request they just made, and the hourly flush is the backstop.
  BEGIN
    PERFORM deliver_executed_document_set(
      v_contact, NULL,
      jsonb_build_object('purchaseId', p_purchase_id, 'bookingId', v_booking));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'signed-document set not delivered for %: %', v_contact, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'booking_id', v_booking,
    'request_id', v_request,
    'purchase_id', p_purchase_id,
    'status', v_result->>'status');
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_my_booking_request(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_my_booking_request(uuid, timestamptz, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_my_booking_request(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_booking_request(uuid, timestamptz, timestamptz, text) TO service_role;

-- ─── 5 · THE ONE EMAIL SAYS WHAT ELSE HAPPENED (D13 — it is a template) ──────
-- Two optional blocks appended to the party copy. Both are {{#if}}-guarded on
-- variables /api/deliver-documents only sets when a context arrived, so every
-- other delivery renders exactly today's email. The owner can re-word all of it
-- from the template editor without a deploy.
UPDATE email_templates
   SET body = body || $add${{#if ORDER.LINES}}<h3 style="font-size:15px;margin:20px 0 6px">Your order</h3><ul style="padding-left:18px">{{#each ORDER.LINES}}<li>{{.LABEL}} — {{.PRICE}}</li>{{/each}}</ul>{{#if ORDER.TOTAL}}<p style="margin:6px 0"><strong>Total:</strong> {{ORDER.TOTAL}}</p>{{/if}}<p style="margin:6px 0;color:#666;font-size:13px">Nothing has been charged — we confirm your request first.</p>{{/if}}{{#if BOOKING.WHEN}}<h3 style="font-size:15px;margin:20px 0 6px">Your booking request</h3><p style="margin:6px 0">You asked for <strong>{{BOOKING.WHEN}}</strong>. We will be in touch to confirm it.</p>{{/if}}$add$,
       version = version + 1,
       updated_at = now()
 WHERE email_key = 'DOCUMENT_SET_PARTY_COPY'
   AND body NOT LIKE '%BOOKING.WHEN%';
