-- TASK-LESSONREQUEST §L1/§L2 — a lesson inquiry cannot be sent without step 2.
--
-- The fields already existed (ASKRIGHT/CAREPATH put them on the one InquiryForm).
-- What did not exist was any obligation to fill them: `intake_requirements`
-- shipped with `availability` and `experience` set to NOT required, so a
-- signed-out lesson buyer could submit an inquiry that told staff nothing about
-- when they can ride — which is the one fact the phone call is FOR.
--
-- Two halves, deliberately different in kind:
--
--   1. DATA — the two flags flip to required. They stay owner-editable in
--      Ops → Intake → "Booking form — required fields" (D13). Both are gated
--      client-side on `showLessonFields`, so a horse-care buyer is untouched by
--      either: this is a lesson-path obligation expressed through a
--      channel-wide flag, not a new obligation on every booking submission.
--
--   2. CODE — the availability half is ALSO enforced server-side, here. A
--      client-side gate is what the visitor sees; it is not what the record
--      guarantees. `requests.proposed_times` is a real column, so the RPC can
--      check it and the guarantee becomes provable rather than renderable.
--
-- ⚠️ RIDING EXPERIENCE IS NOT ENFORCED SERVER-SIDE, and that is deliberate: it
-- travels as prose inside `requests.notes` ("Riding experience: 1–2 years"), and
-- a gate built on a regex over free text is a gate that fails open the first
-- time the wording changes. It IS now also written into `requests.details` by
-- the form (see src/components/InquiryForm.tsx), and once every live row carries
-- it there, this guard can be widened to it honestly. Named rather than faked.
--
-- The lesson test is `offerings.segment = 'rider'` — the catalog's own field.
-- The frontend's LESSON_SERVICE_TYPES set is exactly the three rider service
-- types today; keying on the segment means a NEW lesson SKU under a new service
-- type is covered on the day it is created, without a code change.

-- ── 1. the two flags ────────────────────────────────────────────────────────
UPDATE intake_requirements
   SET required = true, updated_at = now()
 WHERE channel = 'booking'
   AND field_key IN ('availability', 'experience')
   AND required = false;

-- ── 2. the server-side gate, inside the one submission writer ───────────────
CREATE OR REPLACE FUNCTION public.submit_public_request(p_first_name text, p_last_name text, p_email text, p_phone text DEFAULT NULL::text, p_contact_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_proposed_times jsonb DEFAULT '[]'::jsonb, p_category text DEFAULT NULL::text, p_channel text DEFAULT 'contact'::text, p_entry_location text DEFAULT NULL::text, p_intent text DEFAULT NULL::text, p_selections jsonb DEFAULT '[]'::jsonb, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid := coalesce(current_org(), current_addressed_org(), sole_org());
  v_first text := NULLIF(btrim(coalesce(p_first_name, '')), '');
  v_last  text := NULLIF(btrim(coalesce(p_last_name, '')), '');
  v_email text := lower(NULLIF(btrim(coalesce(p_email, '')), ''));
  v_phone text := NULLIF(btrim(coalesce(p_phone, '')), '');
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
  v_details jsonb := CASE WHEN jsonb_typeof(p_details) = 'object' THEN p_details ELSE '{}'::jsonb END;
  v_id    uuid;
  v_sel   jsonb;
  v_contact  uuid;
  v_purchase uuid;
  v_lines    integer := 0;
  v_has_lesson boolean := false;   -- LESSONREQUEST §L1
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'could not resolve an organization for this request';
  END IF;
  IF v_first IS NULL THEN RAISE EXCEPTION 'first name is required'; END IF;
  IF v_last  IS NULL THEN RAISE EXCEPTION 'last name is required'; END IF;
  IF v_email IS NULL THEN RAISE EXCEPTION 'email is required'; END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'that email address does not look valid';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[-+().0-9[:space:]]{7,32}$' THEN
    RAISE EXCEPTION 'that phone number does not look valid';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 4000 THEN
    RAISE EXCEPTION 'your message is too long (max 4000 characters)';
  END IF;
  IF p_contact_method IS NOT NULL AND p_contact_method NOT IN ('text','call','email') THEN
    RAISE EXCEPTION 'invalid contact method';
  END IF;

  -- ── LESSONREQUEST §L1 — STEP 2 IS NOT OPTIONAL ON THE LESSON PATH ────────
  -- Checked BEFORE anything is written: a rejected inquiry must leave no row,
  -- no lead and no order behind. The selections have not been resolved yet, so
  -- the lesson test runs against the payload the caller sent, matching an
  -- offering by id OR slug exactly as the resolution loop below does.
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(coalesce(p_selections, '[]'::jsonb)) s
      JOIN offerings o
        ON o.org_id = v_org
       AND (o.id = nullif(s->>'offering_id', '')::uuid
            OR o.slug = nullif(s->>'offering_slug', ''))
     WHERE o.segment = 'rider'
  ) INTO v_has_lesson;

  IF v_has_lesson
     AND coalesce(p_channel, 'contact') = 'booking'
     AND EXISTS (SELECT 1 FROM intake_requirements ir
                  WHERE ir.org_id = v_org AND ir.channel = 'booking'
                    AND ir.field_key = 'availability' AND ir.required)
     AND jsonb_array_length(coalesce(p_proposed_times, '[]'::jsonb)) = 0
  THEN
    RAISE EXCEPTION 'please tell us when you are available before sending a lesson inquiry';
  END IF;

  INSERT INTO requests (
    org_id, status, contact_name, contact_first_name, contact_last_name,
    contact_email, contact_phone, contact_method, proposed_times, notes,
    category, channel, entry_location, intent, details
  ) VALUES (
    v_org, 'new', v_first || ' ' || v_last, v_first, v_last,
    v_email, v_phone, p_contact_method, coalesce(p_proposed_times, '[]'::jsonb), v_notes,
    p_category, coalesce(p_channel, 'contact'), p_entry_location, p_intent, v_details
  )
  RETURNING id INTO v_id;

  -- cart selections (Checkout) — resolve each offering to its row in-tenant.
  --
  -- ⚠️ ASKRIGHT F3, FIXED HERE. This loop matched on `o.slug` alone while the
  -- checkout sent the offering UUID in the slug key, so it never matched, fell
  -- into the IF NOT FOUND branch, and wrote a row with a UUID in the slug
  -- column and a NULL offering_id — every one of the 7 production selections
  -- looks like that. An inquiry's offerings were linked to the catalog by label
  -- TEXT only. §C5's order needs the real id, so both keys are now accepted and
  -- offering_id is the truth.
  FOR v_sel IN SELECT * FROM jsonb_array_elements(coalesce(p_selections, '[]'::jsonb))
  LOOP
    INSERT INTO request_selections (request_id, org_id, offering_id, offering_slug, label)
    SELECT v_id, v_org, o.id, o.slug, (v_sel->>'label')
      FROM offerings o
      WHERE o.org_id = v_org
        AND (o.id = nullif(v_sel->>'offering_id', '')::uuid
             OR o.slug = nullif(v_sel->>'offering_slug', ''))
      LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO request_selections (request_id, org_id, offering_slug, label)
        VALUES (v_id, v_org, (v_sel->>'offering_slug'), (v_sel->>'label'));
    END IF;
  END LOOP;

  -- The `requests_capture_contact` AFTER INSERT trigger has already run by now:
  -- it deduped or created the LEAD contact and stamped requests.contact_id.
  -- THAT contact is the lead (owner taxonomy: identity + intent, no account),
  -- and it is who the order belongs to.
  SELECT r.contact_id INTO v_contact FROM requests r WHERE r.id = v_id;

  -- ── §C5b — THE ORDER ─────────────────────────────────────────────────────
  -- Opened only when at least one selection resolved to a real catalog row. A
  -- /contact-form message carries no selections and must not manufacture an
  -- empty order; "everything is an order" is about what people BUY.
  SELECT count(*) INTO v_lines
    FROM request_selections rs WHERE rs.request_id = v_id AND rs.offering_id IS NOT NULL;

  IF v_lines > 0 THEN
    -- draft + unpaid. NOTHING IS OWED (rule 4): no payment surface, receipt,
    -- reminder or balance may treat this as payable until the one act in §C8
    -- confirms it. `buyer_user_id` stays NULL — there is no account yet, which
    -- is precisely what "lead" means.
    INSERT INTO purchases (org_id, request_id, buyer_contact_id, status, amount, payment_status)
    SELECT v_org, v_id, v_contact, 'draft',
           coalesce(sum(o.price_amount), 0), 'unpaid'
      FROM request_selections rs
      JOIN offerings o ON o.id = rs.offering_id
     WHERE rs.request_id = v_id
    RETURNING id INTO v_purchase;

    INSERT INTO purchase_items (purchase_id, org_id, offering_id, label, price_amount, price_unit)
    SELECT v_purchase, v_org, o.id, coalesce(rs.label, o.name), coalesce(o.price_amount, 0),
           -- 'lesson' is a UI-only unit; the check constraint knows 'session'.
           CASE WHEN o.price_unit = 'lesson' THEN 'session' ELSE o.price_unit END
      FROM request_selections rs
      JOIN offerings o ON o.id = rs.offering_id
     WHERE rs.request_id = v_id;

    -- The ops-board distinction, without a new purchases.status value: this
    -- order came from a visitor and is waiting on a call, and a staff-made
    -- draft (current_status NULL) is a different thing.
    PERFORM log_status_event('order', v_purchase, 'enquiry',
      'Opened by a website inquiry — nothing is owed until it is confirmed', v_org);
  END IF;

  -- alert the barn: in-app to every staff/owner (mirrored to co-admins by the
  -- notifications trigger). Email is sent separately by the /api/request-received
  -- and /api/inquiry-confirmation endpoints the public form calls after this returns.
  PERFORM notify_staff(
    v_org, 'request_new',
    'New inquiry from ' || coalesce(nullif(btrim(v_first || ' ' || v_last), ''), v_email),
    '/app/ops/intake');

  RETURN jsonb_build_object(
    'request_id', v_id, 'status', 'new',
    'purchase_id', v_purchase, 'contact_id', v_contact);
END;
$function$;
