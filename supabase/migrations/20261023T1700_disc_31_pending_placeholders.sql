-- Phase 31: Part 4.1 — a pending placeholder clause for every required selector
-- that gates clauses, so a blank selector prints "[Pending — …]" and blocks signing
-- (the required field is the sign blocker; the placeholder makes the gap visible in
-- the document instead of the section silently vanishing). After disc_18-30.
--
-- Each row: (template, selector field, a short subject for the message, the sort
-- position — placed just before the gate's own clause so it reads in place). Where
-- a selector already received a placeholder in an earlier phase (financing, lease
-- type, ownership limits, BOS PPE), it is omitted here. The message text is written
-- out per selector; no programmatic transform of contract wording.

DO $pp$
DECLARE r record; v_sort int; v_sect text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- LEASE
      ('HORSE_LEASE_V3','TXN.LEASE_TERM_TYPE','the lease term (fixed end date or open-ended)'),
      ('HORSE_LEASE_V3','TXN.PERMITTED_ACTIVITIES','the permitted activities'),
      ('HORSE_LEASE_V3','TXN.RIDER_AIDS','whether rider aids (bits, spurs, whips) are restricted'),
      ('HORSE_LEASE_V3','TXN.RIDER_AIDS_PROHIBITED','which rider aids are prohibited'),
      ('HORSE_LEASE_V3','TXN.MED_INCLUDED','whether major medical / surgical insurance applies'),
      ('HORSE_LEASE_V3','TXN.MED_COST_RESP','who bears the major medical insurance cost'),
      ('HORSE_LEASE_V3','TXN.MED_DED_RESP','who bears the major medical deductible'),
      ('HORSE_LEASE_V3','TXN.MORT_ELECTION','whether mortality insurance applies'),
      ('HORSE_LEASE_V3','TXN.MORT_COST_RESP','who bears the mortality insurance cost'),
      ('HORSE_LEASE_V3','TXN.MORT_DED_RESP','who bears the mortality deductible'),
      ('HORSE_LEASE_V3','TXN.GL_LESSOR_COVERAGE','the Lessor''s general liability coverage'),
      ('HORSE_LEASE_V3','TXN.GL_LESSOR_REQUIRES','whether the Lessor requires general liability coverage'),
      ('HORSE_LEASE_V3','TXN.GL_NO_REQ_ALLOCATION','how general liability responsibility is allocated'),
      ('HORSE_LEASE_V3','TXN.CCC_REQUIRED','whether a care, custody, and control policy is required'),
      -- SALE
      ('HORSE_SALE_V3','TXN.PPE_CHOICE','the pre-purchase examination arrangement'),
      ('HORSE_SALE_V3','TXN.PPE_TIMING','when the pre-purchase examination takes place'),
      ('HORSE_SALE_V3','TXN.PPE_CONTINGENT','whether the sale is contingent on the examination'),
      ('HORSE_SALE_V3','TXN.TRIAL_ENABLED','whether a trial period applies'),
      ('HORSE_SALE_V3','TXN.TRIAL_DEPOSIT_DISPOSITION','how the deposit is handled on a trial return'),
      ('HORSE_SALE_V3','TXN.DEPOSIT_ENABLED','whether a deposit applies'),
      ('HORSE_SALE_V3','TXN.INSTALLMENTS_ENABLED','whether the price is paid in installments'),
      ('HORSE_SALE_V3','TXN.BREEDING_ELECTION','whether a breeding warranty applies'),
      ('HORSE_SALE_V3','TXN.CO_BUYER_ENABLED','whether there is a co-buyer'),
      ('HORSE_SALE_V3','TXN.HAS_ENCUMBRANCES','whether any encumbrances affect the Horse'),
      -- BOS
      ('HORSE_BILL_OF_SALE','TXN.BOS_RELEASE_ELECTION','whether a release of liability is included')
    ) AS t(tpl, fk, subject)
  LOOP
    -- skip if a pending placeholder for this selector already exists
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM contract_clause_defs c, LATERAL (
        SELECT c.conditional_on cond UNION ALL SELECT jsonb_array_elements(c.conditional_on->'all')
        UNION ALL SELECT jsonb_array_elements(c.conditional_on->'any')) x
      WHERE c.template_key=r.tpl AND x.cond->>'field_key'=r.fk AND x.cond->'equals' ? '');
    -- place it just before the gate/owning clause of this field
    SELECT fd.section, coalesce((SELECT cd.sort_order FROM contract_clause_defs cd
        WHERE cd.template_key=r.tpl AND cd.clause_key=fd.clause_key), 1) - 1
      INTO v_sect, v_sort
      FROM contract_field_defs fd WHERE fd.template_key=r.tpl AND fd.field_key=r.fk LIMIT 1;
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (r.tpl, v_sect, replace(r.fk,'TXN.','') || '_PENDING', NULL,
            '[Pending — select ' || r.subject || '. This placeholder is replaced by the applicable term and blocks signing.]',
            'input', v_sort, false,
            jsonb_build_object('equals', jsonb_build_array(''), 'field_key', r.fk), false)
    ON CONFLICT (template_key, clause_key) DO NOTHING;
  END LOOP;
END $pp$;
