/*
  # FHE CRM — Public booking-request anon insert fix (SECURITY DEFINER RPC)

  Production bug 2026-07-04: the public "Submit a Booking Request" / shop inquiry
  form failed with "new row violates row-level security policy for table
  requests" for anonymous visitors, so no lead could reach the Request Inbox.

  Root cause (fully diagnosed against prod):
  - `requests.org_id` DEFAULT was `current_org()`, NULL for an anon browser (the
    client never sets app.addressed_org), so the RESTRICTIVE org_boundary check
    (which only accepted current_org()/current_addressed_org()/NULL) failed.
  - Attempting the intake_submissions fix (DEFAULT
    coalesce(current_org(), current_addressed_org(), sole_org())) did NOT work
    for requests: evaluating sole_org() (SECURITY DEFINER, counts organizations)
    *as a column default under SET ROLE anon* fails the insert even with a
    WITH CHECK (true) boundary — the default-evaluation context does not cleanly
    run the definer function, and the row is rejected before the check.
    (Verified: explicit org_id — NULL or the real uuid — inserts fine; only the
    function-based default fails.)

  Fix: stop relying on a fragile function-based column default for the anon path.
  Route the public submit through ONE SECURITY DEFINER RPC (submit_public_request)
  that runs as definer, resolves the tenant via sole_org()/addressed org, stamps
  org_id explicitly, and inserts the request + its selections atomically. This is
  the same proven pattern the release kiosk uses. The client calls the RPC instead
  of two raw table inserts. Additive: table defaults/policies are left intact for
  authenticated/staff paths; only the anon submit mechanism changes.
*/

CREATE OR REPLACE FUNCTION submit_public_request(
  p_contact_name   text,
  p_contact_email  text,
  p_contact_phone  text DEFAULT NULL,
  p_contact_method text DEFAULT NULL,
  p_proposed_times jsonb DEFAULT '[]'::jsonb,
  p_notes          text DEFAULT NULL,
  p_selections     jsonb DEFAULT '[]'::jsonb  -- [{offering_slug, offering_id, tier_id, label}]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid;
  v_req uuid;
  s     jsonb;
BEGIN
  -- Tenant resolution: an addressed org if the host set one, else the lone
  -- single-tenant org. Definer context so sole_org()/organizations resolve.
  v_org := coalesce(current_org(), current_addressed_org(), sole_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization resolved for this request (multi-tenant: set app.addressed_org)';
  END IF;

  IF NULLIF(trim(coalesce(p_contact_name, '')), '') IS NULL
     OR NULLIF(trim(coalesce(p_contact_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'name and email are required';
  END IF;

  INSERT INTO requests (org_id, contact_name, contact_email, contact_phone,
                        contact_method, proposed_times, notes)
    VALUES (v_org, trim(p_contact_name), trim(p_contact_email),
            NULLIF(trim(coalesce(p_contact_phone, '')), ''),
            NULLIF(trim(coalesce(p_contact_method, '')), ''),
            coalesce(p_proposed_times, '[]'::jsonb),
            NULLIF(trim(coalesce(p_notes, '')), ''))
    RETURNING id INTO v_req;

  IF p_selections IS NOT NULL AND jsonb_typeof(p_selections) = 'array' THEN
    FOR s IN SELECT * FROM jsonb_array_elements(p_selections)
    LOOP
      INSERT INTO request_selections (org_id, request_id, offering_id, offering_slug, tier_id, label)
        VALUES (
          v_org, v_req,
          NULLIF(s->>'offering_id', '')::uuid,
          NULLIF(s->>'offering_slug', ''),
          NULLIF(s->>'tier_id', '')::uuid,
          NULLIF(s->>'label', ''));
    END LOOP;
  END IF;

  RETURN jsonb_build_object('request_id', v_req, 'org_id', v_org);
END;
$fn$;

REVOKE ALL ON FUNCTION submit_public_request(text, text, text, text, jsonb, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION submit_public_request(text, text, text, text, jsonb, text, jsonb)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION submit_public_request(text, text, text, text, jsonb, text, jsonb) IS
  'Public booking-request submit (anon-executable, SECURITY DEFINER). Resolves the tenant (addressed org or sole_org()), stamps org_id, and inserts the request + selections atomically. Replaces the raw anon table inserts that failed the org_boundary RLS check (2026-07-04 fix).';
