/*
  # C1 — the public intake form captures distinct fields per category

  The category dropdown already shape-shifts the message prompt; now it also
  captures category-specific fields (rider age + experience for lessons, horse
  count + care type for horse-care, budget + timeline for acquisition, etc.).
  Those answers land in a new requests.details jsonb, so staff see exactly what
  was asked per category. No new required-field rules — the per-channel
  intake_requirements config still owns "required".

  A. requests.details jsonb
  B. submit_public_request gains a trailing p_details jsonb param (the old
     12-arg signature is dropped so PostgREST resolves the one overload).
*/

ALTER TABLE requests ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP FUNCTION IF EXISTS submit_public_request(
  text, text, text, text, text, text, jsonb, text, text, text, text, jsonb);

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
  p_selections     jsonb DEFAULT '[]'::jsonb,
  p_details        jsonb DEFAULT '{}'::jsonb
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
  v_details jsonb := CASE WHEN jsonb_typeof(p_details) = 'object' THEN p_details ELSE '{}'::jsonb END;
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
    category, channel, entry_location, intent, details
  ) VALUES (
    v_org, 'new', v_first || ' ' || v_last, v_first, v_last,
    v_email, v_phone, p_contact_method, coalesce(p_proposed_times, '[]'::jsonb), v_notes,
    p_category, coalesce(p_channel, 'contact'), p_entry_location, p_intent, v_details
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
    IF NOT FOUND THEN
      INSERT INTO request_selections (request_id, org_id, offering_slug, label)
        VALUES (v_id, v_org, (v_sel->>'offering_slug'), (v_sel->>'label'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('request_id', v_id, 'status', 'new');
END;
$fn$;
REVOKE ALL ON FUNCTION submit_public_request(text, text, text, text, text, text, jsonb, text, text, text, text, jsonb, jsonb)
  FROM public;
GRANT EXECUTE ON FUNCTION submit_public_request(text, text, text, text, text, text, jsonb, text, text, text, text, jsonb, jsonb)
  TO anon, authenticated, service_role;
