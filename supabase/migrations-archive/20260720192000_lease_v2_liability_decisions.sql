/*
  # Lease v2 — apply owner decisions on held liability clauses

  Per owner review of the automatic-liability clauses:
    REMOVE §16.2.1 Liquidated Damages (orphaned once 16.2.2/16.2.3 go),
           §16.2.2 Death/Loss/Theft, §16.2.3 Disability,
           §16.3 Risk of Injury to Lessee, §16.4 Risk of Injury to Owner,
           §16.9 Limitation of Liability.
    STRIP  §14.10 the automatic negligence-liability sentence (keep the selectable
           who-pays choice). §14.11/§14.12 already carry no carve-out.
    §16.6 Trail Riding: already trimmed to a plain hazard description (no negligence
           acknowledgement, no covenant not to sue) — left as-is.
    KEEP   §16.8 Indemnification (already the ELS two-option check-one).

  Negligence carve-outs are omitted entirely (not combined) until a strict,
  legally-defensible definition of negligence is available.
*/

-- ── remove the six held clauses ─────────────────────────────────────────────
-- first clear any fields that hang off the removed clauses
DELETE FROM contract_field_defs
 WHERE template_key='HORSE_LEASE_V2'
   AND clause_key IN (
     'INSURANCE_RISK.RISK_OF_LOSS.LIQUIDATED',
     'INSURANCE_RISK.RISK_OF_LOSS.DEATH',
     'INSURANCE_RISK.RISK_OF_LOSS.DISABILITY',
     'INSURANCE_RISK.INJURY_LESSEE',
     'INSURANCE_RISK.INJURY_OWNER',
     'INSURANCE_RISK.LIMITATION');

DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2'
   AND clause_key IN (
     'INSURANCE_RISK.RISK_OF_LOSS.LIQUIDATED',
     'INSURANCE_RISK.RISK_OF_LOSS.DEATH',
     'INSURANCE_RISK.RISK_OF_LOSS.DISABILITY',
     'INSURANCE_RISK.INJURY_LESSEE',
     'INSURANCE_RISK.INJURY_OWNER',
     'INSURANCE_RISK.LIMITATION');

-- ── strip the automatic negligence-liability sentence from §14.10 ───────────
-- keeps the selectable who-pays allocation, removes the automatic overlay.
UPDATE contract_clause_defs
   SET body = E'Responsibility for the cost of non-routine veterinary care for Horse: {{TXN.NONROUTINE_VET_COST}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='EXPENSES.NONROUTINE_VET';

-- clean the now-dangling "subject to the sub-sections below" (16.2.1-3 removed)
UPDATE contract_clause_defs
   SET body = E'The risk of loss of or injury to Horse is allocated as follows: {{TXN.RISK_ALLOCATION}}. This allocation governs which party bears the financial consequence if Horse is lost, dies, is stolen, or is injured during the term of this Agreement.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.RISK_OF_LOSS';
