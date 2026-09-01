-- HORSE_LEASE_V2 review fixes (2026-07-21, third pass).

-- 1. Lease type selection regressed (it was an orphan field on a prose clause and
--    the orphan-render tightening hid it). Give it its own clause + token so it
--    renders as a proper selection right after the purpose grant. The orphan
--    behavior is also restored in the client, but a dedicated clause reads best.
UPDATE contract_field_defs SET clause_key='PURPOSE.LEASE_TYPE', sort_order=10
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.LEASE_TYPE';
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'PURPOSE', 'PURPOSE.LEASE_TYPE', NULL,
   'Lease type: {{TXN.LEASE_TYPE}}.', 'input', 15, false, NULL);

-- 2. Rogue period after the choice tokens in 6.3 (vet exam) and 6.6 (disclaimer):
--    a button-choice token followed by "." reads as a stray period. Drop it.
UPDATE contract_clause_defs
   SET body = 'Pre-lease veterinary examination of Horse: {{TXN.VET_CHECK_CHOICE}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.VET_CHECK';
UPDATE contract_clause_defs
   SET body = 'Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING HORSE, INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE. Lessor recommends that Lessee retain a professional trainer to evaluate the suitability of Horse for Lessee''s intended purposes prior to entering into this Agreement. Professional suitability evaluation: {{TXN.TRAINER_EVAL_CHOICE}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.WARRANTY';

-- 3. Remove 10.5 Shared Usage — covered by 10.1's permitted-use description.
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='SHARED_USE.MAIN';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2' AND field_key IN ('TXN.SHARED_WITH','TXN.SHARED_WITH_NAMES');

-- 4. Horse identity: drop the trailing periods on the label:value lines (they're
--    field entries, not sentences). The client renders these as a bold-label
--    matrix. Keep the opening sentence's period.
UPDATE contract_clause_defs SET body =
'This Agreement applies to the following horse (the "Horse"): {{HORSE.REGISTERED_NAME}}
Color: {{HORSE.COLOR}}
Markings: {{HORSE.MARKINGS}}
Breed: {{HORSE.BREED}}
Registration Number: {{HORSE.REGISTRATION_NUMBER}}
Sex: {{HORSE.SEX}}
Year foaled: {{HORSE.AGE_DOB}}
Current fair market value: {{HORSE.FAIR_MARKET_VALUE}}
Microchip: {{HORSE.MICROCHIP}}
Passport: {{HORSE.PASSPORT_NUMBER}}'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.IDENTITY';
