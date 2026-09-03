-- CR-101 · A1 — no period after a signature line. (TASK-SIGNFLOW-H, 2026-09-03)
--
-- Owner, 2026-09-02: "we dont need a (.) at the end of a line that has a
-- signature in it. that doesnt even make sense to be there in the first place.
-- remove it and the issue you raised is no longer an issue."
--
-- R5 (2026-08-04) made the composer the single author of terminal punctuation
-- for token-bearing lines. A signature-block line ("Signature: {{SIG.X.NAME}}",
-- "Date: {{SIG.X.DATE}}") carries a token the composer deliberately leaves in
-- place (:144) so it can resolve at signing time (record_signature) or display
-- time (documentBody.ts). The R5 guard runs BEFORE that resolution, sees a
-- line that "says something", and appends "." — which survives as
-- "Signature: ." on an unsigned page and "Signature: Pamela Godde." once signed.
--
-- The composer already computes v_has_sig for the line it is punctuating
-- (:128-134). This rewrite makes the R5 period site respect that flag. Nothing
-- else moves: the colon guard (:179), the authored-line site (:113-115) and
-- every other line's period are untouched.
--
-- Shape: the function's own in-place idiom (20260804120001) — read the live
-- definition, assert the anchor once, replace, EXECUTE. CREATE OR REPLACE keeps
-- proacl ({postgres, authenticated, service_role}; no anon). NO DROP.
-- This migration writes NO document row: the one affected body (the live lease
-- 7adcd08f, AWAITING_SIGNATURE) re-composes on its next normal open
-- (ContractPage → regenerate_contract_document → this function). Executed
-- bodies are evidence (D32/D33) and this function cannot reach them: all 81
-- have contract_id IS NULL, so regenerate returns the stored body before
-- composing. Measured 2026-09-03.

DO $do$
DECLARE v_src text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'remerge_contract_from_clauses';
  IF v_src IS NULL THEN RAISE EXCEPTION 'remerge_contract_from_clauses not found'; END IF;

  v_old := $q$          /* R5 (2026-08-04): sentence-terminal punctuation is appended HERE,
             not authored into the body. The clause bodies used to end
             "…: {{TOKEN}}." which produced an orphan "." under a full-width
             input in the editor and a doubled ".." whenever the signer typed
             their own period. Now: if the composed line ends with a filled
             token and lacks terminal punctuation, add one. A line whose token
             resolved to empty gets nothing, so no orphan period survives. */
          /* Only punctuate a line that actually SAYS something: a line whose
             token resolved to empty ends in its lead-in colon ("are: ") and
             must stay bare rather than becoming "are: ." — the unanswered
             field is already flagged by the required marker. */
          IF btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN$q$;
  v_new := $q$          /* R5 (2026-08-04): sentence-terminal punctuation is appended HERE,
             not authored into the body. The clause bodies used to end
             "…: {{TOKEN}}." which produced an orphan "." under a full-width
             input in the editor and a doubled ".." whenever the signer typed
             their own period. Now: if the composed line ends with a filled
             token and lacks terminal punctuation, add one. A line whose token
             resolved to empty gets nothing, so no orphan period survives. */
          /* Only punctuate a line that actually SAYS something: a line whose
             token resolved to empty ends in its lead-in colon ("are: ") and
             must stay bare rather than becoming "are: ." — the unanswered
             field is already flagged by the required marker. */
          /* CR-101·A1 (owner, 2026-09-02): "we dont need a (.) at the end of a
             line that has a signature in it." A signature-block line keeps its
             SIG.* token here (skipped above) and resolves it at signing time
             (record_signature) or display time (documentBody.ts), where this
             guard cannot see the result — so the "." it would add became
             "Signature: ." unsigned and "Name." signed. v_has_sig, computed
             above for this very line, is the flag: the whole block (NAME and
             DATE lines) is exempt. Every other token line keeps its period. */
          IF NOT v_has_sig AND btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN$q$;

  IF position(v_new in v_src) > 0 THEN RETURN; END IF;            -- already patched
  IF position(v_old in v_src) = 0 THEN
    RAISE EXCEPTION 'remerge_contract_from_clauses rewrite did not match its anchor';
  END IF;
  IF (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'remerge_contract_from_clauses anchor matched more than once';
  END IF;
  v_src := replace(v_src, v_old, v_new);
  EXECUTE v_src;
END $do$;
