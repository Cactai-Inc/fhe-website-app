-- Contract lifecycle overhaul: termination flow + per-party archive.
--
-- (1) Termination: an executed contract can be TERMINATED, but only by mutual
--     agreement. A party requesting termination sends an intent-to-terminate to
--     the OTHER party for approval/decline; staff requesting it sends to BOTH
--     parties. While a request is pending the contract stays 'executed' (fully in
--     force) with a request flag; on approval it becomes 'terminated' (a new
--     workflow_state), greyed with the termination date, logs intact, and it can
--     never be hard-deleted (legal record) — only archived from view.
-- (2) Per-party archive: an overlay table so each party can hide a
--     terminated/expired document from their own list without affecting others.
--     The existing global documents.archived_at stays for staff bulk-archive.

-- ── workflow_state: allow 'terminated' ──────────────────────────────────────
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_workflow_state_check;
ALTER TABLE documents ADD CONSTRAINT documents_workflow_state_check
  CHECK (workflow_state = ANY (ARRAY[
    'editable','editing','in_review','locked','executed','void','terminated']));

-- ── termination tracking columns ────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS terminated_at         timestamptz,
  ADD COLUMN IF NOT EXISTS terminated_by         uuid,
  ADD COLUMN IF NOT EXISTS termination_requested_at   timestamptz,
  ADD COLUMN IF NOT EXISTS termination_requested_by   uuid,
  ADD COLUMN IF NOT EXISTS termination_request_reason text;

-- ── per-party archive overlay ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_party_archives (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL,
  org_id      uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, contact_id)
);
ALTER TABLE document_party_archives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dpa_self ON document_party_archives;
CREATE POLICY dpa_self ON document_party_archives
  FOR ALL USING (contact_id = current_contact_id() OR (has_staff_access() AND org_id = current_org()))
  WITH CHECK (contact_id = current_contact_id() OR (has_staff_access() AND org_id = current_org()));

-- helper: is the caller a party or staff on this document?
CREATE OR REPLACE FUNCTION public.caller_is_document_party_or_staff(p_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM documents d WHERE d.id = p_document_id
                  AND has_staff_access() AND d.org_id = current_org())
      OR EXISTS (SELECT 1 FROM document_parties dp
                  WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id());
$$;

-- ── request_contract_termination ────────────────────────────────────────────
-- A party (or staff) proposes terminating an executed contract. Records the
-- pending request (contract stays 'executed') and notifies the party/parties who
-- must agree: the OTHER party when a party requests; BOTH parties when staff does.
CREATE OR REPLACE FUNCTION public.request_contract_termination(p_document_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid; v_title text; v_state text; v_me uuid := current_contact_id();
  v_staff boolean := has_staff_access(); r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, title, workflow_state INTO v_org, v_title, v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT ((v_staff AND v_org = current_org())
          OR EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = v_me)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_state <> 'executed' THEN RAISE EXCEPTION 'only an executed contract can be terminated'; END IF;
  IF EXISTS (SELECT 1 FROM documents WHERE id = p_document_id AND termination_requested_at IS NOT NULL) THEN
    RAISE EXCEPTION 'a termination request is already pending';
  END IF;

  UPDATE documents SET termination_requested_at = now(), termination_requested_by = v_me,
         termination_request_reason = nullif(btrim(coalesce(p_reason,'')),''), updated_at = now()
   WHERE id = p_document_id;

  -- notify the party/parties whose agreement is needed. When a party requests,
  -- that's the other party; when staff requests (no party role of their own),
  -- every party is asked to agree.
  FOR r IN
    SELECT DISTINCT pr.user_id FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
     WHERE dp.document_id = p_document_id
       AND pr.user_id IS NOT NULL
       AND (v_staff OR dp.contact_id IS DISTINCT FROM v_me)
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, r.user_id, 'contract_termination_requested',
            coalesce(v_title,'A contract') || ' — termination requested',
            CASE WHEN v_staff THEN 'The barn has requested to terminate this contract. Please review and agree or decline.'
                 ELSE 'The other party has requested to terminate this contract. Please review and approve or decline.' END,
            '/app/contracts/' || p_document_id::text);
  END LOOP;
  PERFORM notify_staff(v_org, 'contract_termination_requested',
    coalesce(v_title,'A contract') || ' — termination requested', '/app/ops/documents');
END;
$$;

-- ── approve_contract_termination ────────────────────────────────────────────
-- The counterparty (or, for a staff-initiated request, any party) agrees. The
-- contract becomes 'terminated' with the date; logs stay intact.
CREATE OR REPLACE FUNCTION public.approve_contract_termination(p_document_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_title text; v_me uuid := current_contact_id(); v_requester uuid; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, title, termination_requested_by INTO v_org, v_title, v_requester
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL
      AND termination_requested_at IS NOT NULL AND workflow_state = 'executed';
  IF v_org IS NULL THEN RAISE EXCEPTION 'no pending termination request'; END IF;
  IF NOT caller_is_document_party_or_staff(p_document_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE documents SET workflow_state = 'terminated', terminated_at = now(), terminated_by = v_me,
         updated_at = now()
   WHERE id = p_document_id;

  FOR r IN
    SELECT DISTINCT pr.user_id FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
     WHERE dp.document_id = p_document_id AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, r.user_id, 'contract_terminated',
            coalesce(v_title,'A contract') || ' was terminated',
            'The contract has been terminated by mutual agreement and is kept on file as a record.',
            '/app/contracts/' || p_document_id::text);
  END LOOP;
  PERFORM notify_staff(v_org, 'contract_terminated',
    coalesce(v_title,'A contract') || ' was terminated', '/app/ops/documents');
END;
$$;

-- ── decline_contract_termination ────────────────────────────────────────────
-- Clears the pending request; the contract stays 'executed' / in force.
CREATE OR REPLACE FUNCTION public.decline_contract_termination(p_document_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_title text; v_requester uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, title, termination_requested_by INTO v_org, v_title, v_requester
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL
      AND termination_requested_at IS NOT NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'no pending termination request'; END IF;
  IF NOT caller_is_document_party_or_staff(p_document_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  UPDATE documents SET termination_requested_at = NULL, termination_requested_by = NULL,
         termination_request_reason = NULL, updated_at = now()
   WHERE id = p_document_id;

  -- tell the requester it was declined
  IF v_requester IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    SELECT v_org, pr.user_id, 'contract_termination_declined',
           coalesce(v_title,'A contract') || ' — termination declined',
           'The other party declined the request to terminate. The contract remains in force.',
           '/app/contracts/' || p_document_id::text
      FROM profiles pr WHERE pr.contact_id = v_requester AND pr.user_id IS NOT NULL;
  END IF;
END;
$$;

-- ── set_document_party_archived: per-party archive toggle ────────────────────
CREATE OR REPLACE FUNCTION public.set_document_party_archived(p_document_id uuid, p_archive boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_me uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT caller_is_document_party_or_staff(p_document_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  IF p_archive THEN
    INSERT INTO document_party_archives (document_id, contact_id, org_id)
    VALUES (p_document_id, v_me, v_org)
    ON CONFLICT (document_id, contact_id) DO UPDATE SET archived_at = now();
  ELSE
    DELETE FROM document_party_archives WHERE document_id = p_document_id AND contact_id = v_me;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_contract_termination(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_contract_termination(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_contract_termination(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_document_party_archived(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.caller_is_document_party_or_staff(uuid) TO authenticated;
