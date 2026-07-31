-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: KIOSK SIGNING FAILED — "your signature couldn't be saved" (2026-07-30)
--
-- REPRODUCED against prod. A kiosk signer fills the form, reaches the first
-- document, types their name, presses sign, and the RPC raises:
--
--   ERROR: function generate_document(uuid, text, uuid, uuid, jsonb, text)
--          is not unique
--   HINT:  Could not choose a best candidate function.
--   CONTEXT: PL/pgSQL function sign_release(...) line 193
--
-- CAUSE. generate_document has TWO overloads:
--   generate_document(uuid, text, uuid, uuid, jsonb, text)           -- 6 args
--   generate_document(uuid, text, uuid, uuid, jsonb, text, uuid[])   -- 7 args
-- The 7-arg form's p_horse_ids has a DEFAULT, so a 6-argument call matches BOTH
-- candidates and Postgres refuses to choose. Nothing about the signature itself
-- was wrong — the document could not be generated, so there was nothing to sign,
-- and the failure surfaced to the member as a signature error.
--
-- This is the SAME defect class fixed earlier today on staff_assign_horse_party.
-- Two overloads where every extra parameter defaults is not an overload pair; it
-- is a trap that fires on the shorter call.
--
-- BLAST RADIUS — six functions make ambiguous 6-arg calls and were ALL broken:
--   sign_release                (the kiosk / release flow — the reported bug)
--   assert_horse_care_eligible  (horse-care gating)
--   ensure_horse_documents      (horse document set)
--   start_lease_contract_v2     (the live lease)
--   start_purchase_contract     (purchase contracts)
--   start_lease_contract        (legacy lease)
-- Only generate_my_onboarding_documents passes 7 arguments and therefore worked.
-- That asymmetry is why onboarding kept working while the kiosk did not.
--
-- FIX. Drop the 6-arg overload. Verified by diffing both bodies: the 7-arg form
-- is the 6-arg form PLUS an 11-line multi-horse binding block that is a no-op
-- when p_horse_ids is NULL or holds a single id:
--
--   IF coalesce(array_length(p_horse_ids, 1), 0) > 1 THEN … END IF;
--
-- So every existing 6-arg call resolves to the 7-arg form and behaves exactly as
-- it did before the multi-horse work landed. No call site needs changing.
-- ─────────────────────────────────────────────────────────────────────────────

DO $do$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'generate_document') = 2 THEN
    DROP FUNCTION public.generate_document(uuid, text, uuid, uuid, jsonb, text);
    RAISE NOTICE 'dropped the superseded 6-arg generate_document';
  ELSE
    RAISE NOTICE 'generate_document: not two overloads — leaving alone';
  END IF;
END
$do$;
