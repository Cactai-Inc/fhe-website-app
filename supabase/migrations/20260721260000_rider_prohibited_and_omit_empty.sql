-- (1) §11.7 Rider aids — reverse to a PROHIBITED list (clearer than an allow-list):
--     "The following rider aids are prohibited: [buttons]". Omitted when none picked.
UPDATE contract_clause_defs
   SET body = 'The following rider aids are prohibited: {{TXN.RIDER_AIDS}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.RIDER_AIDS';
UPDATE contract_field_defs
   SET label='Prohibited rider aids',
       guidance='Select any rider aids the Lessee is prohibited from using. Leave blank if none.'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.RIDER_AIDS';
UPDATE contract_field_defs
   SET label='Other prohibited rider aid'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.RIDER_AIDS_OTHER';
UPDATE contract_clause_defs
   SET body='Other prohibited rider aid: {{TXN.RIDER_AIDS_OTHER}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.RIDER_AIDS_OTHER';

-- (2) General rule: a selection/optional-fill clause is OMITTED from the final
--     contract when the author selected nothing for it. The composer already drops
--     an `input` clause that is `is_optional` and whose tokens are all empty (no
--     number consumed). So mark the selection-style clauses is_optional = true —
--     they show in the authoring view (to be filled) and vanish from the composed
--     document when left blank. Mandatory prose, party/horse identity, the parties
--     intro, permitted-use grant, and the like are NOT marked (they always show).
UPDATE contract_clause_defs SET is_optional = true
 WHERE template_key='HORSE_LEASE_V2' AND clause_key IN (
   -- care selections
   'CARE.SUPPLEMENTS', 'CARE.FARRIER', 'CARE.FARRIER_CONTACT',
   'CARE.ROUTINE_VET', 'CARE.VET_CONTACT', 'CARE.PROTECTIVE_EQUIP',
   'CARE.TACK', 'CARE.RIDER_AIDS', 'CARE.RIDER_AIDS_OTHER',
   -- permitted-use / prohibited selections
   'PROHIBITED.OTHERS', 'PROHIBITED.OTHER', 'PROHIBITED.OTHER_NOTE',
   'PROHIBITED.JUMP_RESTRICTIONS', 'PERMITTED_USE.TRANSPORT',
   -- horse optional follow-ons
   'HORSE.OWNERSHIP_LIMITS', 'HORSE.CONDITION_EXC', 'HORSE.BEHAVIOR_EXC',
   -- location / schedule / evaluation optional fills
   'LOCATION.NEW', 'SCHEDULE.OTHER', 'EVALUATION.DATES',
   -- insurance required-obtain follow-ons + competitions terms
   'INSURANCE_RISK.MORTALITY_REQ', 'INSURANCE_RISK.MAJOR_MEDICAL_REQ',
   'INSURANCE_RISK.LOSS_OF_USE_REQ', 'COMPETITIONS.TERMS',
   -- payment method card details
   'PAYMENT_METHOD.CARD'
 );
