-- OWNER, 2026-09-01: *"if we collect any information from a person it needs to be
-- visible somewhere, right? and specifically, if they are communicating something
-- like wanting to visit us, wouldnt we need to see that in a place we can take
-- action on it as quickly as possible?"*
--
-- ⚠️ HE IS RIGHT AND THIS IS THE OMISSION. `requests.interests` shipped an hour
-- earlier storing the checkboxes correctly and NOTHING RENDERED THEM — not the
-- bell, not the staff email, not the lead. That is D17 / `TASK-ROLE` §2a, the
-- failure this repo calls its dominant one, committed by the thread that had
-- quoted the rule the same afternoon.
--
-- This migration fixes the BELL. `api/request-received.ts` fixes the email; the
-- template row below carries its wording (D13).

-- ─── 1 · A LABEL FOR A CATEGORY, READABLE FROM SQL ───────────────────────────
-- The public labels have lived in TypeScript (`intakeCategoryFields.ts`) and in
-- `api/request-received.ts`. The notification is composed in the DATABASE and had
-- no way to say "Riding lessons" — so it gets the same map, once, here.
CREATE OR REPLACE FUNCTION public.request_category_label(p_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE p_category
    WHEN 'general'     THEN 'General question'
    WHEN 'lessons'     THEN 'Riding lessons'
    WHEN 'horse_care'  THEN 'Horse care'
    WHEN 'acquisition' THEN 'Leasing & purchasing'
    WHEN 'media'       THEN 'Media / press'
    WHEN 'partnership' THEN 'Partnership / sponsorship'
    WHEN 'gift'        THEN 'Gift enquiry'
    WHEN 'visit'       THEN 'Visit the ranch'
    ELSE coalesce(p_category, 'Uncategorised')
  END;
$function$;

REVOKE ALL ON FUNCTION public.request_category_label(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_category_label(text) TO anon;
GRANT EXECUTE ON FUNCTION public.request_category_label(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_category_label(text) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_public_request(p_first_name text, p_last_name text, p_email text, p_phone text DEFAULT NULL::text, p_contact_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_proposed_times jsonb DEFAULT '[]'::jsonb, p_category text DEFAULT NULL::text, p_channel text DEFAULT 'contact'::text, p_entry_location text DEFAULT NULL::text, p_intent text DEFAULT NULL::text, p_selections jsonb DEFAULT '[]'::jsonb, p_details jsonb DEFAULT '{}'::jsonb, p_interests text[] DEFAULT NULL::text[])
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

  -- ── CLOSEOUT §3.4 (LESSONREQUEST G2) — experience, same gate shape ────────
  -- Client-side-only enforcement is a request, not a rule. The same
  -- intake_requirements row the form reads decides here too, so switching the
  -- requirement off in config releases both ends together.
  IF v_has_lesson
     AND coalesce(p_channel, 'contact') = 'booking'
     AND EXISTS (SELECT 1 FROM intake_requirements ir
                  WHERE ir.org_id = v_org AND ir.channel = 'booking'
                    AND ir.field_key = 'experience' AND ir.required)
     AND nullif(btrim(coalesce(v_details->>'Riding experience (years)', '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'please tell us the rider''s experience before sending a lesson inquiry';
  END IF;

  INSERT INTO requests (
    org_id, status, contact_name, contact_first_name, contact_last_name,
    contact_email, contact_phone, contact_method, proposed_times, notes,
    category, channel, entry_location, intent, details, interests
  ) VALUES (
    v_org, 'new', v_first || ' ' || v_last, v_first, v_last,
    v_email, v_phone, p_contact_method, coalesce(p_proposed_times, '[]'::jsonb), v_notes,
    p_category, coalesce(p_channel, 'contact'), p_entry_location, p_intent, v_details,
    -- the checkboxes, de-duplicated and blank-stripped; NULL when none were ticked
    (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(p_interests, '{}')) x WHERE btrim(x) <> '')
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
  -- ⚠️ THE BELL HAS TO SAY WHAT IT IS. Owner, 2026-09-01: *"if they are
  -- communicating something like wanting to visit us, wouldnt we need to see that
  -- in a place we can take action on it as quickly as possible?"* A visit is a
  -- person planning to stand on the property, and it is time-bound in a way an
  -- ordinary enquiry is not — so it is named in the title rather than left for
  -- somebody to find by opening the row. The interests ride along for the same
  -- reason: they are the whole point of having asked.
  PERFORM notify_staff(
    v_org,
    CASE WHEN p_category = 'visit' OR 'visit' = ANY(coalesce(p_interests, '{}'))
         THEN 'request_visit' ELSE 'request_new' END,
    CASE WHEN p_category = 'visit' THEN 'VISIT REQUEST from '
         WHEN 'visit' = ANY(coalesce(p_interests, '{}')) THEN 'Wants to visit — '
         ELSE 'New inquiry from ' END
    || coalesce(nullif(btrim(v_first || ' ' || v_last), ''), v_email)
    || CASE
         WHEN p_category = 'visit' AND coalesce(array_length(p_interests, 1), 0) > 0
           THEN ' — interested in ' || array_to_string(
                  ARRAY(SELECT request_category_label(x) FROM unnest(p_interests) x
                         WHERE x <> 'visit'), ', ')
         ELSE ''
       END,
    '/app/ops/intake');

  RETURN jsonb_build_object(
    'request_id', v_id, 'status', 'new',
    'purchase_id', v_purchase, 'contact_id', v_contact);
END;
$function$

;

-- ⚠️ CREATE OR REPLACE, and the signature is UNCHANGED (14 args, as this migration
-- found it) — so there is no overload and no ACL reset. Verified after applying.

-- ─── 3 · AND THE STAFF EMAIL SAYS IT TOO ─────────────────────────────────────
UPDATE email_templates
   SET body = body || $add${{#if REQ.INTERESTS_HTML}}<p style="margin:6px 0"><strong>Interested in:</strong> {{REQ.INTERESTS_HTML}}</p>{{/if}}{{#if REQ.WANTS_VISIT}}<p style="margin:10px 0;padding:10px 12px;background:#f5f0e8;border-left:3px solid #ba9935"><strong>They would like to come and visit.</strong></p>{{/if}}$add$,
       version = version + 1,
       updated_at = now()
 WHERE email_key = 'REQUEST_RECEIVED'
   AND body NOT LIKE '%REQ.WANTS_VISIT%';
