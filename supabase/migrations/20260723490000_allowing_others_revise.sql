-- Allowing Others to Ride: revise the trailing sentence to reference the parties
-- listed above rather than a bare "no other person" prohibition.

UPDATE contract_clause_defs
   SET body = 'The following additional persons may ride or handle the Horse without Lessor''s prior permission: {{TXN.OTHERS_ALLOWED}}.
Only persons listed as parties to this contract and shown above shall be permitted to ride or handle the Horse without Lessor''s written permission.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHERS';
