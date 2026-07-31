-- ─────────────────────────────────────────────────────────────────────────────
-- DEDUCTIBLE "OTHER": ONE INPUT, NOT TWO (2026-07-31, owner)
--
-- Each deductible-responsibility select (general liability, mortality, medical)
-- carries its own "Other" option, and InlineSelect already reveals a free-text
-- box beside the select when it is chosen. A SECOND place to describe the same
-- arrangement then sat below in its own clause:
--
--   INSURANCE_RISK.GL_DED_OTHERC    + TXN.GL_DED_RESP_OTHER
--   INSURANCE_RISK.MORT_DEDR_OTHERC + TXN.MORT_DED_RESP_OTHER
--   INSURANCE_RISK.MED_DEDR_OTHERC  + TXN.MED_DED_RESP_OTHER
--
-- Two inputs for one answer, and the lower one never even appeared: its clause
-- is gated on the select equalling OTHER, but the UI bug fixed in the same
-- commit meant the select could not reliably reach that value. Removing the
-- duplicate is what the owner asked for; the inline box beside the select is the
-- one that stays.
--
-- The SPLIT clauses are deliberately untouched. They ask a genuinely different
-- question — how the split divides between Lessor and Lessee — and they will now
-- activate correctly, because the selector can reach SPLIT again.
--
-- Deletes are scoped to this template and are safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. The field instances on live documents, first (they reference the defs).
DELETE FROM contract_fields
 WHERE field_key IN ('TXN.GL_DED_RESP_OTHER', 'TXN.MORT_DED_RESP_OTHER', 'TXN.MED_DED_RESP_OTHER');

-- 2. The field definitions.
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.GL_DED_RESP_OTHER', 'TXN.MORT_DED_RESP_OTHER', 'TXN.MED_DED_RESP_OTHER');

-- 3. The clauses that existed only to hold them.
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND clause_key IN ('INSURANCE_RISK.GL_DED_OTHERC',
                      'INSURANCE_RISK.MORT_DEDR_OTHERC',
                      'INSURANCE_RISK.MED_DEDR_OTHERC');
