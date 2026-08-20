-- PARTYEMAIL PHASE 1 — a party is an email address.
--
-- D22 §7 (owner, 2026-08-20): "only an email address is required for a contract to
-- have a valid party ... and the one exception is the email address — when its
-- added to the contract to create a party that information is matched, that means
-- it isnt read from the client record until they claim the contract by activating
-- their account with a matching email."
--
-- Today a party cannot be created that way. `document_parties.contact_id` is NOT
-- NULL and staff can only pick an EXISTING contact — and `contract_party_options`
-- filters out every contact without a name, so a person we know only by email is
-- not even offerable. The counterparty had to be typed into the CRM as a person
-- before the contract could name them.
--
-- WHAT THIS ADDS. One RPC, `add_document_party_by_email(document, role, email)`:
--   match the address against the org's contacts first (an address we already hold
--   IS that person — this is the match key D22 describes), and only mint a stub
--   `contacts` row when nothing matches. The stub carries an email and
--   `name_needs_confirmation = true`, which is the column that already exists for
--   exactly this shape; it carries no name, because nothing may be invented on the
--   person's behalf.
--
-- WHAT IT DELIBERATELY DOES NOT DO.
--   * NO `email` column on `document_parties`. The contact IS the party identity
--     and ~34 tables key on `contact_id`; a second identity anchor is this
--     project's defining failure.
--   * NO second invite path. `invite_contract_counterparty` already refuses a
--     non-party ("contact % is not a party on this contract") — it invites, it does
--     not create. This is the creation side, and the invite it enables is the
--     unchanged one.
--   * NO second re-anchoring path. When the role already has a roster row (the
--     normal case: every contract template seeds its party roles at start),
--     `reassign_document_party` does the work — it already moves both roster rows,
--     clears the five stale party tokens, refills from the contact and re-merges.

CREATE OR REPLACE FUNCTION public.add_document_party_by_email(
  p_document_id uuid, p_party_role text, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_state    text;
  v_contract uuid;
  v_role     text := upper(btrim(coalesce(p_party_role, '')));
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_contact  uuid;
  v_created  boolean := false;
  v_order    int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state, contract_id INTO v_org, v_state, v_contract
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT coalesce(has_staff_access() AND v_org = current_org(), false) THEN
    RAISE EXCEPTION 'only staff may add a party';
  END IF;
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this contract can no longer be edited';
  END IF;
  -- the same four roles reassign_document_party admits; the roster's other roles
  -- (FHE, PARTICIPANT, GUARDIAN ...) are seeded by their own flows.
  IF v_role NOT IN ('LESSEE','LESSOR','BUYER','SELLER') THEN
    RAISE EXCEPTION 'invalid party role: %', p_party_role;
  END IF;
  IF v_email = '' OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'a valid email address is required';
  END IF;

  -- MATCH BEFORE MINT. The email is the match key, so an address already on file
  -- resolves to that contact and their record fills the party immediately.
  SELECT id INTO v_contact FROM contacts
   WHERE org_id = v_org AND lower(email) = v_email AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, email, name_needs_confirmation)
      VALUES (v_org, v_email, true)
      RETURNING id INTO v_contact;
    v_created := true;
  END IF;

  IF EXISTS (SELECT 1 FROM document_parties
              WHERE document_id = p_document_id AND party_role = v_role) THEN
    PERFORM reassign_document_party(p_document_id, v_role, v_contact);
  ELSE
    SELECT coalesce(max(signer_order), 0) + 1 INTO v_order
      FROM document_parties WHERE document_id = p_document_id;
    INSERT INTO document_parties (org_id, document_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, p_document_id, v_contact, v_role, true, v_order)
      ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;
    IF v_contract IS NOT NULL THEN
      INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
        VALUES (v_org, v_contract, v_contact, v_role, true, v_order)
        ON CONFLICT (contract_id, contact_id, party_role) DO NOTHING;
    END IF;
    PERFORM fill_party_fields_from_contacts(p_document_id);
    PERFORM remerge_contract_from_clauses(p_document_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'contact_id', v_contact, 'contact_created', v_created,
    'email', v_email, 'party_role', v_role);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_document_party_by_email(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_document_party_by_email(uuid, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.add_document_party_by_email(uuid, text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.add_document_party_by_email(uuid, text, text) TO service_role;

-- The roster the Parties & Horse card renders must be able to SAY "email only".
-- `document_parties_summary` already reports a `missing` set; it did not report
-- whether the record is a stub awaiting its own owner. Reissued from the live prod
-- body (pg_get_functiondef, 2026-08-20) with one added key per party.
CREATE OR REPLACE FUNCTION public.document_parties_summary(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_horse uuid;
BEGIN
  SELECT org_id, horse_id INTO v_org, v_horse FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT ((coalesce(has_staff_access() AND v_org = current_org(), false)) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN jsonb_build_object(
    'parties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', dp.party_role,
          'contact_id', dp.contact_id,
          'name',  nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'email', nullif(btrim(coalesce(c.email,'')), ''),
          'phone', nullif(btrim(coalesce(c.phone,'')), ''),
          'address', nullif(btrim(coalesce(
                       nullif(btrim(coalesce(c.address_composed,'')),''),
                       compose_address(c.address_line1, c.address_line2, c.city, c.state, c.postal_code)
                     ,'')), ''),
          -- component fields so the modal can edit the address in parts
          'address_line1', c.address_line1, 'address_line2', c.address_line2,
          'city', c.city, 'state', c.state, 'postal_code', c.postal_code,
          'first_name', c.first_name, 'last_name', c.last_name,
          -- PARTYEMAIL P1: this party is an email address and nothing else yet.
          -- The card says so rather than printing an em dash where a name goes.
          'awaiting_details', coalesce(c.name_needs_confirmation, false),
          -- required-field completeness (name+address+email+phone)
          'missing', (
            SELECT coalesce(jsonb_agg(m), '[]'::jsonb) FROM (
              SELECT 'name'    AS m WHERE nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')),'') IS NULL
              UNION ALL SELECT 'email'   WHERE nullif(btrim(coalesce(c.email,'')),'') IS NULL
              UNION ALL SELECT 'phone'   WHERE nullif(btrim(coalesce(c.phone,'')),'') IS NULL
              UNION ALL SELECT 'address' WHERE nullif(btrim(coalesce(
                         nullif(btrim(coalesce(c.address_composed,'')),''),
                         compose_address(c.address_line1,c.address_line2,c.city,c.state,c.postal_code)
                       ,'')),'') IS NULL
            ) q
          ))
        ORDER BY dp.party_role, dp.signer_order NULLS LAST, dp.id)
      FROM document_parties dp
      LEFT JOIN contacts c ON c.id = dp.contact_id
      WHERE dp.document_id = p_document_id
        AND dp.party_role IN ('LESSEE','LESSOR','BUYER','SELLER')), '[]'::jsonb),
    'horse_id', v_horse,
    'horse_name', (SELECT coalesce(nullif(registered_name,''), nickname) FROM horses WHERE id = v_horse),
    'horse_missing', CASE WHEN v_horse IS NULL THEN jsonb_build_array('horse')
      ELSE coalesce((SELECT jsonb_agg(m) FROM (
        SELECT 'identity' AS m FROM horses h WHERE h.id = v_horse
         AND nullif(btrim(coalesce(h.registered_name,'')),'') IS NULL
         AND nullif(btrim(coalesce(h.nickname,'')),'') IS NULL
      ) q), '[]'::jsonb) END
  );
END;
$function$;
