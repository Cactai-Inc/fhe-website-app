-- §6 Payment Method: number the two directions (6.1 Lessee, 6.2 Lessor). The
-- clauses were headingless, so they rendered unnumbered in the authoring view.
-- Give each direction's main clause a heading; the card-processing clauses stay
-- headingless so they read as continuations under their direction.
UPDATE contract_clause_defs SET heading = 'Payments by the Lessee'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PAYMENT_METHOD.MAIN';
UPDATE contract_clause_defs SET heading = 'Payments by the Lessor'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PAYMENT_METHOD.MAIN_LESSOR';
