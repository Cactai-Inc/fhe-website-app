-- HORSE_LEASE_V2 — §11 Horse Care & Expenses rebuild, §12 removal, §13 insurance/
-- risk/indemnification rewrite, §14/16/18/19 edits. (2026-07-21 batch.)

-- ── §11: rename CARE → "Horse Care and Expenses"; add an intro clause. ──────────
UPDATE contract_section_defs SET heading='Horse Care and Expenses'
 WHERE template_key='HORSE_LEASE_V2' AND section_key='CARE';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'CARE', 'CARE.INTRO', NULL,
   'Horse care and expenses shall be managed and paid for by the responsible party as listed below.',
   'prose', 5, false, NULL);

-- ── 11.1 Medications & supplements → a repeatable builder. ─────────────────────
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.SUPPLEMENTS','TXN.SUPPLEMENTS_ADMIN');
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.MEDICATIONS', 'Medications and supplements', 'CARE', 'LESSOR',
   'med_schedule', 'text',
   'Add each medication or supplement with its dose, schedule, and the party responsible for ordering, administering, and its cost.',
   false, false, 10, 'med_schedule', 'CARE.SUPPLEMENTS');
UPDATE contract_clause_defs SET body='{{TXN.MEDICATIONS}}', heading=NULL
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.SUPPLEMENTS';

-- ── 11.2 Farrier + 11.3 Vet: arranging + costs dropdowns (Lessor/Lessee/Trainer-
--    Instructor/Boarding Staff[/Veterinarian]/Other). Replace responsibility
--    fields with plain selects that carry an "Other" free-text escape.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.FARRIER_ARRANGE','TXN.ROUTINE_VET_ARRANGE','TXN.NONROUTINE_VET_ARRANGE',
                    'TXN.OTHER_CARE_ARRANGE','TXN.OTHER_CARE_TYPES','HORSE.OTHER_CARE_PROVIDER');

-- farrier
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, options, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.FARRIER_ARRANGE', 'Party responsible for arranging', 'CARE', 'LESSOR',
   'select', 'select',
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]'::jsonb,
   NULL, false, false, 10, 'select', 'CARE.FARRIER'),
  ('HORSE_LEASE_V2', 'TXN.FARRIER_COST_PARTY', 'Party responsible for costs', 'CARE', 'LESSOR',
   'select', 'select',
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]'::jsonb,
   NULL, false, false, 20, 'select', 'CARE.FARRIER'),
  ('HORSE_LEASE_V2', 'TXN.VET_ARRANGE', 'Party responsible for arranging', 'CARE', 'LESSOR',
   'select', 'select',
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]'::jsonb,
   NULL, false, false, 10, 'select', 'CARE.ROUTINE_VET'),
  ('HORSE_LEASE_V2', 'TXN.VET_COST_PARTY', 'Party responsible for costs', 'CARE', 'LESSOR',
   'select', 'select',
   '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Trainer/Instructor","value":"TRAINER"},{"label":"Boarding Staff","value":"BOARDING"},{"label":"Other","value":"OTHER"}]'::jsonb,
   NULL, false, false, 20, 'select', 'CARE.ROUTINE_VET');

UPDATE contract_clause_defs
   SET heading='Farrier Care',
       body='Party responsible for arranging: {{TXN.FARRIER_ARRANGE}}
Party responsible for costs: {{TXN.FARRIER_COST_PARTY}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.FARRIER';
UPDATE contract_clause_defs
   SET heading='Veterinary Care',
       body='Party responsible for arranging: {{TXN.VET_ARRANGE}}
Party responsible for costs: {{TXN.VET_COST_PARTY}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.ROUTINE_VET';

-- ── Remove 11.4 (non-routine vet), 11.5 (other care), 11.8 (restraints).
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2'
  AND clause_key IN ('CARE.NONROUTINE_VET','CARE.OTHER','CARE.RESTRAINTS');
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.RESTRAINTS');

-- ── 11.6 Protective: drop cattle-work + speed-events; equipment provided by Lessor.
UPDATE contract_field_defs
   SET options='[{"label":"Turnouts","value":"TURNOUTS"},{"label":"Longeing / ground work","value":"LONGEING"},{"label":"Riding","value":"RIDING"},{"label":"Jumping","value":"JUMPING"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.PROTECTIVE_ACTIVITIES';
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.PROTECTIVE_PROVIDER';
UPDATE contract_clause_defs
   SET body='During the following activities: {{TXN.PROTECTIVE_ACTIVITIES}}, Horse shall wear the following protective equipment: {{TXN.PROTECTIVE_EQUIPMENT}}. The protective equipment shall be provided by Lessor.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.PROTECTIVE';

-- ── 11.7 Tack: inverse — Lessor lists prohibited items.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key IN ('TXN.TACK_REQUIRED','TXN.TACK_PROVIDER');
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.TACK_PROHIBITED', 'Prohibited tack and equipment', 'CARE', 'LESSOR',
   'longtext', 'longtext', 'List any tack or equipment the Lessee is prohibited from using.',
   false, false, 10, 'longtext', 'CARE.TACK');
UPDATE contract_clause_defs
   SET body='When riding and handling Horse, Lessee shall use only tack in good condition that is properly fitted to Horse. Lessee is prohibited from using these items: {{TXN.TACK_PROHIBITED}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.TACK';

-- ── 11.9 Rider aids: remove Spurs.
UPDATE contract_field_defs
   SET options='[{"label":"Crop or bat","value":"CROP"},{"label":"Longe whip","value":"LONGE_WHIP"},{"label":"Dressage whip","value":"DRESSAGE_WHIP"},{"label":"Other","value":"OTHER"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.RIDER_AIDS';

-- ── §12 Expenses: removed entirely (now under §11).
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND section_key='EXPENSES';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2' AND section='EXPENSES';
DELETE FROM contract_section_defs WHERE template_key='HORSE_LEASE_V2' AND section_key='EXPENSES';

-- ── §13 Insurance 13.2–13.4: "Lessee required to obtain, at their expense, <type>
--    with the following minimum limit [$]" behind a Lessor checkbox (hidden until
--    checked). The checkbox (REQ yes/no) sits alone; text+limit show when YES.
--    Reuse the existing *_INSURANCE_REQ yes/no as the enabling checkbox.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.MORTALITY_INSURANCE_OBTAINER','TXN.MAJOR_MEDICAL_OBTAINER','TXN.LOSS_OF_USE_OBTAINER',
                    'TXN.MORTALITY_PROOF_DAYS','TXN.MAJOR_MEDICAL_PROOF_DAYS','TXN.LOSS_OF_USE_PROOF_DAYS');
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.MORTALITY_MIN_LIMIT', 'Minimum limit', 'INSURANCE_RISK', 'LESSOR',
   'currency', 'currency', NULL, false, false, 22, 'currency', 'INSURANCE_RISK.MORTALITY'),
  ('HORSE_LEASE_V2', 'TXN.MAJOR_MEDICAL_MIN_LIMIT', 'Minimum limit', 'INSURANCE_RISK', 'LESSOR',
   'currency', 'currency', NULL, false, false, 32, 'currency', 'INSURANCE_RISK.MAJOR_MEDICAL'),
  ('HORSE_LEASE_V2', 'TXN.LOSS_OF_USE_MIN_LIMIT', 'Minimum limit', 'INSURANCE_RISK', 'LESSOR',
   'currency', 'currency', NULL, false, false, 42, 'currency', 'INSURANCE_RISK.LOSS_OF_USE');

-- the REQ yes/no becomes the "enable" checkbox on its own gate clause; the
-- required-obtain sentence + limit live on a gated follow-on clause.
UPDATE contract_clause_defs SET body='', heading='Mortality Insurance'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MORTALITY';
UPDATE contract_clause_defs SET body='', heading='Major Medical Insurance'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MAJOR_MEDICAL';
UPDATE contract_clause_defs SET body='', heading='Loss of Use Insurance'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.LOSS_OF_USE';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.MORTALITY_REQ', NULL,
   'Lessee is required to obtain, at their expense, mortality insurance on Horse with the following minimum limit: {{TXN.MORTALITY_MIN_LIMIT}}.',
   'input', 22, false, '{"field_key":"TXN.MORTALITY_INSURANCE_REQ","equals":["YES"]}'::jsonb),
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.MAJOR_MEDICAL_REQ', NULL,
   'Lessee is required to obtain, at their expense, major medical insurance on Horse with the following minimum limit: {{TXN.MAJOR_MEDICAL_MIN_LIMIT}}.',
   'input', 32, false, '{"field_key":"TXN.MAJOR_MEDICAL_INSURANCE_REQ","equals":["YES"]}'::jsonb),
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.LOSS_OF_USE_REQ', NULL,
   'Lessee is required to obtain, at their expense, loss of use insurance on Horse with the following minimum limit: {{TXN.LOSS_OF_USE_MIN_LIMIT}}.',
   'input', 42, false, '{"field_key":"TXN.LOSS_OF_USE_INSURANCE_REQ","equals":["YES"]}'::jsonb);

-- relabel the enabling yes/no checkboxes to read as an enable action
UPDATE contract_field_defs SET label='Require mortality insurance?'      WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.MORTALITY_INSURANCE_REQ';
UPDATE contract_field_defs SET label='Require major medical insurance?'  WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.MAJOR_MEDICAL_INSURANCE_REQ';
UPDATE contract_field_defs SET label='Require loss of use insurance?'    WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.LOSS_OF_USE_INSURANCE_REQ';

-- ── 13.5 risk of loss → Lessor assumes all risk.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.RISK_ALLOCATION';
UPDATE contract_clause_defs
   SET body='Lessor assumes all risk of loss or injury to Horse during the term of this Agreement.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.RISK_OF_LOSS';

-- ── 13.7 release: add "handle or" before "ride the Horse"; remove Lessor name.
UPDATE contract_clause_defs
   SET body='In consideration for being permitted to handle or ride the Horse, Lessee completely releases, forever discharges, and agrees to hold harmless Lessor from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee''s use, handling, or riding of the Horse, whether caused by the ordinary negligence of Lessor or otherwise.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.RELEASE';

-- ── 13.8 (safety attire) merged into 13.9 (trail riding)? The user says merge
--    13.8 into 13.9. In sort order 110=SAFETY_ATTIRE, 120=TRAIL_RIDING. Merge
--    SAFETY_ATTIRE text into TRAIL? No — 13.8/13.9 by composed number: count
--    clauses. Composed 13.x order: INSURANCE(1) MORTALITY(2) MAJORMED(3)
--    LOSSUSE(4) RISK(5) ASSUMPTION(6) RELEASE(7) HELMET(8) SAFETY_ATTIRE(9)
--    TRAIL(10) WAIVER(11) INDEMN(12). So 13.8=HELMET, 13.9=SAFETY_ATTIRE. Merge
--    the helmet clause into safety attire (both about required protective gear).
UPDATE contract_clause_defs
   SET body = (SELECT body FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MANDATORY_HELMET')
              || ' ' ||
              (SELECT body FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.SAFETY_ATTIRE')
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.SAFETY_ATTIRE';
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MANDATORY_HELMET';

-- ── 13.10 trail riding: only when Trail Riding is a permitted activity.
UPDATE contract_clause_defs
   SET conditional_on='{"field_key":"TXN.PERMITTED_ACTIVITIES","contains":["TRAIL"]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.TRAIL_RIDING';

-- ── 13.11 indemnification → "Mutual Indemnification" rewrite.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.INDEMNIFICATION';
UPDATE contract_clause_defs
   SET heading='Mutual Indemnification',
       body='Each party shall indemnify, defend, and hold harmless the other party from and against any and all claims, damages, losses, liabilities, costs, and expenses arising out of the indemnifying party''s use, handling, care, or possession of Horse, except to the extent caused by the gross negligence or willful misconduct of the other.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.INDEMNIFICATION';

-- ── §14.4 (TERMINATION.LOSS) → Self-Termination upon Loss or Injury.
UPDATE contract_clause_defs
   SET heading='Self-Termination upon Loss or Injury',
       body='This Agreement shall self-terminate if Horse is significantly injured, becomes seriously ill, or dies. Lessee is entitled to a prorated refund of Lease Fee paid for the remaining time unused at the time of self-termination. In the event Lessee is found to have caused, through gross negligence or willful misconduct, the injury, illness, or death, Lessor may retain the unused portion of the paid Lease Fee.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TERMINATION.LOSS';

-- ── §16.1 assignment: add "unless permitted in the sections above."
UPDATE contract_clause_defs
   SET body='Lessee shall not assign, sublease, or otherwise transfer this Agreement or any of Lessee''s rights or obligations under it without Lessor''s prior written consent, unless permitted in the sections above.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='ASSIGNMENT.NO_ASSIGN';

-- ── §18.1 governing law/venue → the liability-waiver arbitration clause.
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.GOVERNING_STATE','TXN.VENUE_COUNTY','TXN.VENUE_STATE');
UPDATE contract_clause_defs
   SET body='This Agreement shall be governed by the laws of the State of California. Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='GOVERNING_LAW.CHOICE';

-- ── §19.1 attorneys' fees → each party bears its own.
UPDATE contract_clause_defs
   SET body='Each party shall cover their own attorney''s fees and costs.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='ATTORNEYS_FEES.PREVAILING';

-- ── §15.2/15.3 notice addresses → reference the attached addendum (party details
--    are captured by the system and appended as addendum pages to the PDF).
UPDATE contract_clause_defs SET body='Notice to Lessee shall be sent to the address included in the attached addendum.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='NOTICE.LESSEE_ADDRESS';
UPDATE contract_clause_defs SET body='Notice to Lessor shall be sent to the address included in the attached addendum.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='NOTICE.LESSOR_ADDRESS';
