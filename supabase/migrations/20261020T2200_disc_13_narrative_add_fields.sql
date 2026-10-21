-- Disclosure reciprocity, phase 13: an author-writable ADD field per narrative
-- disclosure section, on all three v3 templates.
--
-- Why this exists. The disclosed content token (HORSE.<SECTION>) is imported from
-- the horse record and read-only (phase 8). That left two cases with no writable
-- surface: (a) an EMPTY record where the author answers the gate YES and must still
-- be able to say what is being disclosed, and (b) a record that HAS entries where
-- the author needs to add a new entry or more detail. One author field per section
-- serves both: imported content stays read-only above it; the author adds here; the
-- addition is appended to the record as a new entry at execution (phase 15).
--
-- The field is keyed ADD.<SECTION> (not HORSE.*) so it renders as an editable control
-- (the frontend locks only HORSE.* tokens) and survives record resync (which touches
-- only HORSE.* fields). It is OPTIONAL — only the gate is required to sign.
--
-- Built generically off each template's live DISCLOSED clause so the three templates'
-- differing clause keys, sort orders, conditions, and party voice are all inherited.

DO $add$
DECLARE
  d record;
  v_sec text;          -- section concept, e.g. KNOWN_CONDITIONS
  v_add_clause text;   -- ADD clause key
  v_voice text;        -- 'Seller' | 'Lessor'
  v_owner_role text;
  v_noun text;         -- 'disclosures' | 'injury details' etc. kept generic
BEGIN
  FOR d IN
    SELECT template_key, clause_key, section_key, sort_order, conditional_on, body
      FROM contract_clause_defs
     WHERE template_key IN ('HORSE_SALE_V3','HORSE_LEASE_V3','HORSE_BILL_OF_SALE')
       AND clause_key LIKE '%\_DISCLOSED'
       -- narrative sections only; meds/supplements get a structured ADD in phase 14
       AND clause_key NOT LIKE '%MEDICATIONS%'
       AND clause_key NOT LIKE '%SUPPLEMENTS%'
  LOOP
    -- section concept = the gate field's section, read from the DISCLOSED condition
    v_sec := split_part(
      coalesce(d.conditional_on->>'field_key',
               (d.conditional_on->'all'->1->>'field_key')), '.', 2);
    v_sec := regexp_replace(v_sec, '_GATE$', '');     -- KNOWN_CONDITIONS_GATE -> KNOWN_CONDITIONS
    v_add_clause := d.clause_key || '_ADD';
    v_voice := CASE WHEN d.body LIKE 'Lessor%' OR d.body LIKE '%Lessor ' THEN 'Lessor' ELSE 'Seller' END;
    -- owner_role from the gate field on the same template
    SELECT owner_role INTO v_owner_role FROM contract_field_defs
      WHERE template_key = d.template_key AND field_key = 'HORSE.'||v_sec||'_GATE' LIMIT 1;
    v_owner_role := coalesce(v_owner_role, CASE WHEN v_voice='Lessor' THEN 'LESSOR' ELSE 'SELLER' END);

    -- ADD clause: same visibility as DISCLOSED (gate = YES [+ BOS standalone]).
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (d.template_key, d.section_key, v_add_clause, NULL,
            'Additional disclosures provided by the '||v_voice||': {{ADD.'||v_sec||'}}',
            'input', d.sort_order + 1, true, d.conditional_on, false)
    ON CONFLICT (template_key, clause_key) DO NOTHING;

    -- The author field. Optional longtext; same visibility as its clause.
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES (d.template_key, 'ADD.'||v_sec,
            'Add to this disclosure', d.section_key, v_owner_role, 'longtext', 'text',
            false, true, 'longtext', v_add_clause, d.conditional_on,
            'Optional. Add a new item or more detail here — it is saved to the horse''s record when the agreement is executed. The imported entries above cannot be edited here; change those on the record.')
    ON CONFLICT (template_key, field_key) DO NOTHING;
  END LOOP;
END $add$;
