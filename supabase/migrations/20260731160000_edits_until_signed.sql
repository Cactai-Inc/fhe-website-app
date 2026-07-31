-- ─────────────────────────────────────────────────────────────────────────────
-- EDITING STAYS OPEN UNTIL A SIGNATURE EXISTS (2026-07-31, owner)
--
-- WHAT WAS HAPPENING. document_changes_frozen() returns TRUE as soon as ANY
-- other party has OPENED the document:
--
--     SELECT EXISTS (SELECT 1 FROM document_opened o
--                     WHERE o.document_id = p_document_id
--                       AND o.contact_id IS DISTINCT FROM current_contact_id())
--
-- So the moment the Lessee clicked the link, the Lessor's own contract became
-- read-only — before anyone had signed anything, and with no way back. The owner
-- hit exactly this: "back to editing" moved the workflow state but the freeze is
-- independent of that state, so the document stayed locked.
--
-- Opening a document is not agreement to it. Freezing on a READ punishes the
-- normal case (both sides reviewing together) to protect against a case that a
-- signature already covers.
--
-- THE NEW RULE. Edits are refused only once a SIGNATURE exists. Before that the
-- document is fully editable by whoever holds the rights, however many people
-- have read it.
--
-- AFTER A SIGNATURE, an edit is still allowed — but it VOIDS that signature,
-- because a signature attests to a specific text and the text just changed.
-- The void is recorded (see 2), and the signer is told when the document is next
-- SENT, not the instant the field changes: an author usually makes several edits
-- in a row, and may revert them, and notifying on each keystroke would train
-- everyone to ignore the alert.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The freeze predicate: signature-based, not open-based ────────────────
CREATE OR REPLACE FUNCTION public.document_changes_frozen(
  p_document_id uuid, p_author_contact_id uuid DEFAULT NULL)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Nothing freezes a document that nobody has signed. The old rule froze on a
  -- counterparty OPENING it, which made a normal joint review lock the author
  -- out of their own draft.
  SELECT EXISTS (
    SELECT 1 FROM documents d
     WHERE d.id = p_document_id
       AND d.status = 'EXECUTED');
$function$;

COMMENT ON FUNCTION public.document_changes_frozen(uuid, uuid) IS
  'TRUE only once the document is fully EXECUTED. Reading a document never '
  'freezes it — the previous rule locked the author out as soon as any '
  'counterparty opened the draft. A partial signature does not freeze either; it '
  'is VOIDED by the edit instead (see void_signatures_on_edit), because a '
  'signature attests to a specific text.';

-- ── 2. An edit after a signature voids that signature ───────────────────────
-- Recorded rather than silent: the party is told at the next send that the text
-- changed and their signature was cleared.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signatures_voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS signatures_voided_roles text[];

COMMENT ON COLUMN documents.signatures_voided_at IS
  'When an edit last invalidated one or more signatures on this document. '
  'Cleared when the document is next sent for review, which is when the affected '
  'parties are told — an author edits in bursts and may revert, so alerting on '
  'each field change would make the alert meaningless.';

CREATE OR REPLACE FUNCTION public.void_signatures_on_edit(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_roles text[];
BEGIN
  SELECT array_agg(DISTINCT s.party_role) INTO v_roles
    FROM signatures s
   WHERE s.document_id = p_document_id AND s.deleted_at IS NULL;

  IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN RETURN; END IF;

  -- Soft-delete: the signature is no longer in force, but the RECORD that it was
  -- given, and when, is evidence and is never destroyed.
  UPDATE signatures SET deleted_at = now()
   WHERE document_id = p_document_id AND deleted_at IS NULL;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         status = CASE WHEN status = 'EXECUTED' THEN status ELSE 'AWAITING_SIGNATURE' END
   WHERE id = p_document_id;
END
$function$;

COMMENT ON FUNCTION public.void_signatures_on_edit(uuid) IS
  'Clears signatures after the signed text changes. The signature rows are '
  'SOFT-deleted — that someone signed, and when, stays on the record even though '
  'the signature no longer stands.';

-- ── 3. Wire it into the field writers ───────────────────────────────────────
-- Both writers already call document_changes_frozen; they now also void any
-- standing signature when the edit lands.
DO $do$
DECLARE
  v_def text;
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['set_contract_field', 'set_field_structured'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = fn;
    IF v_def IS NULL THEN CONTINUE; END IF;
    IF position('void_signatures_on_edit' in v_def) > 0 THEN
      RAISE NOTICE '% already voids signatures — skipping', fn;
      CONTINUE;
    END IF;
    IF position('the other party has already opened this document' in v_def) = 0 THEN
      RAISE NOTICE '% has no freeze block to anchor on — skipping', fn;
      CONTINUE;
    END IF;
    v_def := replace(v_def,
      'RAISE EXCEPTION ''the other party has already opened this document — your changes can no longer be edited'';',
      'RAISE EXCEPTION ''this contract is fully executed — it can no longer be edited'';');
    v_def := replace(v_def, '  END IF;' || E'\n' || E'\n' || '  v_is_staff',
      '  END IF;' || E'\n\n'
      || '  -- An edit changes the text a signature attested to, so any standing' || E'\n'
      || '  -- signature is voided here. The signer is told at the next SEND.' || E'\n'
      || '  PERFORM void_signatures_on_edit(p_document_id);' || E'\n\n'
      || '  v_is_staff');
    EXECUTE v_def;
    RAISE NOTICE '% now voids signatures on edit', fn;
  END LOOP;
END
$do$;
