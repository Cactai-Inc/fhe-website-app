-- LEASE TEMPLATE ROUND (HORSE_LEASE_V3_WIP only; live V3 untouched).
--
-- (f) Rule 6: third-party exercise authorization must never print when the company is
--     a party. SCHEDULE.TRAINER_CARE ("Lessee is permitted to engage an approved 3rd
--     party to exercise the Horse") assumes an INDIVIDUAL lessee. Add
--     LESSEE.PARTY_TYPE = INDIVIDUAL to its gate so it is hidden when a company holds
--     the lessee seat, alongside the existing include toggle.
--
-- (The orphan LEASE_FEE.NO_FEE_CONSIDERATION clause — gated on a nonexistent field —
--  is left for a separate ruling: it needs a real "no fee" derived gate like the sale,
--  not a silent retire.)

BEGIN;

UPDATE contract_clause_defs
   SET conditional_on = '{"all": [
         {"equals": ["YES"], "field_key": "TXN.TRAINER_CARE_INCLUDE"},
         {"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V3_WIP' AND clause_key = 'SCHEDULE.TRAINER_CARE';

COMMIT;
