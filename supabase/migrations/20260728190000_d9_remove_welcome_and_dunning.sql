-- D9 (owner-final, 2026-07-28) — 5c AMENDMENT: there is no welcome email and
-- no dunning email.
--
--   The INVITATION is the welcome. The document-flow completion email is the
--   account-setup confirmation. The email chain ends there.
--   Payment is prepaid-gated (no payment, no service), so overdue reminders
--   have no business function.
--
-- Both PRODUCERS are deleted outright. Verified first: nothing else consumes
-- them — the worker endpoint had no caller, no code reads the 'welcome'
-- notification kind, and the notification pattern itself keeps serving its
-- five live kinds (contract_cancelled, contract_in_review, document_executed,
-- member_hi, request_new), which are untouched.
--
-- No data cleanup is required: the wiring never fired on prod (0 welcome
-- notifications, 0 welcomed_at stamps, 0 last_dunning_at stamps). The two
-- columns are dropped with the producers that wrote them.

-- ── welcome: the members-activation trigger and its function ────────────────
DROP TRIGGER IF EXISTS members_welcome ON members;
DROP FUNCTION IF EXISTS trg_member_welcome();
ALTER TABLE members DROP COLUMN IF EXISTS welcomed_at;

-- ── dunning: the due-computation and its stamp ─────────────────────────────
DROP FUNCTION IF EXISTS dunning_due();
DROP FUNCTION IF EXISTS mark_dunning_sent(uuid);
ALTER TABLE purchases DROP COLUMN IF EXISTS last_dunning_at;

-- ── the vestigial preference (D9: the toggle leaves the UI) ────────────────
-- profiles.payment_reminders no longer drives anything. The column is kept
-- (harmless, and dropping it would churn the profile field list the contact
-- surface selects) but nothing reads it; the UI toggle is removed.
COMMENT ON COLUMN profiles.payment_reminders IS
  'VESTIGIAL (D9, 2026-07-28): no dunning email exists — payment is prepaid-gated. No reader.';

-- ── Assertion: neither producer survives ───────────────────────────────────
DO $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND proname IN ('trg_member_welcome', 'dunning_due', 'mark_dunning_sent');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'D9: producers still present: %', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'members_welcome') THEN
    RAISE EXCEPTION 'D9: members_welcome trigger still present';
  END IF;
END $$;
