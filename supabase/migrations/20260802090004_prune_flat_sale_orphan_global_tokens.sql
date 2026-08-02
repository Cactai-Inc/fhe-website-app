-- Prune the 24 global token-dictionary rows orphaned by the flat sale templates'
-- retirement (20260802090003). Each appeared in no live template or clause body
-- except retired HORSE_PURCHASE_SALE / HORSE_SALE_TRANSFER's; the successor
-- HORSE_SALE_V2 / HORSE_BILL_OF_SALE resolve their TXN.* and HORSE.* history
-- tokens through contract_field_defs, not the registry. Deliberate removal per
-- the token guard's remedy — the 20260802060002 lease-retirement precedent.
DELETE FROM template_tokens
 WHERE template_id IS NULL
   AND ((namespace = 'HORSE' AND field IN (
          'BEHAVIORAL_HISTORY','COMPETITION_HISTORY','MEDICAL_HISTORY',
          'MEDICATION_HISTORY','TRAINING_HISTORY'))
     OR (namespace = 'TXN' AND field IN (
          'ADDITIONAL_DISCLOSURES','BALANCE_DUE','DEFAULT_TERMS','DEPOSIT_TERMS',
          'DOCUMENTS_TRANSFERRED','EQUIPMENT_EXCLUDED','EQUIPMENT_INCLUDED',
          'PAYMENT_METHOD','PPE_DATE','PPE_STATUS','RISK_TRANSFER',
          'TRANSFER_CONDITION','TRANSFER_DATE','TRANSPORT_RESPONSIBILITY',
          'TRIAL_CARE_PARTY','TRIAL_PERIOD','TRIAL_RISK_PARTY','TRIAL_TERMS',
          'WARRANTIES')));
