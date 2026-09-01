-- HORSE_LEASE_V2 — Final Update Pass (Batch 2), owner spec HORSE_LEASE_V2_BATCH2_CHANGES.md (2026-07-27)
--
-- P1  LESSEE.PARTY_TYPE (INDIVIDUAL|ENTITY), derived from contacts.is_company at
--     party fill, override allowed (fill only writes blank values).
-- P2  Lessee's Representations -> conditional pair on party type.
-- P3  Required Protective Attire -> universal wording (any authorized rider).
-- P4  New clause: Releases Required for Authorized Riders (PERMITTED_USE).
-- P5  Insurance rebuild: GL (open format, fault-triggered deductible resp) /
--     Mortality (Lessor-held election, limit >= FMV validated) / Medical
--     (NONE|COVERED pair, no "major") / CCC (entity-only) / Coordination of
--     Coverage. No must-obtain variants anywhere. Shared responsibility format:
--     Lessor|Lessee|Split|Other; $-split only where the governing amount is
--     stated in the clause (auto-computed counterpart => parts always sum
--     exactly; overshoot rejected); %-only elsewhere.
-- P6  Limitation collapsed to single unconditional FMV-anchored clause
--     (key renamed to INSURANCE_RISK.LIMITATION; no field references exist).
-- P7  Risk of Loss: FHE-standard misconduct carve-out.
-- P8  Late Payments: void -> termination-for-cause grounds; Self-Termination:
--     vet-determined trigger + FHE misconduct standard; new Survival clause.
-- P9  Purpose dropdown (recreational|instructional|competition|commercial
--     program) with neutral fallback when unset.
-- P10 Evaluation Period: nonrefundable fee (INCLUDED|FIXED), no unavailability
--     machinery.
-- P11 Wording: authorized-riders sentence; DAYS_USED relabel; no "Major
--     Medical" anywhere.

BEGIN;

-- ============================================================================
-- PART 1 — LESSEE.PARTY_TYPE
-- ============================================================================
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role,
   input_kind, value_type, format_type, options, conditional_on, guidance, required, sort_order)
VALUES
  ('HORSE_LEASE_V2','LESSEE.PARTY_TYPE','Lessee is an','PARTIES','PARTIES.INTRO','LESSEE',
   'select','select','select',
   '[{"value":"INDIVIDUAL","label":"Individual"},{"value":"ENTITY","label":"Entity / organization"}]'::jsonb,
   NULL,'Derived from the Lessee''s contact record (company vs person) at creation; override if needed. Drives the entity-specific representations, CCC insurance, and Coordination of Coverage clauses.',true,5)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, options=EXCLUDED.options, guidance=EXCLUDED.guidance,
      required=EXCLUDED.required, clause_key=EXCLUDED.clause_key, sort_order=EXCLUDED.sort_order;

-- derive at party fill (blank-only upsert preserves overrides)
DO $MIG$
DECLARE v_src text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='fill_party_fields_from_contacts';
  IF v_src LIKE '%PARTY_TYPE%' THEN RETURN; END IF;
  v_new := regexp_replace(v_src,
    $P$\(r\.party_role \|\| '\.ADDRESS',(\s+)v_addr\)$P$,
    $R$(r.party_role || '.ADDRESS',\1v_addr),
         (r.party_role || '.PARTY_TYPE',
          CASE WHEN r.party_role = 'LESSEE'
               THEN CASE WHEN coalesce(r.is_company,false) THEN 'ENTITY' ELSE 'INDIVIDUAL' END END)$R$);
  IF v_new = v_src THEN RAISE EXCEPTION 'fill_party_fields anchor not found'; END IF;
  EXECUTE v_new;
END $MIG$;

-- ============================================================================
-- PART 2 — Lessee's Representations conditional pair
-- ============================================================================
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
SELECT 'HORSE_LEASE_V2','LESSEE_REPS','LESSEE_REPS.MAIN_INDIVIDUAL',
       'Lessee''s Representations', body, 'prose', 10, false,
       '{"equals":["INDIVIDUAL",""],"field_key":"LESSEE.PARTY_TYPE"}'::jsonb
FROM contract_clause_defs
WHERE template_key='HORSE_LEASE_V2' AND clause_key='LESSEE_REPS.MAIN'
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','LESSEE_REPS','LESSEE_REPS.MAIN_ENTITY','Lessee''s Representations',
   'Lessee represents and warrants that Lessee is duly organized and in good standing, and has full authority to enter into this Agreement, and that the individual signing this Agreement does so as Lessee''s authorized representative; that each person who rides or handles the Horse under Lessee''s authorization will, before doing so, have executed the releases required under this Agreement and possess the knowledge and experience to handle and ride the Horse safely; and that Lessee will use reasonable care and follow Lessor''s instructions in all handling of the Horse. By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.',
   'prose', 20, false,
   '{"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;

DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LESSEE_REPS.MAIN';

-- ============================================================================
-- PART 3 — Required Protective Attire: universal wording
-- ============================================================================
UPDATE contract_clause_defs SET body =
'Lessee shall wear, and shall ensure that any other person riding the Horse under Lessee''s authorization wears, an appropriately fitted and securely fastened ASTM/SEI-certified equestrian helmet at all times while mounted on the Horse, together with heeled boots and long pants; gloves and long sleeves are highly recommended. Riders shall provide their own helmet, boots, and pants meeting these requirements unless otherwise agreed in writing. Lessee, on behalf of all Lessee Parties, assumes all increased risk of injury or death resulting from any failure to wear the required attire. Any refusal or failure to wear an approved helmet or the other required attire immediately revokes permission to ride or handle the Horse and constitutes a material breach of this Agreement.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.SAFETY_ATTIRE';

-- ============================================================================
-- PART 4 — Releases Required for Authorized Riders (after Allowing Others)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                  WHERE template_key='HORSE_LEASE_V2'
                    AND clause_key='PERMITTED_USE.RELEASES_REQUIRED') THEN
    UPDATE contract_clause_defs SET sort_order = sort_order * 10
     WHERE template_key='HORSE_LEASE_V2' AND section_key='PERMITTED_USE';
  END IF;
END $$;

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','PERMITTED_USE','PERMITTED_USE.RELEASES_REQUIRED',
   'Releases Required for Authorized Riders',
   'No person other than Lessee may ride or handle the Horse under this Agreement unless that person (or, if a minor, that person''s parent or legal guardian) has first executed a liability release in favor of the Lessor Parties in a form reasonably acceptable to Lessor. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.',
   'prose', 495, false, NULL)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading=EXCLUDED.heading, body=EXCLUDED.body, sort_order=EXCLUDED.sort_order;

-- ============================================================================
-- PART 5 — Insurance section rebuild
-- ============================================================================
-- retire the three-variant structure and its fields entirely
DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2' AND section_key='INSURANCE_RISK'
   AND (clause_key ~ '^INSURANCE_RISK\.(GL|MORTALITY|MAJOR_MEDICAL)_(HAS|WILL|LESSEE|NONE)$'
        OR clause_key ~ '^INSURANCE_RISK\.(GL|MORTALITY|MAJOR_MEDICAL)_DED_'
        OR clause_key = 'INSURANCE_RISK.MAJOR_MEDICAL'
        OR clause_key = 'INSURANCE_RISK.LIMITATION_MORTALITY');

DELETE FROM contract_field_defs
 WHERE template_key='HORSE_LEASE_V2' AND section='INSURANCE_RISK'
   AND field_key LIKE 'TXN.%';

-- ---- fields ----------------------------------------------------------------
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role,
   input_kind, value_type, format_type, options, conditional_on, guidance, required, sort_order)
VALUES
-- General Liability (open format)
('HORSE_LEASE_V2','TXN.GL_POSTURE','General liability posture','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'select','select','select',
 '[{"value":"MAINTAINS","label":"maintains"},{"value":"REQUIRES_WILL","label":"requires and will maintain"}]'::jsonb,
 NULL,'Renders as "Lessor maintains …" or "Lessor requires and will maintain …".',true,10),
('HORSE_LEASE_V2','TXN.GL_DESCRIPTION','Policy description (optional)','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'longtext','text',NULL,NULL,
 '{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"}'::jsonb,
 'Carrier posture, policy limit, deductible, effective date — state as much or as little as elected. Omitted entirely when blank.',false,20),
('HORSE_LEASE_V2','TXN.GL_DED_RESP','Deductible responsibility (Lessee-responsibility claims)','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"},{"value":"SPLIT","label":"Split"},{"value":"OTHER","label":"Other"}]'::jsonb,
 '{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"}'::jsonb,
 'Applies only to claims arising from events for which Lessee bears responsibility; other claims leave the deductible with the policyholder.',true,30),
('HORSE_LEASE_V2','TXN.GL_DED_RESP_SPLIT_LESSOR','Split — % paid by Lessor','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["SPLIT"],"field_key":"TXN.GL_DED_RESP"}]}'::jsonb,
 'Percentage only (no stated amount to anchor a $ split). The other share auto-fills to total 100%.',false,40),
('HORSE_LEASE_V2','TXN.GL_DED_RESP_SPLIT_LESSEE','Split — % paid by Lessee','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["SPLIT"],"field_key":"TXN.GL_DED_RESP"}]}'::jsonb,
 'Percentage only. The other share auto-fills to total 100%.',false,50),
('HORSE_LEASE_V2','TXN.GL_DED_RESP_OTHER','Other deductible arrangement','INSURANCE_RISK','INSURANCE_RISK.GENERAL_LIABILITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["OTHER"],"field_key":"TXN.GL_DED_RESP"}]}'::jsonb,
 NULL,false,60),
-- Mortality (Lessor-held election)
('HORSE_LEASE_V2','TXN.MORT_ELECTED','Mortality insurance elected?','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'yesno','select','yesno',NULL,NULL,
 'Lessor-held only — a lessee cannot bind coverage on a horse they do not own. Not elected renders "No mortality insurance is required under this Agreement."',true,10),
('HORSE_LEASE_V2','TXN.MORT_LIMIT','Policy limit','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}'::jsonb,
 'Must be at least the horse''s fair market value — a lower amount is rejected at input.',false,20),
('HORSE_LEASE_V2','TXN.MORT_DEDUCTIBLE','Deductible','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}'::jsonb,NULL,false,30),
('HORSE_LEASE_V2','TXN.MORT_EFFECTIVE_DATE','Effective date no later than','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'date','date','date',NULL,
 '{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}'::jsonb,NULL,false,40),
('HORSE_LEASE_V2','TXN.MORT_PREM_RESP','Premium responsibility','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"},{"value":"SPLIT","label":"Split"},{"value":"OTHER","label":"Other"}]'::jsonb,
 '{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}'::jsonb,NULL,false,50),
('HORSE_LEASE_V2','TXN.MORT_PREM_RESP_SPLIT_LESSOR','Premium split — % paid by Lessor','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_PREM_RESP"}]}'::jsonb,
 'Percentage only (premium amount is not stated in the clause). Auto-totals 100%.',false,60),
('HORSE_LEASE_V2','TXN.MORT_PREM_RESP_SPLIT_LESSEE','Premium split — % paid by Lessee','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_PREM_RESP"}]}'::jsonb,
 'Percentage only. Auto-totals 100%.',false,70),
('HORSE_LEASE_V2','TXN.MORT_PREM_RESP_OTHER','Other premium arrangement','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_PREM_RESP"}]}'::jsonb,NULL,false,80),
('HORSE_LEASE_V2','TXN.MORT_DED_RESP','Deductible responsibility','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"},{"value":"SPLIT","label":"Split"},{"value":"OTHER","label":"Other"}]'::jsonb,
 '{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}'::jsonb,NULL,false,90),
('HORSE_LEASE_V2','TXN.MORT_DED_RESP_MODE','Deductible split entered as','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'select','select','select',
 '[{"value":"DOLLAR","label":"$ amount"},{"value":"PERCENT","label":"% percentage"}]'::jsonb,
 '{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"}]}'::jsonb,
 '$ parts are validated against the stated deductible and always sum exactly (the other share auto-computes). Changing this clears both shares.',false,100),
('HORSE_LEASE_V2','TXN.MORT_DED_RESP_SPLIT_LESSOR','Deductible split — paid by Lessor','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MORT_DED_RESP_MODE"}]}'::jsonb,
 NULL,false,110),
('HORSE_LEASE_V2','TXN.MORT_DED_RESP_SPLIT_LESSEE','Deductible split — paid by Lessee','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MORT_DED_RESP_MODE"}]}'::jsonb,
 NULL,false,120),
('HORSE_LEASE_V2','TXN.MORT_DED_RESP_OTHER','Other deductible arrangement','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_DED_RESP"}]}'::jsonb,NULL,false,130),
-- Medical (NONE | COVERED)
('HORSE_LEASE_V2','TXN.MED_COVERAGE','Medical insurance','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'select','select','select',
 '[{"value":"NONE","label":"Not maintained — Lessor accepts risk"},{"value":"COVERED","label":"Covered — policy details below"}]'::jsonb,
 NULL,'Unset renders the not-maintained (Lessor accepts risk) option.',true,10),
('HORSE_LEASE_V2','TXN.MED_EFFECTIVE_DATE','Effective date no later than','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'date','date','date',NULL,
 '{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,NULL,false,20),
('HORSE_LEASE_V2','TXN.MED_LIMIT','Coverage limit','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,NULL,false,30),
('HORSE_LEASE_V2','TXN.MED_DEDUCTIBLE','Deductible','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'currency','currency','currency',NULL,
 '{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,NULL,false,40),
('HORSE_LEASE_V2','TXN.MED_PREM_RESP','Premium responsibility','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"},{"value":"SPLIT","label":"Split"},{"value":"OTHER","label":"Other"}]'::jsonb,
 '{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,NULL,false,50),
('HORSE_LEASE_V2','TXN.MED_PREM_RESP_SPLIT_LESSOR','Premium split — % paid by Lessor','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_PREM_RESP"}]}'::jsonb,
 'Percentage only. Auto-totals 100%.',false,60),
('HORSE_LEASE_V2','TXN.MED_PREM_RESP_SPLIT_LESSEE','Premium split — % paid by Lessee','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_PREM_RESP"}]}'::jsonb,
 'Percentage only. Auto-totals 100%.',false,70),
('HORSE_LEASE_V2','TXN.MED_PREM_RESP_OTHER','Other premium arrangement','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_PREM_RESP"}]}'::jsonb,NULL,false,80),
('HORSE_LEASE_V2','TXN.MED_DED_RESP','Deductible responsibility','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"},{"value":"SPLIT","label":"Split"},{"value":"OTHER","label":"Other"}]'::jsonb,
 '{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,NULL,false,90),
('HORSE_LEASE_V2','TXN.MED_DED_RESP_MODE','Deductible split entered as','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'select','select','select',
 '[{"value":"DOLLAR","label":"$ amount"},{"value":"PERCENT","label":"% percentage"}]'::jsonb,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"}]}'::jsonb,
 '$ parts are validated against the stated deductible and always sum exactly (the other share auto-computes). Changing this clears both shares.',false,100),
('HORSE_LEASE_V2','TXN.MED_DED_RESP_SPLIT_LESSOR','Deductible split — paid by Lessor','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MED_DED_RESP_MODE"}]}'::jsonb,
 NULL,false,110),
('HORSE_LEASE_V2','TXN.MED_DED_RESP_SPLIT_LESSEE','Deductible split — paid by Lessee','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"},{"equals":["DOLLAR","PERCENT"],"field_key":"TXN.MED_DED_RESP_MODE"}]}'::jsonb,
 NULL,false,120),
('HORSE_LEASE_V2','TXN.MED_DED_RESP_OTHER','Other deductible arrangement','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_DED_RESP"}]}'::jsonb,NULL,false,130),
('HORSE_LEASE_V2','TXN.MED_EXCESS_RESP','Excess-costs responsibility (optional)','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'select','select','select',
 '[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"},{"value":"SPLIT","label":"Split"},{"value":"OTHER","label":"Other"}]'::jsonb,
 '{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,
 'Veterinary costs exceeding the coverage limit. Leave unset to omit the sentence.',false,140),
('HORSE_LEASE_V2','TXN.MED_EXCESS_RESP_SPLIT_LESSOR','Excess split — % paid by Lessor','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_EXCESS_RESP"}]}'::jsonb,
 'Percentage only. Auto-totals 100%.',false,150),
('HORSE_LEASE_V2','TXN.MED_EXCESS_RESP_SPLIT_LESSEE','Excess split — % paid by Lessee','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_EXCESS_RESP"}]}'::jsonb,
 'Percentage only. Auto-totals 100%.',false,160),
('HORSE_LEASE_V2','TXN.MED_EXCESS_RESP_OTHER','Other excess-costs arrangement','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','LESSOR',
 'text','text',NULL,NULL,
 '{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_EXCESS_RESP"}]}'::jsonb,NULL,false,170)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, section=EXCLUDED.section, clause_key=EXCLUDED.clause_key,
      owner_role=EXCLUDED.owner_role, input_kind=EXCLUDED.input_kind, value_type=EXCLUDED.value_type,
      format_type=EXCLUDED.format_type, options=EXCLUDED.options, conditional_on=EXCLUDED.conditional_on,
      guidance=EXCLUDED.guidance, required=EXCLUDED.required, sort_order=EXCLUDED.sort_order;

-- ---- clauses ---------------------------------------------------------------
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES
-- General Liability
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_MAIN',NULL,
 E'Lessor {{TXN.GL_POSTURE}} general liability insurance covering the Horse and the activities contemplated by this Agreement.\n{{TXN.GL_DESCRIPTION}}',
 'input',160,false,'{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"}'::jsonb,false),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_DED_SIMPLE',NULL,
 'If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.GL_DED_RESP}}.',
 'input',162,false,'{"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.GL_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_DED_SPLITC',NULL,
 'If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, any deductible shall be split between the parties: {{TXN.GL_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.GL_DED_RESP_SPLIT_LESSEE}} paid by Lessee.',
 'input',164,false,'{"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["SPLIT"],"field_key":"TXN.GL_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_DED_OTHERC',NULL,
 'If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be handled as follows: {{TXN.GL_DED_RESP_OTHER}}.',
 'input',166,false,'{"all":[{"equals":["MAINTAINS","REQUIRES_WILL"],"field_key":"TXN.GL_POSTURE"},{"equals":["OTHER"],"field_key":"TXN.GL_DED_RESP"}]}'::jsonb,true),
-- Mortality
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_MAIN',NULL,
 'Lessor maintains, or shall obtain with an effective date no later than {{TXN.MORT_EFFECTIVE_DATE}}, mortality insurance on the Horse with a policy limit of {{TXN.MORT_LIMIT}} and a deductible of {{TXN.MORT_DEDUCTIBLE}}.',
 'input',210,false,'{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}'::jsonb,false),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_PREM_SIMPLE',NULL,
 'Responsibility for the policy premium: {{TXN.MORT_PREM_RESP}}.',
 'input',211,false,'{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MORT_PREM_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_PREM_SPLITC',NULL,
 'The policy premium shall be split between the parties: {{TXN.MORT_PREM_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_PREM_RESP_SPLIT_LESSEE}} paid by Lessee.',
 'input',212,false,'{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_PREM_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_PREM_OTHERC',NULL,
 'Responsibility for the policy premium: {{TXN.MORT_PREM_RESP_OTHER}}.',
 'input',213,false,'{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_PREM_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_DEDR_SIMPLE',NULL,
 'Responsibility for the deductible: {{TXN.MORT_DED_RESP}}.',
 'input',214,false,'{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MORT_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_DEDR_SPLITC',NULL,
 'The deductible shall be split between the parties: {{TXN.MORT_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_DED_RESP_SPLIT_LESSEE}} paid by Lessee.',
 'input',215,false,'{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["SPLIT"],"field_key":"TXN.MORT_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_DEDR_OTHERC',NULL,
 'Responsibility for the deductible: {{TXN.MORT_DED_RESP_OTHER}}.',
 'input',216,false,'{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["OTHER"],"field_key":"TXN.MORT_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_TAIL',NULL,
 'Any deductible shall be advanced by Lessor as policyholder and reimbursed by the responsible party or parties in accordance with the Payment Terms of this Agreement.',
 'input',218,false,'{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORT_NONE',NULL,
 'No mortality insurance is required under this Agreement.',
 'input',220,false,'{"equals":["NO",""],"field_key":"TXN.MORT_ELECTED"}'::jsonb,false),
-- Medical
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MEDICAL','Medical Insurance',
 '', 'input',300,false,NULL,false),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_NONE',NULL,
 'Lessor has elected not to maintain medical insurance on the Horse. Lessor accepts full risk and responsibility for any and all injury to or illness of the Horse during the term of this Agreement, including all costs of veterinary care arising from such injury or illness, except as otherwise expressly allocated in the Horse Care and Expenses section of this Agreement.',
 'input',305,false,'{"equals":["NONE",""],"field_key":"TXN.MED_COVERAGE"}'::jsonb,false),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_MAIN',NULL,
 'Lessor maintains, or shall obtain with an effective date no later than {{TXN.MED_EFFECTIVE_DATE}}, medical insurance on the Horse with a coverage limit of {{TXN.MED_LIMIT}} and a deductible of {{TXN.MED_DEDUCTIBLE}}.',
 'input',310,false,'{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,false),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_PREM_SIMPLE',NULL,
 'Responsibility for the policy premium: {{TXN.MED_PREM_RESP}}.',
 'input',311,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MED_PREM_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_PREM_SPLITC',NULL,
 'The policy premium shall be split between the parties: {{TXN.MED_PREM_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_PREM_RESP_SPLIT_LESSEE}} paid by Lessee.',
 'input',312,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_PREM_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_PREM_OTHERC',NULL,
 'Responsibility for the policy premium: {{TXN.MED_PREM_RESP_OTHER}}.',
 'input',313,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_PREM_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_DEDR_SIMPLE',NULL,
 'Responsibility for the deductible: {{TXN.MED_DED_RESP}}.',
 'input',314,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MED_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_DEDR_SPLITC',NULL,
 'The deductible shall be split between the parties: {{TXN.MED_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_DED_RESP_SPLIT_LESSEE}} paid by Lessee.',
 'input',315,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_DEDR_OTHERC',NULL,
 'Responsibility for the deductible: {{TXN.MED_DED_RESP_OTHER}}.',
 'input',316,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_DED_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_EXC_SIMPLE',NULL,
 'Responsibility for veterinary costs exceeding the coverage limit: {{TXN.MED_EXCESS_RESP}}.',
 'input',317,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["LESSOR","LESSEE"],"field_key":"TXN.MED_EXCESS_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_EXC_SPLITC',NULL,
 'Veterinary costs exceeding the coverage limit shall be split between the parties: {{TXN.MED_EXCESS_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_EXCESS_RESP_SPLIT_LESSEE}} paid by Lessee.',
 'input',318,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["SPLIT"],"field_key":"TXN.MED_EXCESS_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_EXC_OTHERC',NULL,
 'Responsibility for veterinary costs exceeding the coverage limit: {{TXN.MED_EXCESS_RESP_OTHER}}.',
 'input',319,false,'{"all":[{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"},{"equals":["OTHER"],"field_key":"TXN.MED_EXCESS_RESP"}]}'::jsonb,true),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MED_TAIL',NULL,
 'Any deductible or covered cost shall be advanced by Lessor as policyholder and reimbursed by the responsible party or parties in accordance with the Payment Terms of this Agreement. Lessor assumes and is responsible for all risks and costs not paid by the policy in the event the policy is not in effect, a claim is denied, or a cost is determined to be non-covered.',
 'input',320,false,'{"equals":["COVERED"],"field_key":"TXN.MED_COVERAGE"}'::jsonb,true),
-- Care, Custody and Control (entity-only) + Coordination
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.CCC','Care, Custody and Control Insurance',
 'Lessee shall obtain and maintain, for the duration of this Agreement, care, custody and control insurance covering the Horse while in Lessee''s care, custody, or control, with a death benefit limit of not less than the Horse''s current fair market value of {{HORSE.FAIR_MARKET_VALUE}}, effective no later than the commencement of this Agreement. Lessee shall provide proof of coverage to Lessor upon request and shall maintain the policy in good standing for the duration of this Agreement; failure to do so constitutes a material breach subject to the Termination for Cause provisions of this Agreement.',
 'prose',400,false,'{"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"}'::jsonb,false),
('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.COORDINATION','Coordination of Coverage',
 'Lessor bears responsibility for loss of, injury to, or death of the Horse, and Lessor''s mortality insurance shall be the first policy noticed and claimed against for any such covered event. Lessee''s care, custody and control insurance is secondary and shall respond only to the extent the loss was caused by Lessee''s gross negligence, reckless conduct, or intentional misconduct. Where a loss was so caused, Lessee shall bear the net cost of any applicable deductible and any uninsured portion of the loss, and the parties shall reimburse one another as necessary to give effect to this allocation regardless of the order in which the policies respond. Each party shall promptly notify its insurer of a covered event and shall cooperate in the submission and adjustment of claims. Absent a determination that Lessee so caused the loss, all deductibles and uninsured amounts remain Lessor''s responsibility.',
 'prose',450,false,'{"all":[{"equals":["YES"],"field_key":"TXN.MORT_ELECTED"},{"equals":["ENTITY"],"field_key":"LESSEE.PARTY_TYPE"}]}'::jsonb,false)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading=EXCLUDED.heading, body=EXCLUDED.body, clause_type=EXCLUDED.clause_type,
      sort_order=EXCLUDED.sort_order, conditional_on=EXCLUDED.conditional_on,
      render_as_subitem=EXCLUDED.render_as_subitem;

-- ============================================================================
-- PART 6 — Limitation of Liability: single unconditional FMV clause
-- ============================================================================
UPDATE contract_clause_defs
   SET clause_key='INSURANCE_RISK.LIMITATION', conditional_on=NULL
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.LIMITATION_FMV';

-- ============================================================================
-- PART 7 — Risk of Loss harmonization
-- ============================================================================
UPDATE contract_clause_defs SET body =
'Lessor assumes all risk of loss of or injury to the Horse during the term of this Agreement, except to the extent caused by Lessee''s gross negligence, reckless conduct, or intentional misconduct.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.RISK_OF_LOSS';

-- ============================================================================
-- PART 8 — Termination fixes
-- ============================================================================
UPDATE contract_clause_defs SET body = replace(body,
 'Payments exceeding 1 calendar month in past-due status shall void the Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.',
 'Payments exceeding 1 calendar month in past-due status constitute grounds for termination for cause under the Termination for Cause provisions of this Agreement unless prior written acceptance of the delay is provided by the party to whom the payment is owed.')
WHERE template_key='HORSE_LEASE_V2' AND clause_key='PAYMENT_TERMS.LATE';

UPDATE contract_clause_defs SET body =
'This Agreement shall self-terminate if the Horse is significantly injured or seriously ill as determined by a licensed veterinarian, or dies. Lessee is entitled to a prorated refund of Lease Fee paid for the remaining time unused at the time of self-termination. In the event Lessee is found to have caused, through gross negligence, reckless conduct, or intentional misconduct, the injury, illness, or death, Lessor may retain the unused portion of the paid Lease Fee.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='TERMINATION.LOSS';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.SURVIVAL','Survival',
   'The releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement, and any payment obligations accrued before termination, survive the expiration or termination of this Agreement for any reason.',
   'prose',50,false,NULL)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading=EXCLUDED.heading, body=EXCLUDED.body, sort_order=EXCLUDED.sort_order;

-- ============================================================================
-- PART 9 — Purpose dropdown + neutral fallback
-- ============================================================================
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role,
   input_kind, value_type, format_type, options, conditional_on, guidance, required, sort_order)
VALUES
  ('HORSE_LEASE_V2','TXN.LEASE_PURPOSE','Purpose of the lease','PURPOSE','PURPOSE.RECREATION','DEAL',
   'select','select','select',
   '[{"value":"RECREATIONAL","label":"recreational"},{"value":"INSTRUCTIONAL","label":"instructional"},{"value":"COMPETITION","label":"competition"},{"value":"COMMERCIAL","label":"commercial program"}]'::jsonb,
   NULL,'Unset renders the neutral "For the purposes permitted herein" phrasing.',false,5)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET options=EXCLUDED.options, guidance=EXCLUDED.guidance, clause_key=EXCLUDED.clause_key, sort_order=EXCLUDED.sort_order;

UPDATE contract_clause_defs SET
  body = 'For {{TXN.LEASE_PURPOSE}} purposes, Lessee wishes to ride and/or handle Lessor''s horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor''s horse in exchange for the consideration described herein.',
  conditional_on = '{"equals":["RECREATIONAL","INSTRUCTIONAL","COMPETITION","COMMERCIAL"],"field_key":"TXN.LEASE_PURPOSE"}'::jsonb
WHERE template_key='HORSE_LEASE_V2' AND clause_key='PURPOSE.RECREATION';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','PURPOSE','PURPOSE.RECREATION_DEFAULT','Purpose of Agreement',
   'For the purposes permitted herein, Lessee wishes to ride and/or handle Lessor''s horse, and Lessor agrees to allow Lessee to ride and/or handle Lessor''s horse in exchange for the consideration described herein.',
   'input',12,false,'{"equals":[""],"field_key":"TXN.LEASE_PURPOSE"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;

-- ============================================================================
-- PART 10 — Evaluation Period restructure (nonrefundable; INCLUDED | FIXED)
-- ============================================================================
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role,
   input_kind, value_type, format_type, options, conditional_on, guidance, required, sort_order)
VALUES
  ('HORSE_LEASE_V2','TXN.EVALUATION_FEE_MODE','Evaluation period fee','EVALUATION','EVALUATION.CHOICE','LESSOR',
   'select','select','select',
   '[{"value":"INCLUDED","label":"Included at no separate charge"},{"value":"FIXED","label":"Fixed fee"}]'::jsonb,
   '{"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"}'::jsonb,
   'Unset renders as included at no separate charge.',false,30),
  ('HORSE_LEASE_V2','TXN.EVALUATION_FEE_AMOUNT','Evaluation fee amount','EVALUATION','EVALUATION.CHOICE','LESSOR',
   'currency','currency','currency',NULL,
   '{"all":[{"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"},{"equals":["FIXED"],"field_key":"TXN.EVALUATION_FEE_MODE"}]}'::jsonb,
   NULL,false,40)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET options=EXCLUDED.options, conditional_on=EXCLUDED.conditional_on,
      guidance=EXCLUDED.guidance, clause_key=EXCLUDED.clause_key, sort_order=EXCLUDED.sort_order;

DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EVALUATION.DATES';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','EVALUATION','EVALUATION.DATES_INCLUDED','Evaluation Period',
   'Lessee shall have an evaluation period of {{TXN.EVALUATION_LENGTH}} {{TXN.EVALUATION_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is included at no separate charge, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.',
   'input',20,false,
   '{"all":[{"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"},{"equals":["INCLUDED",""],"field_key":"TXN.EVALUATION_FEE_MODE"}]}'::jsonb),
  ('HORSE_LEASE_V2','EVALUATION','EVALUATION.DATES_FIXED','Evaluation Period',
   'Lessee shall have an evaluation period of {{TXN.EVALUATION_LENGTH}} {{TXN.EVALUATION_UNIT}} beginning on the date this Agreement is fully signed by both parties. The evaluation period fee is {{TXN.EVALUATION_FEE_AMOUNT}}, is earned upon commencement of the evaluation period, and is nonrefundable. Either party may terminate this Agreement during the evaluation period by written notice to the other party. Upon such termination, any per-use or lease fees for usage that occurred remain due, and neither party owes the other any further amount under this Agreement except amounts already accrued.',
   'input',21,false,
   '{"all":[{"contains":["REQUESTED","REQUIRED"],"field_key":"TXN.EVALUATION_ENABLED"},{"equals":["FIXED"],"field_key":"TXN.EVALUATION_FEE_MODE"}]}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;

-- ============================================================================
-- PART 11 — wording batch
-- ============================================================================
UPDATE contract_clause_defs SET body = replace(body,
 'Only persons listed as parties to this contract and shown above shall be permitted to ride or handle the Horse without Lessor''s written permission.',
 'Only the persons identified above shall be permitted to ride or handle the Horse without Lessor''s written permission.')
WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHERS';

UPDATE contract_field_defs SET label='Reserved days of use'
WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.DAYS_USED';

-- ============================================================================
-- Composer fix: an inline continuation must append to the last NON-BLANK line
-- (a second consecutive sub-item previously landed on a blank separator line)
-- ============================================================================
DO $MIG$
DECLARE v_src text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='remerge_contract_from_clauses';
  IF v_src LIKE '%WHILE v_sub_no >= 1%' THEN RETURN; END IF;
  v_new := regexp_replace(v_src,
    $P$IF coalesce\(array_length\(v_sec_buf,1\),0\) >= 2 AND v_sec_buf\[array_upper\(v_sec_buf,1\)\] = '' THEN(\s+)v_sec_buf\[array_upper\(v_sec_buf,1\)-1\] := v_sec_buf\[array_upper\(v_sec_buf,1\)-1\] \|\| ' ' \|\| array_to_string\(v_cl_buf, ' '\);$P$,
    $R$v_sub_no := coalesce(array_upper(v_sec_buf,1),0);\1WHILE v_sub_no >= 1 AND v_sec_buf[v_sub_no] = '' LOOP v_sub_no := v_sub_no - 1; END LOOP;\1IF v_sub_no >= 1 THEN\1  v_sec_buf[v_sub_no] := v_sec_buf[v_sub_no] || ' ' || array_to_string(v_cl_buf, ' ');$R$);
  IF v_new = v_src THEN RAISE EXCEPTION 'composer inline-append anchor not found'; END IF;
  EXECUTE v_new;
END $MIG$;

-- ============================================================================
-- Trigger v3: new key scheme, FMV validation, $-split exact-sum enforcement
-- ============================================================================
CREATE OR REPLACE FUNCTION contract_split_deductible_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_base text;
  v_counterpart text;
  v_mode text;
  v_anchor_key text;
  v_anchor text;
  v_n numeric;
  v_d numeric;
  v_fmv numeric;
  v_self text;
  v_other text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- coverage toggles: clear the block's dependent fields when switched off
  IF NEW.field_key = 'TXN.MORT_ELECTED' AND coalesce(NEW.value,'') <> 'YES'
     AND NEW.value IS DISTINCT FROM OLD.value THEN
    UPDATE contract_fields SET value=''
     WHERE document_id=NEW.document_id AND field_key LIKE 'TXN.MORT\_%'
       AND field_key <> 'TXN.MORT_ELECTED' AND coalesce(value,'') <> '';
    RETURN NEW;
  END IF;
  IF NEW.field_key = 'TXN.MED_COVERAGE' AND coalesce(NEW.value,'') <> 'COVERED'
     AND NEW.value IS DISTINCT FROM OLD.value THEN
    UPDATE contract_fields SET value=''
     WHERE document_id=NEW.document_id AND field_key LIKE 'TXN.MED\_%'
       AND field_key <> 'TXN.MED_COVERAGE' AND coalesce(value,'') <> '';
    RETURN NEW;
  END IF;

  -- mortality limit: must be >= the horse's fair market value
  IF NEW.field_key = 'TXN.MORT_LIMIT' AND coalesce(NEW.value,'') <> '' THEN
    BEGIN
      v_n := nullif(regexp_replace(NEW.value, '[^0-9.]', '', 'g'), '')::numeric;
      SELECT nullif(regexp_replace(coalesce(value,''), '[^0-9.]', '', 'g'), '')::numeric
        INTO v_fmv FROM contract_fields
       WHERE document_id=NEW.document_id AND field_key='HORSE.FAIR_MARKET_VALUE';
    EXCEPTION WHEN others THEN
      v_n := NULL; v_fmv := NULL;
    END;
    IF v_n IS NOT NULL AND v_fmv IS NOT NULL AND v_n < v_fmv THEN
      RAISE EXCEPTION 'Mortality policy limit (%) must be at least the Horse''s fair market value (%)',
        NEW.value, to_char(v_fmv, 'FM$999,999,990.00');
    END IF;
    RETURN NEW;
  END IF;

  -- stated deductible changed: recompute an active $-split against the new amount
  IF NEW.field_key IN ('TXN.MORT_DEDUCTIBLE','TXN.MED_DEDUCTIBLE')
     AND NEW.value IS DISTINCT FROM OLD.value THEN
    v_base := replace(NEW.field_key, '_DEDUCTIBLE', '') || '_DED_RESP';
    SELECT value INTO v_mode FROM contract_fields
     WHERE document_id=NEW.document_id AND field_key = v_base || '_MODE';
    IF v_mode = 'DOLLAR' THEN
      UPDATE contract_fields SET value=''
       WHERE document_id=NEW.document_id
         AND field_key IN (v_base || '_SPLIT_LESSOR', v_base || '_SPLIT_LESSEE')
         AND coalesce(value,'') <> '';
    END IF;
    RETURN NEW;
  END IF;

  -- responsibility selection changed: clear children that no longer apply
  IF NEW.field_key ~ '_RESP$' THEN
    IF NEW.value IS DISTINCT FROM OLD.value THEN
      IF coalesce(NEW.value,'') <> 'SPLIT' THEN
        UPDATE contract_fields SET value=''
         WHERE document_id=NEW.document_id
           AND field_key IN (NEW.field_key || '_MODE', NEW.field_key || '_SPLIT_LESSOR', NEW.field_key || '_SPLIT_LESSEE')
           AND coalesce(value,'') <> '';
      END IF;
      IF coalesce(NEW.value,'') <> 'OTHER' THEN
        UPDATE contract_fields SET value=''
         WHERE document_id=NEW.document_id
           AND field_key = NEW.field_key || '_OTHER' AND coalesce(value,'') <> '';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- mode change: clear both shares for fresh entry
  IF NEW.field_key ~ '_RESP_MODE$' THEN
    IF NEW.value IS DISTINCT FROM OLD.value THEN
      v_base := regexp_replace(NEW.field_key, '_MODE$', '');
      UPDATE contract_fields SET value=''
       WHERE document_id=NEW.document_id
         AND field_key IN (v_base || '_SPLIT_LESSOR', v_base || '_SPLIT_LESSEE')
         AND coalesce(value,'') <> '';
    END IF;
    RETURN NEW;
  END IF;

  -- share entry: normalize + auto-fill counterpart. $-anchored groups
  -- (mortality/medical deductible) resolve mode from _RESP_MODE; all other
  -- groups are %-only.
  IF NEW.field_key !~ '_RESP_SPLIT_(LESSOR|LESSEE)$' THEN RETURN NEW; END IF;
  IF coalesce(NEW.value,'') = '' OR NEW.value IS NOT DISTINCT FROM OLD.value THEN
    RETURN NEW;
  END IF;
  v_base := regexp_replace(NEW.field_key, '_SPLIT_(LESSOR|LESSEE)$', '');
  v_counterpart := CASE WHEN NEW.field_key LIKE '%_LESSOR'
                        THEN v_base || '_SPLIT_LESSEE' ELSE v_base || '_SPLIT_LESSOR' END;

  v_anchor_key := CASE v_base
                    WHEN 'TXN.MORT_DED_RESP' THEN 'TXN.MORT_DEDUCTIBLE'
                    WHEN 'TXN.MED_DED_RESP'  THEN 'TXN.MED_DEDUCTIBLE'
                    ELSE NULL END;
  IF v_anchor_key IS NOT NULL THEN
    SELECT value INTO v_mode FROM contract_fields
     WHERE document_id=NEW.document_id AND field_key = v_base || '_MODE';
  ELSE
    v_mode := 'PERCENT';
  END IF;

  BEGIN
    v_n := nullif(regexp_replace(NEW.value, '[^0-9.]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN
    v_n := NULL;
  END;
  IF v_n IS NULL THEN RETURN NEW; END IF;

  IF v_mode = 'PERCENT' THEN
    IF v_n < 0 OR v_n > 100 THEN
      RAISE EXCEPTION 'A percentage share must be between 0 and 100 (got %)', NEW.value;
    END IF;
    v_self  := to_char(v_n, 'FM990.##') || '%';
    v_other := to_char(100 - v_n, 'FM990.##') || '%';
  ELSIF v_mode = 'DOLLAR' THEN
    SELECT value INTO v_anchor FROM contract_fields
     WHERE document_id=NEW.document_id AND field_key = v_anchor_key;
    BEGIN
      v_d := nullif(regexp_replace(coalesce(v_anchor,''), '[^0-9.]', '', 'g'), '')::numeric;
    EXCEPTION WHEN others THEN
      v_d := NULL;
    END;
    IF v_d IS NULL THEN RETURN NEW; END IF;
    IF v_n > v_d THEN
      RAISE EXCEPTION 'A $ share (%) cannot exceed the stated deductible (%)',
        NEW.value, to_char(v_d, 'FM$999,999,990.00');
    END IF;
    v_self  := to_char(v_n, 'FM$999,999,990.00');
    v_other := to_char(v_d - v_n, 'FM$999,999,990.00');
  ELSE
    RETURN NEW; -- no mode chosen yet
  END IF;

  IF v_self IS DISTINCT FROM NEW.value THEN
    UPDATE contract_fields SET value = v_self
     WHERE document_id=NEW.document_id AND field_key = NEW.field_key;
  END IF;
  UPDATE contract_fields SET value = v_other
   WHERE document_id=NEW.document_id AND field_key = v_counterpart
     AND value IS DISTINCT FROM v_other;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS contract_fields_split_sync ON contract_fields;
CREATE TRIGGER contract_fields_split_sync
AFTER UPDATE OF value ON contract_fields
FOR EACH ROW
WHEN (NEW.field_key LIKE 'TXN.MORT%' OR NEW.field_key LIKE 'TXN.MED%' OR NEW.field_key LIKE 'TXN.GL%')
EXECUTE FUNCTION contract_split_deductible_sync();

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
DECLARE v_n int;
BEGIN
  -- no "major medical" anywhere in the template
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2'
     AND (coalesce(heading,'') ILIKE '%major medical%' OR coalesce(body,'') ILIKE '%major medical%');
  IF v_n <> 0 THEN RAISE EXCEPTION '"major medical" survives in % clauses', v_n; END IF;
  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2'
     AND (label ILIKE '%major medical%' OR field_key LIKE 'TXN.MAJOR_MEDICAL%');
  IF v_n <> 0 THEN RAISE EXCEPTION '"major medical" survives in % fields', v_n; END IF;

  -- limitation: single, unconditional
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE 'INSURANCE_RISK.LIMITATION%';
  IF v_n <> 1 THEN RAISE EXCEPTION 'expected exactly 1 limitation clause, found %', v_n; END IF;
  IF EXISTS (SELECT 1 FROM contract_clause_defs
              WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.LIMITATION'
                AND conditional_on IS NOT NULL) THEN
    RAISE EXCEPTION 'limitation clause still conditional';
  END IF;

  -- no must-obtain variants remain
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND section_key='INSURANCE_RISK'
     AND body ILIKE '%requires Lessee to obtain%' AND clause_key <> 'INSURANCE_RISK.CCC';
  IF v_n <> 0 THEN RAISE EXCEPTION 'must-obtain variant survives (% clauses)', v_n; END IF;

  -- structural counts
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2'
     AND clause_key IN ('INSURANCE_RISK.CCC','INSURANCE_RISK.COORDINATION',
                        'PERMITTED_USE.RELEASES_REQUIRED','TERMINATION.SURVIVAL',
                        'LESSEE_REPS.MAIN_INDIVIDUAL','LESSEE_REPS.MAIN_ENTITY',
                        'PURPOSE.RECREATION_DEFAULT','EVALUATION.DATES_INCLUDED','EVALUATION.DATES_FIXED');
  IF v_n <> 9 THEN RAISE EXCEPTION 'expected 9 new clauses, found %', v_n; END IF;

  IF EXISTS (SELECT 1 FROM contract_clause_defs
              WHERE template_key='HORSE_LEASE_V2' AND clause_key IN ('LESSEE_REPS.MAIN','EVALUATION.DATES')) THEN
    RAISE EXCEPTION 'superseded clauses not removed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM contract_field_defs
                  WHERE template_key='HORSE_LEASE_V2' AND field_key='LESSEE.PARTY_TYPE') THEN
    RAISE EXCEPTION 'LESSEE.PARTY_TYPE missing';
  END IF;
  IF (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='fill_party_fields_from_contacts')
     NOT LIKE '%PARTY_TYPE%' THEN
    RAISE EXCEPTION 'party-type derivation not wired';
  END IF;
END $$;

COMMIT;
