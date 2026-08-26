-- The vet's address stops being required (owner, 2026-08-26)
--
-- "something that we need to removed the required status of is the vets address
--  for the horse veterinarian. I noticed that sundance has a vet that literally
--  doesnt post an address because they just come to you at the horse location."
--
-- `contract_intake_requirements` put 'vet_address' in `horse.missing` whenever the
-- document printed HORSE.VET_ADDRESS and the record had none. Every entry in that
-- list is rendered `required` by the intake page, and `complete` was "both lists
-- empty" -- so a mobile vet with no address made the contract permanently
-- incompletable, with no way past the screen.
--
-- REMOVED FROM THE LIST ENTIRELY WOULD HAVE BEEN THE WRONG FIX: a vet who DOES
-- have an address should still be asked once. So an entry now carries `optional`,
-- and two things change:
--   * `complete` counts only the entries that are NOT optional, so an unfillable
--     address never blocks the contract; and
--   * the intake page renders an optional entry without `required` and says so.
--
-- Only 'vet_address' is optional today. The farrier and vet NAME and PHONE stay
-- required -- they are merged into the emergency-authorisation language, and a
-- vet you cannot telephone is a different problem from one with no street.

CREATE OR REPLACE FUNCTION public.contract_intake_requirements(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc     documents%ROWTYPE;
  v_tkey    text;
  v_staff   boolean;
  v_roles   text[];
  v_me      uuid := current_contact_id();
  v_c       contacts%ROWTYPE;
  v_horse   horses%ROWTYPE;
  v_tokens  text[] := '{}';
  v_can_fill boolean;
  v_mine    text[] := '{}';          -- the roles the CALLER's own contact holds
  v_cmiss   jsonb := '[]'::jsonb;
  v_hmiss   jsonb := '[]'::jsonb;
  v_horse_mine boolean := false;
  r         record;
  v_has     boolean;
  v_blocking int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  v_staff := coalesce(has_staff_access() AND v_doc.org_id = current_org(), false);
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_doc.template_id;
  SELECT array_agg(x.r) INTO v_roles FROM caller_party_roles(p_document_id) AS x(r);
  v_roles := coalesce(v_roles, ARRAY[]::text[]);

  SELECT bool_or(coalesce(c.can_fill, true)) INTO v_can_fill
    FROM unnest(v_roles) rr
    LEFT JOIN document_party_controls c
      ON c.document_id = p_document_id AND c.party_role = rr;
  v_can_fill := coalesce(v_can_fill, true);

  -- The roles whose party row is the CALLER'S OWN CONTACT. A staff member reading
  -- someone else's contract has no personal information to give it, and must never
  -- be prompted to enter theirs into the counterparty's seat.
  SELECT coalesce(array_agg(DISTINCT dp.party_role), ARRAY[]::text[]) INTO v_mine
    FROM document_parties dp
   WHERE dp.document_id = p_document_id AND dp.contact_id = v_me;

  -- ── every token this document can print ──────────────────────────────────
  SELECT coalesce(array_agg(DISTINCT t), '{}') INTO v_tokens FROM (
    SELECT (regexp_matches(cd.body, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1] AS t
      FROM contract_clause_defs cd WHERE cd.template_key = v_tkey
    UNION ALL
    SELECT (regexp_matches(ct.body, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]
      FROM contract_templates ct WHERE ct.id = v_doc.template_id AND ct.body IS NOT NULL
    UNION ALL
    SELECT (regexp_matches(cf.body, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]
      FROM contract_fields cf
     WHERE cf.document_id = p_document_id AND cf.body IS NOT NULL
  ) q;

  -- ── the person ───────────────────────────────────────────────────────────
  IF v_me IS NOT NULL AND array_length(v_mine, 1) > 0 THEN
    SELECT * INTO v_c FROM contacts WHERE id = v_me;
    FOR r IN
      SELECT * FROM (VALUES
        ('name',    'FULL_NAME',
         nullif(btrim(coalesce(v_c.first_name,'') || ' ' || coalesce(v_c.last_name,'')), '')),
        ('email',   'EMAIL',   nullif(btrim(coalesce(v_c.email, '')), '')),
        ('phone',   'PHONE',   nullif(btrim(coalesce(v_c.phone, '')), '')),
        ('address', 'ADDRESS', nullif(btrim(coalesce(
            nullif(btrim(coalesce(v_c.address_composed, '')), ''),
            compose_address(v_c.address_line1, v_c.address_line2,
                            v_c.city, v_c.state, v_c.postal_code),
            '')), ''))
      ) AS t(key, suffix, val)
    LOOP
      CONTINUE WHEN r.val IS NOT NULL;                 -- already on file
      SELECT EXISTS (
        SELECT 1 FROM unnest(v_mine) AS m(party_role)
         WHERE (m.party_role || '.' || r.suffix) = ANY(v_tokens)
            OR (r.suffix = 'FULL_NAME' AND (m.party_role || '.PRINTED_NAME') = ANY(v_tokens))
      ) INTO v_has;
      CONTINUE WHEN NOT v_has;                         -- this contract never prints it
      v_cmiss := v_cmiss || jsonb_build_object(
        'key', r.key,
        'optional', false,
        'label', CASE r.key WHEN 'name' THEN 'Your full legal name'
                            WHEN 'email' THEN 'Email address'
                            WHEN 'phone' THEN 'Phone number'
                            ELSE 'Mailing address' END);
    END LOOP;
  END IF;

  -- ── the horse record ─────────────────────────────────────────────────────
  v_horse_mine := EXISTS (
    SELECT 1 FROM contract_fields cf
     WHERE cf.document_id = p_document_id
       AND upper(coalesce(cf.section, '')) = 'HORSE'
       AND cf.owner_role = ANY(v_roles)
  ) AND v_can_fill;

  IF v_doc.horse_id IS NOT NULL AND v_horse_mine THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_doc.horse_id AND deleted_at IS NULL;
    IF FOUND THEN
      FOR r IN
        -- ⚠️ THE LAST COLUMN IS `optional`. A mobile veterinarian who travels to
        -- the horse has no address to give, and the contract must still complete.
        SELECT * FROM (VALUES
          ('farrier_name',  'FARRIER_NAME',  'Farrier — name',    'text',    false),
          ('farrier_phone', 'FARRIER_PHONE', 'Farrier — phone',   'text',    false),
          ('vet_name',      'VET_NAME',      'Veterinarian — name',     'text', false),
          ('vet_phone',     'VET_PHONE',     'Veterinarian — phone',    'text', false),
          ('vet_business_name', 'VET_BUSINESS', 'Veterinary practice',  'text', false),
          ('vet_address',   'VET_ADDRESS',   'Veterinarian — address',  'address', true)
        ) AS t(key, token, label, kind, optional)
      LOOP
        CONTINUE WHEN NOT (('HORSE.' || r.token) = ANY(v_tokens));
        CONTINUE WHEN nullif(btrim(coalesce(horse_field_token_value(v_horse, r.token), '')), '') IS NOT NULL;
        v_hmiss := v_hmiss || jsonb_build_object(
          'key', r.key, 'label', r.label, 'kind', r.kind, 'optional', r.optional);
      END LOOP;
    END IF;
  END IF;

  -- ⚠️ `complete` COUNTS ONLY WHAT BLOCKS. An optional entry is still returned so
  -- the page can offer it, but it can never hold a contract open.
  SELECT count(*) INTO v_blocking
    FROM (SELECT e FROM jsonb_array_elements(v_cmiss) e
          UNION ALL
          SELECT e FROM jsonb_array_elements(v_hmiss) e) q
   WHERE coalesce((q.e ->> 'optional')::boolean, false) = false;

  RETURN jsonb_build_object(
    'document_id', v_doc.id,
    'title', v_doc.title,
    'workflow_state', v_doc.workflow_state,
    'my_roles', to_jsonb(v_roles),
    'contact', jsonb_build_object('contact_id', v_me, 'missing', v_cmiss),
    'horse', jsonb_build_object(
       'horse_id', v_doc.horse_id,
       'mine', v_horse_mine,
       'needs_horse', (v_doc.horse_id IS NULL AND v_horse_mine),
       'missing', v_hmiss),
    'complete', (v_blocking = 0));
END;
$function$;
