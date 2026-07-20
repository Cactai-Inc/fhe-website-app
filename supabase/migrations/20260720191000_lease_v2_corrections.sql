/*
  # Lease v2 corrections — restore selectable clauses/fields lost in transcription

  Fixes the SELECTABLE-content deviations found in the ELS audit. Anything that
  imposes AUTOMATIC (non-selectable) cost/reimbursement/damages liability on one
  party for another is deliberately NOT included here — those are held for owner
  review (see review_liability_copy.txt). This migration only restores choices,
  escapes, and missing selectable fields/clauses.

  All bodies are UTF-8; apply with PGCLIENTENCODING=UTF8.
*/

-- ── Item 1 · §3.2 Vet Check Option — a SELECTABLE responsibility clause ──────
-- ELS puts the exam cost on the Lessee; per owner direction this is instead a
-- selectable "who is responsible" choice (party), plus the recommendation prose.
-- NOTE: the ELS "Lessee agrees to assume such risk" liability line is HELD FOR
-- REVIEW and intentionally omitted here.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance)
VALUES ('HORSE_LEASE_V2','HORSE','HORSE.VET_CHECK','Pre-Lease Veterinary Examination',
  E'Owner strongly recommends that, prior to entering into this Agreement, an independent equine veterinarian examine Horse and advise on Horse''s health, soundness, and fitness for Lessee''s intended use. Responsibility for arranging and paying for any such examination: {{TXN.VET_CHECK_RESPONSIBILITY}}.',
  'input', 25,
  'ELS recommends a pre-lease vet exam. Choose who arranges and pays for it (the ELS default is the Lessee, but this is a selectable term).')
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance, responsibility_kind)
VALUES ('HORSE_LEASE_V2','HORSE','HORSE.VET_CHECK','TXN.VET_CHECK_RESPONSIBILITY','Vet-check responsibility','DEAL','text','responsibility','party',NULL,false,10,
  'Who arranges and pays for the optional pre-lease vet exam.','financial')
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ── §16.8 Indemnification — remove the non-ELS "Mutual" option ───────────────
-- ELS offers a check-ONE between the two directional indemnities (no "Mutual").
-- The indemnification SUBSTANCE (an automatic liability allocation) is held for
-- review; here we only correct the SELECTION SET to match ELS's two options.
UPDATE contract_field_defs
   SET options = '[{"value":"LESSEE_INDEMNIFIES_OWNER","label":"Lessee indemnifies Owner"},{"value":"OWNER_INDEMNIFIES_LESSEE","label":"Owner indemnifies Lessee"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.INDEMNIFICATION';


-- ── §7 Permitted Use — restore ELS's "Other" and drop non-ELS extras ────────
-- ELS list: Recreational riding / Trail riding / Show or competition / 4-H /
-- Other. Digital had added Lessons + Turnout (not in ELS) and lost "Other".
UPDATE contract_field_defs
   SET options = '[{"value":"RECREATIONAL","label":"Recreational riding"},{"value":"TRAIL","label":"Trail riding"},{"value":"COMPETITION","label":"Show or competition"},{"value":"4H","label":"4-H project"},{"value":"OTHER","label":"Other (specify below)"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.PERMITTED_ACTIVITIES';
-- a free-text companion for the "Other" permitted use
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance)
VALUES ('HORSE_LEASE_V2','PERMITTED_USE','PERMITTED_USE.MAIN','TXN.PERMITTED_OTHER','Other permitted use','DEAL','text','text','text',NULL,false,20,'Describe any other permitted use.')
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ── §17.3 Jumping — add the "who may jump" field + "Other" restriction ───────
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, conditional_on, required, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMP_RESTRICTIONS','TXN.JUMP_WHO','Who may jump Horse','DEAL','text','text','text',NULL,
    '{"field_key":"TXN.JUMPING_ALLOWED","equals":["RESTRICTED"]}'::jsonb,false,5,'Named person(s) permitted to jump Horse, if restricted.'),
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMP_RESTRICTIONS','TXN.JUMP_OTHER','Other jumping restriction','DEAL','text','text','text',NULL,
    '{"field_key":"TXN.JUMPING_ALLOWED","equals":["RESTRICTED"]}'::jsonb,false,40,'Any other jumping restriction.')
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ── §13.5 Other Care — add the preferred-provider contact block ─────────────
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance)
VALUES ('HORSE_LEASE_V2','CARE','CARE.OTHER','HORSE.OTHER_CARE_PROVIDER','Preferred other-care provider','LESSOR','text','contact','contact',NULL,false,30,'Type of care, business, provider, address, phone, email, website — captured once, reusable.')
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ── §13.6.2 / §13.7 provider — add "Horse's trainer" as a provider option ───
-- These are PROVIDER fields (who supplies equipment/tack), distinct from the
-- care-arranger party model. ELS lists Owner / Lessee / Horse's trainer / Other.
-- Convert them from the party picker to an explicit select with the ELS options.
UPDATE contract_field_defs
   SET format_type='select', input_kind='select', value_type='select', responsibility_kind=NULL,
       options='[{"value":"OWNER","label":"Owner"},{"value":"LESSEE","label":"Lessee"},{"value":"TRAINER","label":"Horse''s trainer"},{"value":"OTHER","label":"Other (specify)"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key IN ('TXN.PROTECTIVE_PROVIDER','TXN.TACK_PROVIDER');


-- ── §13.7 Tack — restore the good-condition/fit lead-in prose ───────────────
UPDATE contract_clause_defs
   SET body = E'When riding and handling Horse, Lessee shall use only tack in good condition that is properly fitted to Horse. Required tack, and any specific saddle, pad, bit, or bridle: {{TXN.TACK_REQUIRED}}. The tack and equipment shall be provided by {{TXN.TACK_PROVIDER}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.TACK';


-- ── §16.1.1-3 Insurance — add "provide proof within N days" + "Other" obtainer ─
-- Selectable/data fields (not liability). Obtainer options gain "Other".
UPDATE contract_field_defs
   SET options='[{"value":"LESSEE","label":"Lessee obtains it"},{"value":"OWNER","label":"Owner obtains it"},{"value":"OTHER","label":"Other (specify)"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key IN ('TXN.MORTALITY_INSURANCE_OBTAINER','TXN.MAJOR_MEDICAL_OBTAINER','TXN.LOSS_OF_USE_OBTAINER');
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, conditional_on, required, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','TXN.MORTALITY_PROOF_DAYS','Days to provide proof of insurance','DEAL','number','number','number',NULL,'{"field_key":"TXN.MORTALITY_INSURANCE_REQ","equals":["YES"]}'::jsonb,false,30,NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','TXN.MAJOR_MEDICAL_PROOF_DAYS','Days to provide proof of insurance','DEAL','number','number','number',NULL,'{"field_key":"TXN.MAJOR_MEDICAL_INSURANCE_REQ","equals":["YES"]}'::jsonb,false,30,NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.LOSS_OF_USE','TXN.LOSS_OF_USE_PROOF_DAYS','Days to provide proof of insurance','DEAL','number','number','number',NULL,'{"field_key":"TXN.LOSS_OF_USE_INSURANCE_REQ","equals":["YES"]}'::jsonb,false,30,NULL)
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ── §10.2 — add the "beginning with [month/year]" first-payment field ────────
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, conditional_on, required, sort_order, guidance)
VALUES ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.PAYMENTS','TXN.MONTHLY_START','First monthly payment date','DEAL','date','date','date',NULL,'{"field_key":"TXN.LEASE_FEE_TYPE","equals":["FEE"]}'::jsonb,false,25,'The month the recurring payments begin.')
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ── §9.1 Schedule Changes — restore the (selectable-free) writing-requirement ─
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance)
VALUES ('HORSE_LEASE_V2','SCHEDULE','SCHEDULE.CHANGES','Schedule Changes',
  E'From time to time, Lessee and Owner may mutually agree to change the days of Lessee''s usage of Horse. To avoid misunderstandings, any such changes must be agreed upon in writing.',
  'prose', 15, NULL)
ON CONFLICT (template_key, clause_key) DO NOTHING;
