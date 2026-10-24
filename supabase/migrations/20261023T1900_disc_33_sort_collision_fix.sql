-- Phase 33: Part 2 — resolve the sort collisions this round INTRODUCED, without
-- disturbing the pre-existing mutually-exclusive branch families (PPE.CONDUCTED*,
-- TRIAL.RETURN_*, etc.), which share a slot BY DESIGN because only one ever renders.
--
-- Two kinds of new collision are fixed here:
--   (A) pending placeholders that disc_31 placed at (owning-clause sort − 1), where
--       several selectors share one owning sort, so their pendings stacked on the
--       same slot. Each is given a distinct slot in the free band just below its
--       gate's branch, in reading order, so the all-pending (nothing-selected)
--       document prints them in a stable, defined order.
--   (B) the BOS pre-purchase-examination block (disc_28, sorts 149–156) overlapping
--       the BOS Known Conditions block (disc_32 resequence, 150–154). PPE is a
--       statement about the sale process, not a horse-record disclosure, so it moves
--       as a block to AFTER the seven disclosure sections (190+), its pending just
--       ahead of it.
--
-- No real clause moves; only the introduced duplicates are relocated into free slots.
-- Idempotent-safe: each UPDATE targets an exact (template, clause_key).

-- ── (A) pending-placeholder collisions ───────────────────────────────────────

-- SALE · PPE: three pendings stacked at sort 4 (gate is at 5). Spread to 2,3,4.
UPDATE contract_clause_defs SET sort_order = 2 WHERE template_key='HORSE_SALE_V3' AND clause_key='PPE_CHOICE_PENDING';
UPDATE contract_clause_defs SET sort_order = 3 WHERE template_key='HORSE_SALE_V3' AND clause_key='PPE_TIMING_PENDING';
UPDATE contract_clause_defs SET sort_order = 4 WHERE template_key='HORSE_SALE_V3' AND clause_key='PPE_CONTINGENT_PENDING';

-- SALE · TRIAL: two pendings stacked at 4 (gate at 5). Enabled reads first, then
-- the deposit-disposition pending.
UPDATE contract_clause_defs SET sort_order = 3 WHERE template_key='HORSE_SALE_V3' AND clause_key='TRIAL_ENABLED_PENDING';
UPDATE contract_clause_defs SET sort_order = 4 WHERE template_key='HORSE_SALE_V3' AND clause_key='TRIAL_DEPOSIT_DISPOSITION_PENDING';

-- LEASE · INSURANCE_RISK: the three general-liability pendings grouped in the free
-- 147–149 band, just before the GENERAL_LIABILITY block at 150. (Coverage and
-- Requires both sat at 149; Allocation collided with GL_NOT_REQUIRED at 155.)
UPDATE contract_clause_defs SET sort_order = 147 WHERE template_key='HORSE_LEASE_V3' AND clause_key='GL_LESSOR_COVERAGE_PENDING';
UPDATE contract_clause_defs SET sort_order = 148 WHERE template_key='HORSE_LEASE_V3' AND clause_key='GL_LESSOR_REQUIRES_PENDING';
UPDATE contract_clause_defs SET sort_order = 149 WHERE template_key='HORSE_LEASE_V3' AND clause_key='GL_NO_REQ_ALLOCATION_PENDING';

-- LEASE · CARE: the rider-aids pending sat on CARE.RIDER_AIDS_NONE at 91. Move it
-- to the free slot 88, ahead of the whole rider-aids block (89–93).
UPDATE contract_clause_defs SET sort_order = 88 WHERE template_key='HORSE_LEASE_V3' AND clause_key='RIDER_AIDS_PENDING';

-- ── (B) BOS pre-purchase-examination block → after the disclosure sections ────
-- Supplements (the last disclosure section) ends at 184. PPE moves to 190+, its
-- pending just ahead at 189, preserving the gate → statements → acks order.
UPDATE contract_clause_defs SET sort_order = 189 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_PENDING';
UPDATE contract_clause_defs SET sort_order = 190 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_GATE';
UPDATE contract_clause_defs SET sort_order = 191 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_SELLER_DECLINED';
UPDATE contract_clause_defs SET sort_order = 192 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_SELLER_DECLINED_ACK';
UPDATE contract_clause_defs SET sort_order = 193 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_BUYER_DECLINED';
UPDATE contract_clause_defs SET sort_order = 194 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_BUYER_DECLINED_ACK';
UPDATE contract_clause_defs SET sort_order = 195 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_PERFORMED';
UPDATE contract_clause_defs SET sort_order = 196 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_PERFORMED_ACK';
