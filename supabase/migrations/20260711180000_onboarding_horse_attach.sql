/*
  # ensure_onboarding_engagement v2 — attach the client's horse

  Owner-reported: the horse-care release generated without the horse's
  collected information. The HORSE.* tokens resolve from the engagement's
  primary_horse_id, and the ONBOARDING engagement never set one. Now it
  attaches the contact's horse (their owned horse first, else the one they
  lease; most recent record wins) at creation, and backfills an existing
  paperless onboarding engagement that's missing it. Non-executed docs
  regenerate on each onboarding entry, so updated record data flows in.
*/

CREATE OR REPLACE FUNCTION ensure_onboarding_engagement(p_contact_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client uuid;
  v_eng    uuid;
  v_org    uuid;
  v_horse  uuid;
BEGIN
  SELECT cl.id, cl.org_id INTO v_client, v_org
    FROM clients cl WHERE cl.contact_id = p_contact_id AND cl.deleted_at IS NULL
    LIMIT 1;
  IF v_client IS NULL THEN
    SELECT c.org_id INTO v_org FROM contacts c WHERE c.id = p_contact_id;
    INSERT INTO clients (contact_id, status, source, org_id)
    VALUES (p_contact_id, 'ACTIVE', 'onboarding', v_org)
    RETURNING id INTO v_client;
  END IF;

  -- the horse this person's paperwork is about: owned first, else leased
  SELECT h.id INTO v_horse FROM horses h
   WHERE h.deleted_at IS NULL
     AND (h.current_owner_contact_id = p_contact_id OR h.lessee_contact_id = p_contact_id)
   ORDER BY (h.current_owner_contact_id = p_contact_id) DESC, h.created_at DESC
   LIMIT 1;

  SELECT e.id INTO v_eng
    FROM engagements e
    WHERE e.client_id = v_client AND e.service_type = 'ONBOARDING'
      AND e.deleted_at IS NULL
    LIMIT 1;
  IF v_eng IS NULL THEN
    INSERT INTO engagements (client_id, service_type, status, primary_horse_id, org_id)
    VALUES (v_client, 'ONBOARDING', 'AWAITING_SIGNATURE', v_horse, v_org)
    RETURNING id INTO v_eng;
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, org_id)
    VALUES (v_eng, p_contact_id, 'CLIENT', true, v_org),
           (v_eng, p_contact_id, 'PARTICIPANT', false, v_org);
  ELSIF v_horse IS NOT NULL THEN
    -- backfill an engagement created before the horse record existed
    UPDATE engagements SET primary_horse_id = v_horse
     WHERE id = v_eng AND primary_horse_id IS NULL;
  END IF;
  RETURN v_eng;
END;
$fn$;
