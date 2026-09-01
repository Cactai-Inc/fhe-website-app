/*
  # Phase 5 — one unified intake, one requests row

  The three public forms (Contact, Inquire, Checkout/cart) collapse onto a
  single write path: submit_public_request → ONE requests row. To carry what the
  three used to split or drop, requests gains first-class fields:

    contact_first_name / contact_last_name — canonical split (contact_name is
      kept, composed from the two, so every existing reader keeps working). Last
      name is now REQUIRED on the write, which also kills the invite friction:
      the invite form/RPC needed a last name and had to guess it by splitting
      contact_name on the first space.
    category  — the service category (general/lessons/horse_care/acquisition/
      media/partnership) picked in the unified form's dropdown.
    channel   — which form it came from (contact/inquiry/booking/kiosk).
    entry_location — the page/context the visitor submitted from (preset).
    intent    — the hidden purchase-intent tag for analytics.

  Server-side validation lands here too: email + phone FORMAT and a message
  length cap, enforced both as CHECK constraints (data is empty, so they add
  clean) and inside the RPC (a friendly error instead of a constraint violation).

  Legacy intake_submissions is retired: its public write moves to requests, so
  the table + its policies are dropped (0 rows — clean).

  A. requests: new columns + validation CHECKs.
  B. submit_public_request rebuilt with the new params + validation.
  C. drop intake_submissions.
*/

-- ── A. requests gains the unified-intake fields ──────────────────────────────
ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_first_name text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_last_name  text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS category           text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS channel            text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS entry_location     text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS intent             text;

-- validation (empty table → add fully-validated, no NOT VALID dance)
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_email_format;
ALTER TABLE requests ADD  CONSTRAINT requests_email_format
  CHECK (contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_phone_format;
ALTER TABLE requests ADD  CONSTRAINT requests_phone_format
  CHECK (contact_phone IS NULL OR contact_phone ~ '^[-+().0-9[:space:]]{7,32}$');

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_notes_len;
ALTER TABLE requests ADD  CONSTRAINT requests_notes_len
  CHECK (notes IS NULL OR char_length(notes) <= 4000);

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_category_check;
ALTER TABLE requests ADD  CONSTRAINT requests_category_check
  CHECK (category IS NULL OR category IN
    ('general','lessons','horse_care','acquisition','media','partnership'));

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_channel_check;
ALTER TABLE requests ADD  CONSTRAINT requests_channel_check
  CHECK (channel IS NULL OR channel IN ('contact','inquiry','booking','kiosk'));

-- ── B. submit_public_request — unified, validated write ──────────────────────
-- the old signature is dropped so the new one is unambiguous.
DROP FUNCTION IF EXISTS submit_public_request(text, text, text, text, jsonb, text, jsonb);

CREATE OR REPLACE FUNCTION submit_public_request(
  p_first_name     text,
  p_last_name      text,
  p_email          text,
  p_phone          text DEFAULT NULL,
  p_contact_method text DEFAULT NULL,
  p_notes          text DEFAULT NULL,
  p_proposed_times jsonb DEFAULT '[]'::jsonb,
  p_category       text DEFAULT NULL,
  p_channel        text DEFAULT 'contact',
  p_entry_location text DEFAULT NULL,
  p_intent         text DEFAULT NULL,
  p_selections     jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org   uuid := coalesce(current_org(), current_addressed_org(), sole_org());
  v_first text := NULLIF(btrim(coalesce(p_first_name, '')), '');
  v_last  text := NULLIF(btrim(coalesce(p_last_name, '')), '');
  v_email text := lower(NULLIF(btrim(coalesce(p_email, '')), ''));
  v_phone text := NULLIF(btrim(coalesce(p_phone, '')), '');
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
  v_id    uuid;
  v_sel   jsonb;
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

  INSERT INTO requests (
    org_id, status, contact_name, contact_first_name, contact_last_name,
    contact_email, contact_phone, contact_method, proposed_times, notes,
    category, channel, entry_location, intent
  ) VALUES (
    v_org, 'new', v_first || ' ' || v_last, v_first, v_last,
    v_email, v_phone, p_contact_method, coalesce(p_proposed_times, '[]'::jsonb), v_notes,
    p_category, coalesce(p_channel, 'contact'), p_entry_location, p_intent
  )
  RETURNING id INTO v_id;

  -- cart selections (Checkout) — resolve each offering slug to its row in-tenant.
  FOR v_sel IN SELECT * FROM jsonb_array_elements(coalesce(p_selections, '[]'::jsonb))
  LOOP
    INSERT INTO request_selections (request_id, org_id, offering_id, offering_slug, label)
    SELECT v_id, v_org, o.id, (v_sel->>'offering_slug'), (v_sel->>'label')
      FROM offerings o
      WHERE o.slug = (v_sel->>'offering_slug') AND o.org_id = v_org
      LIMIT 1;
    -- a selection whose slug we can't resolve still records what was asked for.
    IF NOT FOUND THEN
      INSERT INTO request_selections (request_id, org_id, offering_slug, label)
        VALUES (v_id, v_org, (v_sel->>'offering_slug'), (v_sel->>'label'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('request_id', v_id, 'status', 'new');
END;
$fn$;

REVOKE ALL ON FUNCTION submit_public_request(text, text, text, text, text, text, jsonb, text, text, text, text, jsonb)
  FROM public;
GRANT EXECUTE ON FUNCTION submit_public_request(text, text, text, text, text, text, jsonb, text, text, text, text, jsonb)
  TO anon, authenticated, service_role;

-- ── C. retire intake_submissions (0 rows — clean drop) ───────────────────────
DROP POLICY IF EXISTS intake_submissions_public_insert ON intake_submissions;
DROP POLICY IF EXISTS intake_submissions_staff_all ON intake_submissions;
DROP POLICY IF EXISTS intake_submissions_org_boundary ON intake_submissions;
DROP TABLE IF EXISTS intake_submissions CASCADE;
