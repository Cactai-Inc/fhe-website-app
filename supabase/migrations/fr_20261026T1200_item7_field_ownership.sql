-- Fix round 3, item 7 — field ownership.
--
-- Mechanics:
--   · remove SYSTEM as an owner value; add NONE (no party edits the field).
--   · add contract_field_defs.system_settable boolean default true.
--   · the six computed fields the renderer/triggers fill and no party edits become
--     owner NONE: TXN.TRAINER_FEE_PHRASE, TXN.VET_FEE_PHRASE, TXN.TRIAL_AT_CURRENT,
--     TXN.TRANSPORT_APPLIES, TXN.BOS_PPE_SOURCE, and TXN.LEASE_FEE_PAYABLE (the
--     "any other field the renderer fills" — written by recompose_document_fields,
--     no def row, so handled on the contract_fields instances + the writer).
--   · the field permission check lets a BUYER party edit a COBUYER-owned field and
--     a COBUYER party edit a BUYER-owned field, EXCEPT per-person initials and
--     signer fields (format_type='initials', *.ENTITY_SIGNER_*), which stay per
--     person.
--
-- Ownership changes are scoped to the three active templates: HORSE_LEASE_V3,
-- HORSE_SALE_V3, HORSE_BILL_OF_SALE. The legacy V2 templates are untouched (D10).

BEGIN;

-- ── system_settable column ───────────────────────────────────────────────────
ALTER TABLE contract_field_defs
  ADD COLUMN IF NOT EXISTS system_settable boolean NOT NULL DEFAULT true;

-- ── (a) every HORSE identity field → DEAL (incl. BARN_NAME, HEIGHT) ──────────
-- The HORSE.* IDENTITY/description fields — NOT the imported disclosure CONTENT or
-- GATE tokens (KNOWN_CONDITIONS, MEDICAL_HISTORY, BEHAVIORAL_HISTORY, INJURIES_*,
-- MEDICATIONS, SUPPLEMENTS and their _GATEs), which are read-only imports from the
-- record and keep the owning party so the disclosure-gate required check is
-- unchanged. The identity set is every other HORSE.* field.
UPDATE contract_field_defs SET owner_role = 'DEAL'
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND field_key LIKE 'HORSE.%'
   AND field_key NOT IN (
     'HORSE.KNOWN_CONDITIONS','HORSE.KNOWN_CONDITIONS_GATE',
     'HORSE.MEDICAL_HISTORY','HORSE.MEDICAL_HISTORY_GATE',
     'HORSE.BEHAVIORAL_HISTORY','HORSE.BEHAVIORAL_HISTORY_GATE',
     'HORSE.INJURIES_TO_HORSE','HORSE.INJURIES_TO_HORSE_GATE',
     'HORSE.INJURIES_TO_HUMANS','HORSE.INJURIES_TO_HUMANS_GATE',
     'HORSE.MEDICATIONS','HORSE.MEDICATIONS_GATE',
     'HORSE.SUPPLEMENTS','HORSE.SUPPLEMENTS_GATE');

-- ── (b) evaluation length/unit fields → DEAL; LEASE_FEE / EVAL_FIXED_FEE stay ─
UPDATE contract_field_defs SET owner_role = 'DEAL'
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.EVAL_FIXED_LENGTH','TXN.EVAL_FIXED_UNIT',
                     'TXN.EVAL_INCLUDED_LENGTH','TXN.EVAL_INCLUDED_UNIT');
-- TXN.LEASE_FEE and TXN.EVAL_FIXED_FEE stay LESSOR (left unchanged).

-- ── (c) permitted-activities ownership ───────────────────────────────────────
UPDATE contract_field_defs SET owner_role = 'LESSOR'
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.ADDITIONAL_ACTIVITIES','TXN.OTHERS_ALLOWED');
UPDATE contract_field_defs SET owner_role = 'DEAL'
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.ADDITIONAL_ACTIVITIES_OTHER','TXN.OTHERS_ALLOWED_OTHER');

-- ── (d) insurance lessee-status elections → LESSEE ───────────────────────────
UPDATE contract_field_defs SET owner_role = 'LESSEE'
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.CCC_LESSEE_STATUS','TXN.GL_LESSEE_STATUS');

-- ── (e) cost/deductible shares + trainer split → DEAL ────────────────────────
UPDATE contract_field_defs SET owner_role = 'DEAL'
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.TRAINER_EXERCISE_SPLIT_PCT','TXN.MED_COST_LESSEE_SHARE',
                     'TXN.MED_DED_LESSEE_SHARE','TXN.MORT_COST_LESSEE_SHARE',
                     'TXN.MORT_DED_LESSEE_SHARE');

-- ── (f) jumping terms → LESSOR ───────────────────────────────────────────────
UPDATE contract_field_defs SET owner_role = 'LESSOR'
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.JUMP_MAX_HEIGHT','TXN.JUMP_DAYS_PER_WEEK','TXN.JUMP_SUPERVISION');

-- ── (g) protective equipment + rider aids → LESSOR ───────────────────────────
UPDATE contract_field_defs SET owner_role = 'LESSOR'
 WHERE template_key = 'HORSE_LEASE_V3'
   AND field_key IN ('TXN.PROTECTIVE_EQUIPMENT','TXN.RIDER_AIDS');

-- ── (h) bill of sale co-buyer election fields → BUYER ────────────────────────
UPDATE contract_field_defs SET owner_role = 'BUYER'
 WHERE template_key = 'HORSE_BILL_OF_SALE'
   AND field_key IN ('TXN.CO_BUYER_ENABLED','TXN.CO_BUYER_TITLE_FORM','TXN.CO_BUYER_TITLE_DETAIL');

-- ── computed fields → NONE (remove SYSTEM) ───────────────────────────────────
-- def rows (BARN_NAME/HEIGHT already moved to DEAL by (a); the remaining SYSTEM
-- def rows are the computed phrases/flags no party edits).
UPDATE contract_field_defs SET owner_role = 'NONE', system_settable = true
 WHERE owner_role = 'SYSTEM'
   AND field_key IN ('TXN.TRAINER_FEE_PHRASE','TXN.VET_FEE_PHRASE',
                     'TXN.TRIAL_AT_CURRENT','TXN.TRANSPORT_APPLIES','TXN.BOS_PPE_SOURCE');

-- any SYSTEM def left over anywhere also becomes NONE (none expected after (a)).
UPDATE contract_field_defs SET owner_role = 'NONE' WHERE owner_role = 'SYSTEM';

-- existing contract_fields INSTANCES carrying owner_role SYSTEM (the computed
-- phrases + LEASE_FEE_PAYABLE + the ENTITY_SIGNER capacity rows + party auto-fill
-- rows) → NONE, so no SYSTEM value survives anywhere.
UPDATE contract_fields SET owner_role = 'NONE' WHERE owner_role = 'SYSTEM';

COMMIT;
