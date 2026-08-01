-- ─────────────────────────────────────────────────────────────────────────────
-- CLAUSE-GATE CLOSE-OUT + APPROVED OVERLOAD DROP (2026-08-01)
--
-- Contents:
--   1. Item C3 — TXN.TRAINER_EVAL_CHOICE re-pointed at HORSE.TRAINER_EVAL
--   2. Item E — HELD, NOT APPLIED. See the block comment in section 2: the
--      widened gate is logically correct but would attach waiver language to
--      a non-waiver fact pattern. Reported rather than applied.
--   3. The approved drop of the 07-26 _provision_purchase_for_offerings
--      overload, using the signature confirmed by the caller trace.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- 1. ITEM C3 — point the field def at the clause that carries its token
-- ═════════════════════════════════════════════════════════════════════════
-- Verified before: the field def read clause_key='HORSE.WARRANTY', but a
-- template-wide body scan finds {{TXN.TRAINER_EVAL_CHOICE}} in exactly one
-- clause — HORSE.TRAINER_EVAL (section HORSE, sort 55, no condition). The
-- warranty body no longer contains the token at all, so C1 and C2 were
-- already satisfied in the data before this batch; only the pointer was stale.
UPDATE contract_field_defs
   SET clause_key = 'HORSE.TRAINER_EVAL'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EVAL_CHOICE';


-- ═════════════════════════════════════════════════════════════════════════
-- 2. ITEM E — HELD. Gate verified, change NOT applied.
-- ═════════════════════════════════════════════════════════════════════════
-- INSURANCE_RISK.GL_UNINSURED_ALLOCATION does not exist (0 rows) — it was
-- never inserted, so there was nothing to delete.
--
-- All three gates matched the instruction byte-for-byte:
--   INSURANCE_RISK.GL_NONE   {"equals": ["YES"], "field_key": "TXN.GL_NOT_REQUIRED"}
--   INSURANCE_RISK.MORT_NONE {"equals": ["YES"], "field_key": "TXN.MORT_NOT_REQUIRED"}
--   INSURANCE_RISK.MED_NONE  {"equals": ["YES"], "field_key": "TXN.MED_NOT_REQUIRED"}
--
-- The widened condition was tested against clause_condition_met and behaves
-- exactly as intended: both-NONE-and-not-waived returns true, and the
-- original waived case still returns true. The LOGIC is right.
--
-- The BODIES are the problem. All three read as an election, not a state:
--   GL_NONE:   'Lessor has elected not to require general liability insurance
--               under this Agreement. Lessor accepts full risk...'
--   MORT_NONE: 'Lessor has elected not to require mortality insurance...'
--   MED_NONE:  'Lessor has elected not to maintain medical insurance...'
--
-- Widening the gate makes that sentence render when TXN.GL_NOT_REQUIRED = 'NO'
-- — i.e. when Lessor affirmatively DID require the insurance and both parties
-- then reported 'Does not have and will not obtain'. The contract would assert
-- that Lessor elected not to require coverage it demonstrably did require.
-- That is a false statement of fact in an executed legal instrument, and it
-- also lands Lessor with full risk in the one scenario where the parties most
-- plainly failed to allocate it.
--
-- Compounding it: in the both-NONE case INSURANCE_RISK.GL_STATUS still renders
-- ('Lessor: does not have and will not obtain... Lessee: does not have and
-- will not obtain...') alongside GL_DED_SIMPLE, so the widened clause would
-- sit directly beside text contradicting its own opening sentence.
--
-- This needs a SEPARATE clause with its own body — the fallback the spec
-- originally described — not a reuse of the waiver clause. The vocabulary
-- supports it without negation ('NONE' is a real option value), so it is
-- writable as soon as the body language is approved.
--
-- Nothing changed here. Reported for a body decision.


-- ═════════════════════════════════════════════════════════════════════════
-- 3. APPROVED DROP — the 07-26 _provision_purchase_for_offerings overload
-- ═════════════════════════════════════════════════════════════════════════
-- Caller trace result (DB source scan + repo grep), confirming this is safe:
--   * provision_client_invitation and attach_offerings_to_client are the only
--     callers. Both pass (…, p_mark_paid, p_payment_method, …) — boolean then
--     text — which resolves to the 07-25 overload, NOT this one.
--   * Zero direct application calls: no supabase.rpc('_provision_purchase_
--     for_offerings') anywhere in src/ or api/.
--   * Historical migration call sites (phase1_kiosk:211, phase3b:157) use the
--     same boolean-then-text pattern.
-- This overload therefore has no caller. Its PUBLIC/anon grants were revoked
-- earlier today in 20260801010000; this removes the function itself.
DROP FUNCTION IF EXISTS public._provision_purchase_for_offerings(
  uuid, uuid, uuid, uuid[], text, boolean, numeric, text);

-- ─────────────────────────────────────────────────────────────────────────────
-- END
-- ─────────────────────────────────────────────────────────────────────────────
