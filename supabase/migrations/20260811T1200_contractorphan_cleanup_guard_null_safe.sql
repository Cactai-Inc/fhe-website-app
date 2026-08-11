-- CONTRACTORPHAN follow-up — make the cleanup guard NULL-safe.
--
-- can_cleanup_document ended with:
--
--     RETURN has_staff_access() AND v_org = current_org();
--
-- For a caller whose current_org() is NULL, `v_org = current_org()` is NULL, and
-- `true AND NULL` is NULL — so the function returned NULL, not false. This is the
-- defect class D1a describes (docs/reference/D1a-PLATFORM-OWNER-IS-NOT-A-TENANT.md):
--
--   "…evaluates to NULL for a caller whose current_org() is NULL, so the IF skips
--    and the caller is admitted. For the platform owner that admission was the
--    accident. The denial is the correct behaviour."
--
-- IT WAS LIVE, NOT LATENT. `IF NOT can_cleanup_document(id) THEN RAISE …` never
-- fired, because `NOT NULL` is NULL and not TRUE. Proven against production
-- 2026-08-11, inside BEGIN … ROLLBACK, acting as admin@cactai.io: the platform
-- owner removed an FHE tenant document, `deleted_by` recorded as the platform
-- account. That is exactly the D1 violation the ruling forbids.
--
-- Only a caller who IS staff AND has a NULL org reaches the NULL: for a non-staff
-- caller the expression short-circuits to `false AND NULL` = false. Today that is
-- precisely admin@cactai.io (SUPER_ADMIN, org_id NULL).
--
-- THE PLATFORM OWNER BEING DENIED IS THE INTENDED END STATE, NOT A REGRESSION.
-- D1a settles this explicitly and names this task. Do not "fix" the denial, and do
-- not set org_id on admin@cactai.io — that recommendation is refused on the record.
--
-- Behaviour for every tenant staff caller is unchanged: has_staff_access() already
-- coalesces to false, and for a caller with a real org the comparison is a plain
-- boolean. The only value that changes is NULL -> false.

CREATE OR REPLACE FUNCTION public.can_cleanup_document(p_document_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_status text; v_dead boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT org_id, workflow_state, status,
         (voided_at IS NOT NULL OR terminated_at IS NOT NULL)
    INTO v_org, v_state, v_status, v_dead
    FROM documents
   WHERE id = p_document_id AND deleted_at IS NULL;

  -- unknown, already removed, or in a terminal state
  IF v_state IS NULL OR v_dead
     OR v_state IN ('executed', 'void', 'terminated')
     OR upper(coalesce(v_status, '')) IN ('EXECUTED', 'VOID', 'TERMINATED') THEN
    RETURN false;
  END IF;

  -- A document with a signature is never deletable from this UI. Ever.
  IF EXISTS (SELECT 1 FROM signatures s
              WHERE s.document_id = p_document_id
                AND s.deleted_at IS NULL) THEN
    RETURN false;
  END IF;

  -- coalesce is load-bearing: a NULL-org staff caller must be DENIED, not admitted
  -- by a NULL that every `IF NOT …` in the codebase silently skips. See D1a.
  RETURN coalesce(has_staff_access() AND v_org = current_org(), false);
END;
$function$;


-- Belt and braces on the destructive path itself. The guard above is the fix; this
-- makes cleanup_document refuse on its own even if the predicate is later changed
-- back to something that can return NULL. A three-word change on the one call that
-- deletes data is worth it.
CREATE OR REPLACE FUNCTION public.cleanup_document(p_document_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc    documents%ROWTYPE;
  v_horse  text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to remove a document';
  END IF;

  -- The guard is re-checked HERE, not merely consulted by the UI. A caller who
  -- reaches this function directly gets the same refusal the button does.
  -- NOT NULL is NULL, which is not TRUE, which skips the RAISE — so the guard is
  -- read through coalesce and the default is refusal.
  IF NOT coalesce(can_cleanup_document(p_document_id), false) THEN
    RAISE EXCEPTION 'this document cannot be removed: it is signed, executed, void, terminated, already removed, or you are not staff in this organisation';
  END IF;

  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  SELECT coalesce(h.nickname, h.registered_name) INTO v_horse
    FROM horses h WHERE h.id = v_doc.horse_id;

  UPDATE documents
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'document was already removed'; END IF;

  -- Every cleanup writes a status_events row naming what was removed and why.
  -- Written with a direct INSERT rather than log_status_event() on purpose: that
  -- helper would issue a second UPDATE on the documents row for any is_true_status
  -- code, which is exactly what aborts on a document with an orphaned contract_id.
  -- The (entity_type, status) foreign key to status_events_vocab still validates the
  -- code, so nothing is lost by not going through the helper.
  INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
  VALUES (v_doc.org_id, 'document', p_document_id, 'cleaned_up',
          'Removed from the document integrity panel: '
            || coalesce(v_doc.display_code, p_document_id::text)
            || ' (' || coalesce(v_doc.title, 'untitled')
            || ', horse ' || coalesce(v_horse, 'none') || ')'
            || ' — status ' || coalesce(v_doc.status, '?')
            || ', no signatures. Reason: ' || v_reason,
          auth.uid());

  RETURN jsonb_build_object(
    'id',           p_document_id,
    'display_code', v_doc.display_code,
    'title',        v_doc.title,
    'horse',        v_horse,
    'removed_at',   now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.can_cleanup_document(uuid)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_document(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cleanup_document(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_document(uuid, text) TO authenticated;
