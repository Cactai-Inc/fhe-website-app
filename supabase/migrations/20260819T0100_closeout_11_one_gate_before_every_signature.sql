-- CLOSEOUT §1.1 + §1.2 (CONTRACTWALK A2 + A3) — one gate, before every signature.
--
-- Two defects, one edit:
--   A3: lock_and_sign_contract counted required fields naively (no included /
--       is_na / conditional_on awareness) while contract_lock_blockers is
--       condition-aware, so the screen showed no blockers while the gate refused
--       with "17 required field(s) still empty" — all 17 being conditionals the
--       UI hides and nobody can fill.
--   A2: every gate lived inside IF v_state IN ('editable'), on the assumption
--       that locked means unchanged. CONTRACTWALK disproved that: it blanked a
--       required field on a LOCKED document and signed anyway.
--
-- The fix: delete the gate block's own checks and delegate to
-- contract_lock_blockers — ONE function decides completeness; everything else
-- asks it — and run it before EVERY signature, whatever the state. A correctly
-- locked document simply passes again (one query, no user-visible cost).
--
-- 'executed' is also dropped from the accepted states: remove_my_signature
-- regresses a document to 'editable' on withdrawal, so no legitimate signature
-- ever arrives in the 'executed' state. A further signature on an executed
-- instrument is always a mistake, and D14's supersession flow is the real path.
--
-- Regression sweep 2026-08-19: all 51 live documents were compared — old gate-4
-- naive count vs contract_lock_blockers — every one returned 0 / 0 blockers, so
-- no existing document newly blocks under the delegated gate.

CREATE OR REPLACE FUNCTION public.lock_and_sign_contract(p_document_id uuid, p_party_role text, p_typed_name text, p_esign_consent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state text; v_blockers jsonb; v_msgs text; v_signed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT workflow_state INTO v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF v_state NOT IN ('locked','editable') THEN
    IF v_state = 'executed' THEN
      RAISE EXCEPTION 'document is already executed; changing it requires signatures to be removed first';
    END IF;
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%); lock it first', v_state;
  END IF;

  -- ONE function decides completeness. contract_lock_blockers carries the
  -- condition-aware required-field check, the open-change-request check, the
  -- LESSEE.PARTY_TYPE check, the horse-confirmation check and the
  -- document-before-contract wall — and it runs on every call, so a locked
  -- document altered after locking is caught here instead of signing anyway.
  v_blockers := contract_lock_blockers(p_document_id);
  IF jsonb_array_length(v_blockers) > 0 THEN
    SELECT string_agg(b->>'message', '; ') INTO v_msgs
      FROM jsonb_array_elements(v_blockers) b;
    RAISE EXCEPTION 'cannot sign: %', v_msgs;
  END IF;

  IF v_state = 'editable' THEN
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
    END IF;
  END IF;

  RETURN record_signature(p_document_id, p_party_role, p_typed_name, NULL, NULL,
                          coalesce(p_esign_consent, false));
END;
$function$;
