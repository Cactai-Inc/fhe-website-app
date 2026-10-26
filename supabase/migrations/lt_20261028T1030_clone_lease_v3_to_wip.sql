-- LEASE TEMPLATE ROUND — isolate the live contract.
--
-- A real lease (Abby Beers, LESSOR; editable/ready_to_sign, unsigned) composes from
-- HORSE_LEASE_V3's clause defs (clauses are keyed by template_key, so a def edit
-- reaches her document on its next recompose). The owner ruled: fix on a COPY, swap
-- later. Clone the whole template (sections + clauses + fields, inheriting the two
-- already-applied safe fixes lt_...1000) to HORSE_LEASE_V3_WIP. All remaining
-- structural fixes land on the WIP key only; Abby's live contract never composes from
-- it. The WIP template is inactive — nothing can start a new document on it — until
-- the owner approves the swap. clone_contract_template refuses if the key exists.

BEGIN;
SELECT clone_contract_template('HORSE_LEASE_V3', 'HORSE_LEASE_V3_WIP', 'Horse Lease Agreement (WIP — not live)');
-- keep it out of every picker until promotion
UPDATE contract_templates SET active = false WHERE template_key = 'HORSE_LEASE_V3_WIP';
COMMIT;
