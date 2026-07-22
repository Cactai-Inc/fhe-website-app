-- §14 Insurance: (1) add the 30-day-from-signing requirement to the intro, and
-- (2) for each insurance type (mortality / major medical / loss of use), replace
-- the hardcoded "at their expense" with two dropdowns:
--    • Party responsible for the COST  → Lessor / Lessee / Shared (with % split)
--    • Party responsible for OBTAINING → Lessor / Lessee / Shared (no split)

-- 14.1 intro
UPDATE contract_clause_defs
   SET body = 'The parties agree that the following insurance shall be carried on the Horse during the term of this Agreement, obtained and maintained as set out below. Insurance must be obtained within 30 days of the date of signing of this Agreement.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.INSURANCE';

-- drop the old unused text party/cost fields
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.MORTALITY_INSURANCE_COST','TXN.MORTALITY_INSURANCE_PARTY',
                    'TXN.MAJOR_MEDICAL_INSURANCE_COST','TXN.MAJOR_MEDICAL_INSURANCE_PARTY',
                    'TXN.LOSS_OF_USE_INSURANCE_COST','TXN.LOSS_OF_USE_INSURANCE_PARTY');

-- cost fields: format_type 'party' + responsibility_kind 'financial' →
-- Lessor / Lessee / Shared(split %) via the PartyPicker.
-- obtain fields: a plain select Lessor / Lessee / Shared (no split).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, options, guidance,
   responsibility_kind, required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2','TXN.MORTALITY_COST_PARTY','Party responsible for the cost','INSURANCE_RISK','LESSOR',
   'responsibility','text',NULL,'Who pays for this insurance.','financial',false,false,24,'party','INSURANCE_RISK.MORTALITY_REQ'),
  ('HORSE_LEASE_V2','TXN.MORTALITY_OBTAIN_PARTY','Party responsible for obtaining the policy','INSURANCE_RISK','LESSOR',
   'select','select','[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Shared","value":"SHARED"}]'::jsonb,
   'Who obtains and maintains the policy.',NULL,false,false,26,'select','INSURANCE_RISK.MORTALITY_REQ'),

  ('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_COST_PARTY','Party responsible for the cost','INSURANCE_RISK','LESSOR',
   'responsibility','text',NULL,'Who pays for this insurance.','financial',false,false,34,'party','INSURANCE_RISK.MAJOR_MEDICAL_REQ'),
  ('HORSE_LEASE_V2','TXN.MAJOR_MEDICAL_OBTAIN_PARTY','Party responsible for obtaining the policy','INSURANCE_RISK','LESSOR',
   'select','select','[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Shared","value":"SHARED"}]'::jsonb,
   'Who obtains and maintains the policy.',NULL,false,false,36,'select','INSURANCE_RISK.MAJOR_MEDICAL_REQ'),

  ('HORSE_LEASE_V2','TXN.LOSS_OF_USE_COST_PARTY','Party responsible for the cost','INSURANCE_RISK','LESSOR',
   'responsibility','text',NULL,'Who pays for this insurance.','financial',false,false,44,'party','INSURANCE_RISK.LOSS_OF_USE_REQ'),
  ('HORSE_LEASE_V2','TXN.LOSS_OF_USE_OBTAIN_PARTY','Party responsible for obtaining the policy','INSURANCE_RISK','LESSOR',
   'select','select','[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Shared","value":"SHARED"}]'::jsonb,
   'Who obtains and maintains the policy.',NULL,false,false,46,'select','INSURANCE_RISK.LOSS_OF_USE_REQ');

-- reword the required-obtain detail clauses to reference the two parties + limit,
-- dropping the hardcoded "at their expense".
UPDATE contract_clause_defs
   SET body='Mortality insurance is required on the Horse with a minimum limit of {{TXN.MORTALITY_MIN_LIMIT}}. Party responsible for the cost: {{TXN.MORTALITY_COST_PARTY}}. Party responsible for obtaining the policy: {{TXN.MORTALITY_OBTAIN_PARTY}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MORTALITY_REQ';
UPDATE contract_clause_defs
   SET body='Major medical insurance is required on the Horse with a minimum limit of {{TXN.MAJOR_MEDICAL_MIN_LIMIT}}. Party responsible for the cost: {{TXN.MAJOR_MEDICAL_COST_PARTY}}. Party responsible for obtaining the policy: {{TXN.MAJOR_MEDICAL_OBTAIN_PARTY}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MAJOR_MEDICAL_REQ';
UPDATE contract_clause_defs
   SET body='Loss of use insurance is required on the Horse with a minimum limit of {{TXN.LOSS_OF_USE_MIN_LIMIT}}. Party responsible for the cost: {{TXN.LOSS_OF_USE_COST_PARTY}}. Party responsible for obtaining the policy: {{TXN.LOSS_OF_USE_OBTAIN_PARTY}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.LOSS_OF_USE_REQ';
