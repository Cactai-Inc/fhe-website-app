-- Competition Expenses and Winnings: put the winnings sentence on its own line
-- below the expenses sentence.
UPDATE contract_clause_defs
   SET body = 'Expenses of competition (entry fees, transportation, and the like) are: {{TXN.COMPETITION_EXPENSES}}.'
           || E'\n' || 'Any prize money or winnings earned in competition shall belong to: {{TXN.COMPETITION_WINNINGS}}.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'COMPETITIONS.TERMS';
