-- ─────────────────────────────────────────────────────────────────────────────
-- OWNER-FINAL 1 — VOID UNIFICATION + TOTAL CANCEL EXCISION.
--
-- (A) STAFF GET THE SAME VOID PATH AS PARTIES.
--     `can_void_document` previously required `caller_is_document_party`, so a
--     staff member had no void at all — they had Cancel instead. Cancel is being
--     removed entirely, so staff must void through the SAME function, the SAME
--     3-page modal, the SAME note field, the SAME counterparty notification.
--
--     Staff eligibility rule (mirrors the party rule as closely as it can):
--       • staff-in-org may void while the document is alive and not executed;
--       • if that staff member is ALSO a party (the FHE owner signs as LESSOR on
--         his own leases), the party rule still applies to them — once THEY have
--         signed, voiding is gone, exactly as for any other party. Staff status
--         does not buy a second bite after signing.
--
--     PER-PARTY KEEP/REMOVE FOR A NON-PARTY STAFF VOIDER — DECISION:
--       "Remove" is a row in `document_party_hidden` keyed by contact_id, and it
--       only ever hides the document from THAT contact's own documents page.
--       Staff do not read their documents through that page — `my_contract_documents`
--       takes the STAFF branch, which deliberately ignores document_party_hidden
--       ("the legal record is never hidden from ops"). So a hide row written by a
--       non-party staff voider would be inert by construction.
--       Rather than write an inert row, `void_document` now REPORTS whether the
--       keep/remove choice applies to the caller, via `offer_keep_remove` in its
--       return value:
--         • caller is a party            → true  (page 2 of the modal is shown)
--         • caller is staff, not a party → false (the modal skips to success)
--       Every PARTY still gets their own keep/remove choice through the
--       notification, unchanged. Nothing about the counterparty experience differs
--       between a staff void and a party void.
--
-- (B) THE CANCEL PATH IS EXCISED, NOT DEPRECATED.
--     Evidence check run against prod BEFORE writing this migration:
--       documents: 57 rows, 0 with cancelled_at, 0 with status 'CANCELLED',
--                  0 with current_status 'cancelled'
--       status_events_vocab: NO 'cancelled' code exists for entity_type='document'
--                  (the document vocab is assigned/sent_for_review/sent/send_failed/
--                   in_progress/viewed/downloaded/review_approved/ready_to_sign/
--                   signed/superseded/void) — so there is no vocab row to retire.
--       status_events: no row anywhere carries a cancel status.
--       notifications: 2 HISTORICAL rows of kind 'contract_cancelled'
--                  (2026-07-16, "Horse Lease Agreement was cancelled — awaiting
--                  archive or delete"). THESE ARE EVIDENCE AND ARE NOT DELETED.
--     So: the FUNCTION goes, the COLUMNS go (they are provably empty), and the
--     two historical notification rows stay exactly as they are. Because the
--     columns are dropped, `my_notifications` — which filtered that notification
--     kind on `d.cancelled_at IS NOT NULL` — is rewritten so those two rows simply
--     stop being surfaced as live to-dos while remaining in the table.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── (A) can_void_document — staff included ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_void_document(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_state text; v_org uuid; v_cid uuid; v_dead boolean;
  v_is_party boolean; v_is_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  v_cid := current_contact_id();

  SELECT org_id, workflow_state,
         (voided_at IS NOT NULL OR terminated_at IS NOT NULL)
    INTO v_org, v_state, v_dead
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_state IS NULL OR v_dead OR v_state IN ('executed','void','terminated') THEN
    RETURN false;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_party := caller_is_document_party(p_document_id);
  IF NOT (v_is_staff OR v_is_party) THEN RETURN false; END IF;

  -- The party rule binds anyone who IS a party — including a staff member who
  -- signs as a party. Once you have signed, you can no longer void.
  IF v_is_party AND v_cid IS NOT NULL AND EXISTS (
    SELECT 1 FROM signatures s
     WHERE s.document_id = p_document_id
       AND s.deleted_at IS NULL AND s.signed_at IS NOT NULL
       AND s.signer_contact_id = v_cid) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

COMMENT ON FUNCTION public.can_void_document(uuid) IS
  'True while the caller may void: a party who has not yet signed, OR staff-in-org '
  'on a document that is alive and not executed. A staff member who is also a party '
  'loses the option once THEY sign, exactly like any other party.';

-- ── void_document — same flow for staff; reports keep/remove applicability ───
CREATE OR REPLACE FUNCTION public.void_document(p_document_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_title text; v_cid uuid; v_label text; v_note text;
  v_party record; v_n int := 0; v_is_party boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT can_void_document(p_document_id) THEN
    RAISE EXCEPTION 'you can no longer void this document';
  END IF;

  SELECT org_id, coalesce(title,'A contract') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;

  v_is_party := caller_is_document_party(p_document_id);

  -- comment_author_identity resolves a PARTY label; a non-party staff voider gets
  -- their own contact + a staff label so the counterparty sees who acted.
  SELECT contact_id, label INTO v_cid, v_label FROM comment_author_identity(p_document_id);
  IF v_cid IS NULL THEN
    v_cid := current_contact_id();
    SELECT coalesce(nullif(trim(c.full_name), ''), 'The barn') INTO v_label
      FROM contacts c WHERE c.id = v_cid;
    v_label := coalesce(v_label, 'The barn');
  END IF;

  v_note := nullif(trim(coalesce(p_note,'')), '');

  UPDATE documents
     SET workflow_state = 'void',
         voided_at      = now(),
         voided_by      = v_cid,
         void_reason    = v_note,
         status         = 'VOID'
   WHERE id = p_document_id;

  PERFORM log_contract_change(p_document_id, 'document_voided', NULL, 'Document',
                              NULL, NULL, 'void',
                              jsonb_build_object('note', coalesce(v_note,''),
                                                 'by_staff', NOT v_is_party));

  -- notify every OTHER party, note included — identical for a staff void
  FOR v_party IN
    SELECT DISTINCT dp.contact_id FROM document_parties dp
     WHERE dp.document_id = p_document_id
       AND dp.contact_id IS DISTINCT FROM v_cid
  LOOP
    v_n := v_n + 1;
    PERFORM contract_notify(p_document_id, v_party.contact_id, 'contract_voided',
      coalesce(v_label,'The other party') || ' voided ' || v_title,
      coalesce(v_note, 'No reason was given.')
        || E'\n\nYou can keep a copy on your documents page or remove it from your view.');
  END LOOP;

  RETURN jsonb_build_object(
    'voided', true,
    'notified', v_n,
    'note', v_note,
    'by_staff', NOT v_is_party,
    -- page 2 (keep/remove) is only meaningful for a voider who is a PARTY: the
    -- hide flag governs a party's documents page, and staff read through the ops
    -- branch that deliberately ignores it.
    'offer_keep_remove', v_is_party);
END;
$function$;

-- ── (B) EXCISION ─────────────────────────────────────────────────────────────

-- my_notifications: drop the cancelled-document validity rule. The two historical
-- 'contract_cancelled' rows STAY IN THE TABLE (evidence); they simply no longer
-- resolve as a live to-do, because the state they pointed at no longer exists.
-- The link-validity rule is preserved verbatim. Only the cancelled-document
-- clause is replaced: it referenced documents.cancelled_at, which is being
-- dropped. Its purpose was to stop an "awaiting archive/delete" to-do outliving
-- the cancelled document it pointed at. With the cancel path gone, no such
-- document can exist, so the kind is simply never surfaced. The two historical
-- 'contract_cancelled' rows REMAIN IN THE TABLE untouched.
CREATE OR REPLACE FUNCTION public.my_notifications(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
      'link', n.link, 'read_at', n.read_at, 'created_at', n.created_at)
      ORDER BY n.created_at DESC, n.id DESC), '[]'::jsonb)
  FROM (
    SELECT * FROM notifications
    WHERE user_id = auth.uid()
      -- a contract-linked notification is only valid while its document exists and
      -- is not soft-deleted; non-contract notifications are unaffected.
      AND (
        link IS NULL
        OR link !~ '^/app/contracts/[0-9a-fA-F-]{36}$'
        OR EXISTS (
          SELECT 1 FROM documents d
          WHERE d.id = regexp_replace(link, '^/app/contracts/', '')::uuid
            AND d.deleted_at IS NULL
        )
      )
      -- RETIRED: the cancel path no longer exists. Its historical notifications
      -- stay in the table as evidence but are never surfaced as live to-dos.
      AND kind <> 'contract_cancelled'
      AND title NOT ILIKE '%awaiting archive%'
    ORDER BY created_at DESC, id DESC
    LIMIT greatest(coalesce(p_limit, 20), 1)
  ) n
$function$;

-- my_contract_documents + contract_document_detail both SELECT d.cancelled_at.
-- Drop that projection so the column can go. Everything else is byte-identical
-- to the 20260729043000 bodies.
CREATE OR REPLACE FUNCTION public.my_contract_documents()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me    uuid := current_contact_id();
  v_staff boolean := has_staff_access();
  v_org   uuid := current_org();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF v_staff AND v_org IS NOT NULL THEN
    RETURN coalesce((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
      FROM (
        SELECT DISTINCT
          d.id AS document_id, d.title, d.status, d.workflow_state,
          d.recipient_editing, d.execution_hash, d.generated_at, d.sent_at,
          d.archived_at, d.voided_at, d.void_reason,
          (SELECT dpa.archived_at FROM document_party_archives dpa
            WHERE dpa.document_id = d.id AND dpa.contact_id = v_me) AS my_archived_at,
          (SELECT dph.hidden_at FROM document_party_hidden dph
            WHERE dph.document_id = d.id AND dph.contact_id = v_me) AS my_hidden_at,
          (d.originator_contact_id = v_me) AS is_originator,
          (SELECT string_agg(dp.party_role, ',' ORDER BY dp.party_role)
             FROM document_parties dp
            WHERE dp.document_id = d.id AND dp.contact_id = v_me) AS my_roles,
          (SELECT count(*) FROM contract_change_requests cr
            WHERE cr.document_id = d.id AND cr.parent_request_id IS NULL
              AND cr.submitted_at IS NOT NULL AND cr.resolved_at IS NULL) AS open_change_requests
        FROM documents d
        WHERE d.deleted_at IS NULL
          AND d.org_id = v_org
          AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
      ) t
    ), '[]'::jsonb);
  END IF;

  IF v_me IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
    FROM (
      SELECT DISTINCT
        d.id AS document_id, d.title, d.status, d.workflow_state,
        d.recipient_editing, d.execution_hash, d.generated_at, d.sent_at,
        d.archived_at, d.voided_at, d.void_reason,
        (SELECT dpa.archived_at FROM document_party_archives dpa
          WHERE dpa.document_id = d.id AND dpa.contact_id = v_me) AS my_archived_at,
        NULL::timestamptz AS my_hidden_at,
        (d.originator_contact_id = v_me) AS is_originator,
        (SELECT string_agg(dp.party_role, ',' ORDER BY dp.party_role)
           FROM document_parties dp
          WHERE dp.document_id = d.id AND dp.contact_id = v_me) AS my_roles,
        (SELECT count(*) FROM contract_change_requests cr
          WHERE cr.document_id = d.id AND cr.parent_request_id IS NULL
            AND cr.submitted_at IS NOT NULL AND cr.resolved_at IS NULL) AS open_change_requests
      FROM documents d
      JOIN document_parties dp2 ON dp2.document_id = d.id
      WHERE d.deleted_at IS NULL
        AND dp2.contact_id = v_me
        AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
        AND NOT EXISTS (SELECT 1 FROM document_party_hidden dph
                         WHERE dph.document_id = d.id AND dph.contact_id = v_me)
    ) t
  ), '[]'::jsonb);
END;
$function$;

-- contract_document_detail: drop 'cancelled_at' from the document object. Done by
-- reading the live body and removing exactly that projection, so every other part
-- of this large function is preserved byte-for-byte.
DO $do$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'contract_document_detail'
     AND pronamespace = 'public'::regnamespace;
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'contract_document_detail not found';
  END IF;
  IF position('''cancelled_at'', d.cancelled_at,' IN v_src) = 0 THEN
    RAISE EXCEPTION 'expected cancelled_at projection not found in contract_document_detail';
  END IF;
  v_src := replace(v_src, '''cancelled_at'', d.cancelled_at,', '');
  EXECUTE v_src;
END
$do$;

-- the function itself
DROP FUNCTION IF EXISTS public.cancel_contract(uuid);

-- the columns (verified empty above)
ALTER TABLE public.documents
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancelled_by;

COMMIT;
