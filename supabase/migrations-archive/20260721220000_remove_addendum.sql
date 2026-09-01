-- Remove the Addendum section (party & horse details) added in 20260721170000 —
-- it didn't render as intended and serves no purpose. Also revert the §15 notice
-- clauses back to referencing the addendum-free wording (address on file), since
-- the addendum they pointed to is gone.
DELETE FROM contract_clause_defs  WHERE template_key='HORSE_LEASE_V2' AND section_key='ADDENDUM';
DELETE FROM contract_section_defs WHERE template_key='HORSE_LEASE_V2' AND section_key='ADDENDUM';

UPDATE contract_clause_defs SET body='Notice to Lessee shall be sent to: {{LESSEE.ADDRESS}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='NOTICE.LESSEE_ADDRESS';
UPDATE contract_clause_defs SET body='Notice to Lessor shall be sent to: {{LESSOR.ADDRESS}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='NOTICE.LESSOR_ADDRESS';
