-- Prune the 16 global token-dictionary rows orphaned by HORSE_LEASE's full
-- retirement (20260802060000). Each appeared in no live template or clause
-- body except retired HORSE_LEASE's; the successor HORSE_LEASE_V2 resolves
-- its TXN.* tokens through contract_field_defs, not the registry. Deliberate
-- removal per the token guard's remedy. Tail of the 2026-08-02 owner ruling.
DELETE FROM template_tokens
 WHERE template_id IS NULL
   AND namespace = 'TXN'
   AND field IN (
     'AUTHORIZED_USERS','BOARDING_RESPONSIBILITY','CARE_RESPONSIBILITY',
     'COMPETITION_TERMS','EMERGENCY_VET_RESPONSIBILITY','FARRIER_RESPONSIBILITY',
     'LEASE_TERM','LESSEE_EQUIPMENT','LESSOR_EQUIPMENT','RESERVED_DAYS',
     'RISK_ALLOCATION','ROUTINE_VET_RESPONSIBILITY','TERMINATION_TERMS',
     'TRAINING_TERMS','USE_RESTRICTIONS','VET_AUTH_CONTACT');
