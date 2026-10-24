-- Disclosure rebuild, phase 25: per-section acknowledgment line with initials.
-- Runs AFTER disc_18-24.
--
-- Part 1.4: every disclosure section that prints with Yes gets its own acknowledgment
-- line beneath it, owned by the Buyer/Lessee seat, settable only by that party,
-- required to sign when that section is Yes. The party types initials; the engine
-- verifies the initials match the party's name on the document. The printed line
-- shows the acknowledgment sentence and the initials. The human-injury
-- acknowledgment that used to live inside the Yes clause moves here. The sale's
-- Buyer Acceptance section and its certify field are removed; the initials replace it.
--
-- A new field format 'initials' is introduced: a short text control whose expected
-- value is the counterparty's initials (first letter of each name token). The
-- front-end renders the expected initials as gray helper text; the lock-blocker
-- refuses signing when a required initials field is empty or does not match.

-- ── 1. The sale Buyer Acceptance section + certify field (dead; gated on retired
--       TXN.HAS_DISCLOSURES / TXN.INJURY_HISTORY). Remove entirely. ──
DELETE FROM contract_field_defs  WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.BUYER_ACCEPTS_DISCLOSURES';
DELETE FROM contract_clause_defs WHERE template_key='HORSE_SALE_V3' AND clause_key='ACCEPT.DISCLOSURES';
DELETE FROM contract_section_defs WHERE template_key='HORSE_SALE_V3' AND section_key='BUYER_ACCEPTANCE';

-- ── 2. One acknowledgment clause + initials field per disclosed section, per doc. ──
-- Built off each DISCLOSED clause so section, voice, and gate condition are inherited.
-- Section display names for the acknowledgment sentence.
DO $ack$
DECLARE
  d record;
  v_sec text;            -- KNOWN_CONDITIONS, …
  v_other text;          -- Lessee | Buyer
  v_other_ns text;       -- LESSEE | BUYER (field namespace / owner_role)
  v_name text;           -- human section name for the sentence
  v_ack_clause text; v_ack_field text;
  v_disc_sort int; v_sect text;
BEGIN
  FOR d IN
    SELECT template_key, clause_key, section_key, sort_order, conditional_on
      FROM contract_clause_defs
     WHERE clause_key LIKE '%\_DISCLOSED'
       AND clause_key NOT LIKE '%\_DISCLOSED\_ADD'
       AND template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
  LOOP
    v_sec := regexp_replace(d.clause_key, '^(HORSE\.|BOS_)', '');
    v_sec := regexp_replace(v_sec, '_DISCLOSED$', '');
    v_other   := CASE WHEN d.template_key='HORSE_LEASE_V3' THEN 'Lessee' ELSE 'Buyer' END;
    v_other_ns := CASE WHEN d.template_key='HORSE_LEASE_V3' THEN 'LESSEE' ELSE 'BUYER' END;
    v_name := CASE v_sec
      WHEN 'KNOWN_CONDITIONS'   THEN 'known conditions'
      WHEN 'MEDICAL_HISTORY'    THEN 'medical history'
      WHEN 'BEHAVIORAL_HISTORY' THEN 'behavior'
      WHEN 'INJURIES_TO_HUMANS' THEN 'injuries to a person'
      WHEN 'INJURIES_TO_HORSE'  THEN 'injuries to the horse'
      WHEN 'MEDICATIONS'        THEN 'medications'
      WHEN 'SUPPLEMENTS'        THEN 'supplements'
      ELSE lower(replace(v_sec,'_',' ')) END;
    v_ack_clause := d.clause_key || '_ACK';
    v_ack_field  := 'ACK.' || v_sec;  -- shared key per doc; unique per (template, field_key)
    v_disc_sort := d.sort_order;

    -- ACK clause: shown exactly when the section's DISCLOSED is shown (same condition),
    -- one slot after the DISCLOSED clause.
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (d.template_key, d.section_key, v_ack_clause, NULL,
            v_other || ' acknowledges the ' || v_name || ' disclosed above and proceeds with knowledge of it. Initialed: {{' || v_ack_field || '}}',
            'input', v_disc_sort + 1, false, d.conditional_on, false)
    ON CONFLICT (template_key, clause_key) DO NOTHING;

    -- ACK field: initials, owned by the counterparty seat, required. Its own
    -- condition mirrors the gate so it is required ONLY when the section is Yes.
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES (d.template_key, v_ack_field, v_other || ' initials', d.section_key, v_other_ns,
            'text', 'text', true, false, 'initials', v_ack_clause, d.conditional_on,
            'Type your initials to acknowledge this disclosure. Your initials must match your name on this document.')
    ON CONFLICT (template_key, field_key) DO NOTHING;

    -- Co-buyer acknowledgment: on the documents that have a co-buyer (sale, BOS),
    -- the same line also carries the co-buyer's initials, shown and required only
    -- when a co-buyer exists. A sibling clause at DISCLOSED+2 keeps the composer's
    -- whole-line gating intact. (The lease has no co-lessee; skip it there.)
    IF d.template_key IN ('HORSE_SALE_V3','HORSE_BILL_OF_SALE') THEN
      DECLARE v_cb_cond jsonb;
      BEGIN
        -- condition = section's own condition AND co-buyer enabled.
        v_cb_cond := jsonb_build_object('all', jsonb_build_array(
          d.conditional_on,
          jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'TXN.CO_BUYER_ENABLED')));
        INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
        VALUES (d.template_key, d.section_key, v_ack_clause || '_CB', NULL,
                'Co-Buyer acknowledges the ' || v_name || ' disclosed above and proceeds with knowledge of it. Initialed: {{' || v_ack_field || '_COBUYER}}',
                'input', v_disc_sort + 2, false, v_cb_cond, false)
        ON CONFLICT (template_key, clause_key) DO NOTHING;

        INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
        VALUES (d.template_key, v_ack_field || '_COBUYER', 'Co-Buyer initials', d.section_key, 'COBUYER',
                'text', 'text', true, false, 'initials', v_ack_clause || '_CB', v_cb_cond,
                'Type your initials to acknowledge this disclosure. Your initials must match your name on this document.')
        ON CONFLICT (template_key, field_key) DO NOTHING;
      END;
    END IF;
  END LOOP;
END $ack$;

-- ── 3. Lock-blocker: an 'initials' field is required when shown, and its value
--       must match the owning party's initials (first letter of each name token).
--       A new blocker code 'initials_mismatch' refuses signing on a mismatch.
DO $lb$
DECLARE v_def text; v_anchor text; v_add text;
BEGIN
  SELECT pg_get_functiondef('public.contract_lock_blockers'::regproc) INTO v_def;
  IF position('initials_mismatch' IN v_def) > 0 THEN RETURN; END IF;

  -- The required-fields query already treats a required empty field as a blocker
  -- (initials fields are required + conditional). We ADD a mismatch check right
  -- before the final RETURN. Anchor on the function's closing "RETURN v_blockers;".
  v_anchor := 'RETURN v_blockers;';
  v_add := $q$  -- initials acknowledgment: a filled initials field must match the owning
  -- party's name on the document (first letter of each name token, letters only).
  -- Name source depends on the party type: an ENTITY uses its signing individual's
  -- name (<ROLE>.ENTITY_SIGNER_NAME, a contract field); an individual uses the
  -- contact name from document_parties -> contacts (the party-name blocker's source).
  DECLARE
    r record; v_expect text; v_got text; v_pname text; v_ptype text; v_bad text[];
  BEGIN
    FOR r IN
      SELECT cf.field_key, cf.value, cf.owner_role,
             coalesce(cf.label, cf.field_key) AS label
        FROM contract_fields cf
       WHERE cf.document_id = p_document_id AND cf.format_type = 'initials'
         AND nullif(btrim(coalesce(cf.value,'')), '') IS NOT NULL
    LOOP
      SELECT upper(btrim(coalesce(cf2.value,''))) INTO v_ptype FROM contract_fields cf2
        WHERE cf2.document_id = p_document_id AND cf2.field_key = r.owner_role || '.PARTY_TYPE';
      IF v_ptype = 'ENTITY' THEN
        SELECT btrim(coalesce(cf3.value,'')) INTO v_pname FROM contract_fields cf3
          WHERE cf3.document_id = p_document_id AND cf3.field_key = r.owner_role || '.ENTITY_SIGNER_NAME';
      ELSE
        SELECT btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) INTO v_pname
          FROM document_parties dp JOIN contacts c ON c.id = dp.contact_id
         WHERE dp.document_id = p_document_id AND dp.party_role = r.owner_role
         ORDER BY dp.signer_order NULLS LAST, dp.id
         LIMIT 1;
      END IF;
      v_expect := upper(regexp_replace(
        array_to_string(ARRAY(SELECT left(w,1) FROM regexp_split_to_table(btrim(coalesce(v_pname,'')), '\s+') w WHERE w <> ''), ''),
        '[^A-Za-z]', '', 'g'));
      v_got := upper(regexp_replace(coalesce(r.value,''), '[^A-Za-z]', '', 'g'));
      IF v_expect <> '' AND v_got <> v_expect THEN
        v_bad := coalesce(v_bad, ARRAY[]::text[]) || (r.label || ' (expected ' || v_expect || ')');
      END IF;
    END LOOP;
    IF v_bad IS NOT NULL THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'initials_mismatch',
        'message', 'Initials do not match the party''s name for: ' || array_to_string(v_bad, ', ')));
    END IF;
  END;

  RETURN v_blockers;$q$;

  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'contract_lock_blockers RETURN anchor not found';
  END IF;
  -- replace the LAST occurrence by reversing is overkill; the function has one
  -- top-level "RETURN v_blockers;" at the end — replace it.
  v_def := replace(v_def, v_anchor, v_add);
  EXECUTE v_def;
END $lb$;
