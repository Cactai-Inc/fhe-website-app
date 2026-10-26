-- cf (contract-first) STEP 6 — the DELIVERY-SET MARKER replaces every hold mechanism.
--
-- One marker, documents.delivery_set_id, identifies the one delivery set a document
-- belongs to. Every document generated for an event carries the event's set id —
-- contract sets and non-contract onboarding sets ALIKE. One predicate
-- (delivery_set_complete) drives delivery: every document in the set is EXECUTED.
-- Then one email per signer carries every document in the set and lists what it
-- contains. Nothing in a set delivers before the set completes, never per document.
--
-- WHAT THIS REMOVES COMPLETELY (owner-approved):
--   · the 6-hour window (hold rule b): document_delivery_holds + open_document_delivery_hold
--     + hold_my_document_delivery.
--   · rule (a)'s cross-contract reach ("any other non-executed doc for this contact").
--   · the contract-axis rule (c) is REPLACED by the set marker (contract docs get
--     delivery_set_id = contract_id, so the set IS the contract's sequenced docs).
--   · the sweep's partial-set release: flush now only re-POSTs a COMPLETE set that
--     failed to send, never a timed-out partial one.
--
-- THE SET IS KNOWN BEFORE ANYONE SIGNS. The bundle is generated at SEND (disc_50/51),
-- so stamping the marker there (ensure_contract_role_documents) makes the set complete-
-- test meaningful throughout signing — no transient "only the governing doc exists"
-- window. Non-contract runs stamp one set id per run in generate_my_onboarding_documents.

BEGIN;

-- ── 1. the marker column ────────────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS delivery_set_id uuid;
CREATE INDEX IF NOT EXISTS idx_documents_delivery_set ON documents(delivery_set_id)
  WHERE delivery_set_id IS NOT NULL;

-- Backfill contract sets: every document on a contract is in one set, keyed by the
-- contract. (Non-contract onboarding docs already in flight are left NULL — a NULL
-- set delivers as a single document, which is the pre-marker single-doc path and
-- regresses nothing already sent. New onboarding runs stamp a real set id.)
UPDATE documents SET delivery_set_id = contract_id
 WHERE contract_id IS NOT NULL AND delivery_set_id IS NULL AND deleted_at IS NULL;

-- ── 2. the ONE completion predicate (generalizes contract_signing_set_complete) ─
CREATE OR REPLACE FUNCTION public.delivery_set_complete(p_set_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p_set_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM documents d
     WHERE d.delivery_set_id = p_set_id
       AND d.deleted_at IS NULL
       AND d.status NOT IN ('EXECUTED', 'VOID')
       AND coalesce(d.workflow_state, '') <> 'void');
$function$;

-- contract_signing_set_complete now defers to the set predicate, keyed on the
-- contract's own set id (= contract_id by the backfill + the stamp below). Kept as
-- a thin alias because existing callers (documents_send_executed_email and tests)
-- reference it by name.
CREATE OR REPLACE FUNCTION public.contract_signing_set_complete(p_contract_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT delivery_set_complete(p_contract_id);
$function$;

-- ── 3. hold = in a set that is not complete. Nothing else. ──────────────────
CREATE OR REPLACE FUNCTION public.document_delivery_is_held(p_document_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- A document belongs to a delivery set iff delivery_set_id is set. It is held
  -- while any sibling in that set is unexecuted. A document with NO set
  -- (delivery_set_id NULL) is never held — it delivers as a single document.
  SELECT EXISTS (
    SELECT 1 FROM documents d
     WHERE d.id = p_document_id
       AND d.delivery_set_id IS NOT NULL
       AND NOT delivery_set_complete(d.delivery_set_id));
$function$;

-- ── 4. deliver the whole set, one email per signer, listing its contents ────
-- Re-bases set assembly on delivery_set_id (was contract_id). The set is "every
-- executed, undelivered document that shares this document's delivery_set_id" plus
-- the anchor contact's own loose executed docs (a NULL-set single document). One
-- POST to /api/deliver-documents, which already groups to one email per signer and
-- attaches each PDF; the enclosed-documents list is built from the set.
CREATE OR REPLACE FUNCTION public.deliver_executed_document_set(p_contact_id uuid, p_include uuid DEFAULT NULL::uuid, p_context jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ids  uuid[];
  v_org  uuid;
  v_base text;
  v_req  bigint;
BEGIN
  -- Callers: the execution trigger, the sweep (service_role), staff, and a person
  -- flushing THEIR OWN set to themselves (SIGNBOOK). Unchanged authorization.
  IF NOT (pg_trigger_depth() > 0
          OR coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access(), false)
          OR (p_contact_id IS NOT NULL AND p_contact_id = current_contact_id())
          OR auth.uid() IS NULL AND auth.role() IS NULL) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'no contact');
  END IF;

  WITH deliverable AS (
    SELECT d.id, d.delivery_set_id, d.contact_id, d.generated_at, d.created_at
      FROM documents d
     WHERE d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND d.executed_email_sent_at IS NULL
       AND (d.delivery_held_at IS NOT NULL OR d.id = p_include)
       AND NOT EXISTS (
         SELECT 1 FROM signatures s
          WHERE s.document_id = d.id AND s.deleted_at IS NULL AND s.signed_at IS NULL)
  ), anchored AS (
    SELECT * FROM deliverable WHERE contact_id = p_contact_id
  )
  SELECT array_agg(x.id ORDER BY x.generated_at, x.created_at)
    INTO v_ids
    FROM (
      SELECT * FROM anchored
      UNION
      -- the rest of the SAME delivery SET's undelivered documents (contract set
      -- or non-contract onboarding set — one marker, one rule)
      SELECT dl.* FROM deliverable dl
       WHERE dl.delivery_set_id IS NOT NULL
         AND dl.delivery_set_id IN (SELECT a.delivery_set_id FROM anchored a WHERE a.delivery_set_id IS NOT NULL)
    ) x;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'nothing to deliver');
  END IF;

  SELECT d.org_id INTO v_org FROM documents d WHERE d.id = v_ids[1];

  SELECT value_text INTO v_base FROM config_values
   WHERE org_id = v_org AND namespace = 'SYSTEM' AND key = 'APP_BASE_URL';
  IF coalesce(btrim(v_base), '') = '' THEN
    UPDATE documents SET executed_email_error = 'APP_BASE_URL not configured'
     WHERE id = ANY(v_ids);
    RETURN jsonb_build_object('sent', false, 'reason', 'no base url',
                              'documents', array_length(v_ids, 1));
  END IF;

  SELECT net.http_post(
           url     := v_base || '/api/deliver-documents',
           body    := jsonb_build_object(
                        'documentIds',
                        (SELECT jsonb_agg(x::text) FROM unnest(v_ids) x))
                      || CASE WHEN p_context IS NULL THEN '{}'::jsonb
                              ELSE jsonb_build_object('context', p_context) END,
           headers := '{"Content-Type": "application/json"}'::jsonb,
           timeout_milliseconds := 15000
         ) INTO v_req;

  UPDATE documents
     SET executed_email_sent_at = now(),
         executed_email_error   = NULL,
         delivery_held_at       = NULL
   WHERE id = ANY(v_ids);

  RETURN jsonb_build_object(
    'sent', true, 'request_id', v_req, 'documents', array_length(v_ids, 1));
END;
$function$;

-- ── 5. the execution trigger, now set-marker driven ─────────────────────────
-- On EXECUTED: if the document is in a set and the set is complete, deliver the
-- whole set; if in a set but incomplete, hold; if in NO set, the unchanged single-
-- document path. NEVER a single document's own email for a doc that belongs to a set.
CREATE OR REPLACE FUNCTION public.documents_send_executed_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_anchor uuid;
BEGIN
  IF NEW.status = 'EXECUTED' AND OLD.status IS DISTINCT FROM 'EXECUTED'
     AND NEW.executed_email_sent_at IS NULL THEN
    BEGIN
      IF NEW.delivery_set_id IS NOT NULL THEN
        IF delivery_set_complete(NEW.delivery_set_id) THEN
          -- The set is finished. One delivery call ships the whole set as one
          -- email per signer, reaching across the set for siblings held under
          -- other anchors. Anchor on this doc's contact, else any set member that
          -- still has a contact and is undelivered.
          v_anchor := coalesce(NEW.contact_id, (
            SELECT d2.contact_id FROM documents d2
             WHERE d2.delivery_set_id = NEW.delivery_set_id AND d2.deleted_at IS NULL
               AND d2.contact_id IS NOT NULL AND d2.status = 'EXECUTED'
               AND d2.executed_email_sent_at IS NULL
             ORDER BY d2.generated_at, d2.created_at LIMIT 1));
          IF v_anchor IS NOT NULL THEN
            PERFORM deliver_executed_document_set(v_anchor, NEW.id);
          ELSE
            -- a set with no contact anchor anywhere: single-document path
            PERFORM send_executed_document_email(NEW.id);
          END IF;
        ELSE
          -- Set incomplete: hold. The last execution in the set flushes it.
          UPDATE documents SET delivery_held_at = coalesce(delivery_held_at, now())
           WHERE id = NEW.id;
        END IF;
      ELSIF NEW.contact_id IS NULL THEN
        -- No set and no contact (a lone multi-party instrument): single-document path.
        PERFORM send_executed_document_email(NEW.id);
      ELSE
        -- No set, a contact anchor: single-document delivery (unchanged).
        PERFORM deliver_executed_document_set(NEW.contact_id, NEW.id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE documents SET executed_email_error = SQLERRM WHERE id = NEW.id;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 6. the sweep: re-POST a COMPLETE set only, never a timed-out partial ────
CREATE OR REPLACE FUNCTION public.flush_held_executed_document_emails(p_hold_minutes integer DEFAULT 30)
 RETURNS TABLE(contact_id uuid, documents integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r     RECORD;
  v_out jsonb;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- A held document whose SET IS COMPLETE but which never mailed (a failed POST).
  -- NOTHING partial is ever flushed: a doc whose set is still open stays held until
  -- its last sibling executes. p_hold_minutes only debounces the retry of a
  -- complete-but-unsent set, it never releases a partial one.
  FOR r IN
    SELECT DISTINCT d.contact_id AS cid
      FROM documents d
     WHERE d.delivery_held_at IS NOT NULL
       AND d.executed_email_sent_at IS NULL
       AND d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND d.contact_id IS NOT NULL
       AND d.delivery_set_id IS NOT NULL
       AND delivery_set_complete(d.delivery_set_id)
       AND d.delivery_held_at < now() - make_interval(mins => greatest(p_hold_minutes, 1))
  LOOP
    v_out := deliver_executed_document_set(r.cid, NULL);
    IF coalesce((v_out->>'sent')::boolean, false) THEN
      contact_id := r.cid;
      documents  := coalesce((v_out->>'documents')::int, 0);
      RETURN NEXT;
    END IF;
  END LOOP;

  -- A held anchor-less document (no contact AND no set, or a complete set with no
  -- contact) still needs a home. Sent on its own, since there is no set to batch.
  FOR r IN
    SELECT d.id AS did
      FROM documents d
     WHERE d.delivery_held_at IS NOT NULL
       AND d.executed_email_sent_at IS NULL
       AND d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND d.contact_id IS NULL
       AND (d.delivery_set_id IS NULL OR delivery_set_complete(d.delivery_set_id))
       AND d.delivery_held_at < now() - make_interval(mins => greatest(p_hold_minutes, 1))
  LOOP
    v_out := send_executed_document_email(r.did);
    IF coalesce((v_out->>'sent')::boolean, false) THEN
      UPDATE documents SET delivery_held_at = NULL WHERE id = r.did;
      contact_id := NULL;
      documents  := 1;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

-- ── 7. stamp the CONTRACT set marker where the bundle is generated (at send) ─
-- ensure_contract_role_documents sequences the governing doc (sign_sequence 1) and
-- each role-bundle doc behind it. Every one is in the contract's delivery set, so
-- the set id IS the contract id (matching the backfill). Two in-place stamps:
--   · the governing-doc UPDATE that sets sign_sequence 1 also sets delivery_set_id;
--   · each generated bundle doc's finalising UPDATE also sets delivery_set_id.
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.ensure_contract_role_documents(uuid)'::regprocedure);
  v_gov_old text := 'UPDATE documents SET sign_sequence = 1
   WHERE id = p_document_id AND sign_sequence IS NULL;';
  v_gov_new text := 'UPDATE documents SET sign_sequence = 1
   WHERE id = p_document_id AND sign_sequence IS NULL;
  -- cf STEP 6: the governing document joins the contract''s delivery set.
  UPDATE documents SET delivery_set_id = v_contract
   WHERE id = p_document_id AND delivery_set_id IS NULL;';
  v_doc_old text := 'UPDATE documents
       SET status         = ''AWAITING_SIGNATURE'',
           sign_sequence  = v_seq,
           workflow_state = CASE WHEN v_fields = 0 THEN ''locked'' ELSE workflow_state END
     WHERE id = v_doc;';
  v_doc_new text := 'UPDATE documents
       SET status         = ''AWAITING_SIGNATURE'',
           sign_sequence  = v_seq,
           delivery_set_id = v_contract,
           workflow_state = CASE WHEN v_fields = 0 THEN ''locked'' ELSE workflow_state END
     WHERE id = v_doc;';
BEGIN
  IF position(v_gov_old in v_src) = 0 THEN RAISE EXCEPTION 'ecrd governing-doc UPDATE not found'; END IF;
  IF position(v_doc_old in v_src) = 0 THEN RAISE EXCEPTION 'ecrd bundle-doc UPDATE not found'; END IF;
  v_src := replace(v_src, v_gov_old, v_gov_new);
  v_src := replace(v_src, v_doc_old, v_doc_new);
  EXECUTE v_src;
END $mig$;

-- ── 8. stamp the NON-CONTRACT onboarding set marker (one id per run) ────────
-- generate_my_onboarding_documents generates/reuses every document a contact owes
-- in a single call. That call IS one delivery set. Mint one id for the run and
-- stamp it on each document the run touches, so the set delivers as one email even
-- though these documents carry no contract_id and no sign_sequence.
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.generate_my_onboarding_documents()'::regprocedure);
  -- declare the run set id beside the existing locals
  v_decl_old text := '  v_keep_horses uuid[];   -- the member''s bound horse set for this template';
  v_decl_new text := '  v_keep_horses uuid[];   -- the member''s bound horse set for this template
  v_set     uuid := gen_random_uuid();  -- cf STEP 6: one delivery set per run';
  -- after each iteration resolves v_doc, stamp the run set id on it. The anchor is
  -- reproduced with the body's exact indentation (4 spaces on v_out, 6 on the
  -- continuation lines) so the in-place replace matches.
  v_stamp_anchor text := '    v_out := v_out || jsonb_build_object(
      ''document_id'', v_doc, ''template_key'', req.template_key,
      ''title'', v_title, ''status'', v_status);';
  v_stamp_new text := '    -- cf STEP 6: every document this run touches joins the one onboarding set
    IF v_doc IS NOT NULL THEN
      UPDATE documents SET delivery_set_id = v_set
       WHERE id = v_doc AND status <> ''EXECUTED'' AND delivery_set_id IS NULL;
    END IF;
    v_out := v_out || jsonb_build_object(
      ''document_id'', v_doc, ''template_key'', req.template_key,
      ''title'', v_title, ''status'', v_status);';
BEGIN
  IF position(v_decl_old in v_src) = 0 THEN RAISE EXCEPTION 'gmod decl anchor not found'; END IF;
  IF position(v_stamp_anchor in v_src) = 0 THEN RAISE EXCEPTION 'gmod stamp anchor not found'; END IF;
  v_src := replace(v_src, v_decl_old, v_decl_new);
  v_src := replace(v_src, v_stamp_anchor, v_stamp_new);
  EXECUTE v_src;
END $mig$;

-- ── 9. drop the holds-table references from the two remaining consumers ─────
-- mark_document_set_delivered (called by /api/deliver-documents) marks docs sent;
-- its trailing UPDATE of document_delivery_holds goes with the table. The
-- mark-delivered behaviour on `documents` is unchanged.
CREATE OR REPLACE FUNCTION public.mark_document_set_delivered(p_document_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_n integer;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_document_ids IS NULL OR array_length(p_document_ids, 1) IS NULL THEN RETURN 0; END IF;

  WITH upd AS (
    UPDATE documents
       SET executed_email_sent_at = coalesce(executed_email_sent_at, now()),
           delivery_held_at       = NULL,
           executed_email_error   = NULL
     WHERE id = ANY(p_document_ids)
    RETURNING contact_id)
  SELECT count(*) INTO v_n FROM upd;
  RETURN v_n;
END;
$function$;

-- admin_purge_contact deletes the contact's holds rows; drop that one statement
-- (the table is gone). Everything else it purges is untouched. The line is removed
-- outright, not commented out — the body documents current state, not history.
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.admin_purge_contact(uuid,text)'::regprocedure);
  v_old text := '
  DELETE FROM document_delivery_holds  WHERE contact_id = p_contact_id;';
BEGIN
  IF position(v_old in v_src) = 0 THEN RAISE EXCEPTION 'admin_purge_contact holds DELETE not found'; END IF;
  v_src := replace(v_src, v_old, '');
  EXECUTE v_src;
END $mig$;

-- ── 10. REMOVE the replaced hold mechanisms completely ──────────────────────
-- The 6-hour window and its opener. hold_my_document_delivery was called only by the
-- self-serve wizard (src/lib/api.ts), which this change stops calling. The holds
-- table itself is machinery, not a record (D32 scope): the runs it tracked are now
-- tracked by delivery_set_id. Nothing else references open_document_delivery_hold.
DROP FUNCTION IF EXISTS public.hold_my_document_delivery();
DROP FUNCTION IF EXISTS public.open_document_delivery_hold(uuid, uuid, text, text);
DROP TABLE IF EXISTS public.document_delivery_holds;

COMMIT;
