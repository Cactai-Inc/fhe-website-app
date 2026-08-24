-- ORCH4 audit of TASK-PAMELA — a SAVE must not report the lead as invited.
--
-- PAMELA §A split provisioning into save and send: `p_send => false` writes the
-- invitation as a DRAFT and skips supersede_invitations, so no link is issued and
-- no email goes out. The trailing request block was never brought into that split.
-- It still ran unconditionally, so saving an account from the lead drawer flipped
-- `requests.status` from 'new' to 'invited' and resolved the inbound alert — for
-- an invitation that deliberately had not been sent.
--
-- That is not cosmetic. `inbound_queue` computes `overdue` from `r.status = 'new'`,
-- and `dash_people_waiting()` reads that view (the lead follow-up loop fixed on the
-- dashboard on 2026-08-23). A save therefore dropped the person out of the waiting
-- queue while nobody had actually contacted them.
--
-- Proven live before this migration was written, in BEGIN…ROLLBACK as the tenant
-- owner: p_send => false returned an invitation with status 'draft' and left
-- requests.status = 'invited'.
--
-- The body below is the LIVE body, read back with pg_get_functiondef and
-- string-edited, so nothing else in it can drift. The signature is unchanged, so
-- CREATE OR REPLACE cannot leave an overload behind. Not replayable on a fresh
-- database.
DO $mig$
DECLARE
  v_src text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'provision_client_invitation';
  IF v_src IS NULL THEN RAISE EXCEPTION 'provision_client_invitation not found'; END IF;

  IF position('IF p_request_id IS NOT NULL AND p_send THEN' IN v_src) > 0 THEN
    RAISE NOTICE 'already gated on p_send — nothing to do';
    RETURN;
  END IF;

  -- Anchored on the UPDATE itself: `IF p_request_id IS NOT NULL THEN` appears
  -- three times in this function and only this one is the act being gated.
  v_old := '  IF p_request_id IS NOT NULL THEN' || chr(10) ||
           '    UPDATE requests SET status = ''invited'' WHERE id = p_request_id;';
  v_new := '  -- ORCH4: sending is what invites somebody. A save has issued nothing,' || chr(10) ||
           '  -- so the request stays where it was and its alert stays open.' || chr(10) ||
           '  IF p_request_id IS NOT NULL AND p_send THEN' || chr(10) ||
           '    UPDATE requests SET status = ''invited'' WHERE id = p_request_id;';

  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'the request-status block is not the shape this migration expected';
  END IF;
  v_src := replace(v_src, v_old, v_new);

  EXECUTE v_src;
END
$mig$;
