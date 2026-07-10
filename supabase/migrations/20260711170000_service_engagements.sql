/*
  # create_service_engagement — the general (non-brokerage) engagement creator

  Owner-reported: "add an engagement" only offered purchase / search / lease.
  Lessons, lesson subscriptions, training, and the horse-care services live in
  the service_types registry but had no creation path. This RPC creates any
  active service engagement for a client: CLIENT (+PARTICIPANT) parties, the
  horse when the service requires one, AWAITING_SIGNATURE so its paperwork
  (contract_requirements by service_type) flows through onboarding/signing.

  Also: list_service_types() — the registry read for the picker (RLS-locked
  table; staff read via definer).
*/

CREATE OR REPLACE FUNCTION list_service_types()
RETURNS TABLE (code text, display_name text, description text, segment text, requires_horse boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT st.code, st.display_name, st.description, st.segment, st.requires_horse
  FROM service_types st
  WHERE st.active AND st.code <> 'ONBOARDING' AND has_staff_access()
  ORDER BY st.sort_order, st.display_name
$$;

CREATE OR REPLACE FUNCTION create_service_engagement(
  p_client_contact_id uuid,
  p_service_type      text,
  p_horse_id          uuid DEFAULT NULL,
  p_start_date        date DEFAULT NULL,
  p_notes             text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id uuid;
  v_eng_id    uuid;
  v_requires  boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;

  SELECT requires_horse INTO v_requires
    FROM service_types WHERE code = p_service_type AND active AND code <> 'ONBOARDING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive service type: %', p_service_type;
  END IF;
  IF v_requires AND p_horse_id IS NULL THEN
    RAISE EXCEPTION '% requires a horse', p_service_type;
  END IF;

  SELECT id INTO v_client_id FROM clients
    WHERE contact_id = p_client_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_client_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date, notes, status)
    VALUES (v_client_id, p_service_type, p_horse_id,
            coalesce(p_start_date, now()::date), nullif(trim(p_notes), ''), 'AWAITING_SIGNATURE')
    RETURNING id INTO v_eng_id;

  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_client_contact_id, 'CLIENT', true, 1),
           (v_eng_id, p_client_contact_id, 'PARTICIPANT', false, NULL);

  RETURN v_eng_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION list_service_types() TO authenticated;
GRANT EXECUTE ON FUNCTION create_service_engagement(uuid, text, uuid, date, text) TO authenticated;
