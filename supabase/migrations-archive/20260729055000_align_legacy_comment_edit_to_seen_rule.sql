-- ─────────────────────────────────────────────────────────────────────────────
-- SWEEP FIX — the last function still enforcing the RETIRED lock-on-submit rule.
--
-- `edit_contract_comment` is the pre-rename edit verb. It survives, is still
-- exported by the frontend (src/lib/contracts.ts → editContractComment), and
-- still refuses with:
--
--     'this request was submitted for review and can no longer be edited'
--
-- That is precisely the behaviour the Notify model reverses. Left alone it would
-- be a second, contradictory edit path: `upsert_change_request` and
-- `edit_change_request_entry` allow the edit while unseen, and this one refuses
-- it the moment it was notified.
--
-- Re-pointed at the SAME predicate every other edit path uses,
-- `change_request_is_frozen`, so there is exactly one rule about editability in
-- the database and the Notify modal's promise holds no matter which verb the
-- client calls.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.edit_contract_comment(p_comment_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_author uuid; v_me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'comment body required'; END IF;

  SELECT document_id, author_contact_id INTO v_doc, v_author
    FROM contract_change_requests WHERE id = p_comment_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown comment'; END IF;

  v_me := current_contact_id();
  IF v_me IS NULL OR v_me <> v_author THEN
    RAISE EXCEPTION 'only the author may edit this comment';
  END IF;

  -- THE ONE EDITABILITY RULE. Being NOTIFIED does not freeze an entry; being
  -- SEEN by the other party does. Same predicate as upsert_change_request and
  -- edit_change_request_entry, and the same promise the Notify modal makes.
  IF change_request_is_frozen(p_comment_id) THEN
    RAISE EXCEPTION 'the other party has already seen this entry — it can no longer be edited';
  END IF;

  UPDATE contract_change_requests
     SET body = trim(p_body), edited_at = now(), updated_at = now()
   WHERE id = p_comment_id;

  RETURN jsonb_build_object('id', p_comment_id, 'edited', true);
END;
$function$;

COMMIT;
