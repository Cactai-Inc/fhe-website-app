/*
  # contract_signing_set — the ordered set of documents to sign for a contract

  Feeds the segmented signing flow: the lease and its bundled horse documents
  share a contract_id and each carries a sign_sequence (lease=1, vet=2, care=3).
  This returns that set in order, with each doc's status, so the signing UI can
  show a stepper and gate the "Continue" button on the current doc being signed.
  Returns [] when the document isn't part of a multi-doc sequenced set.
*/

CREATE OR REPLACE FUNCTION contract_signing_set(p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ctr uuid;
  v_org uuid;
  v_may boolean;
BEGIN
  SELECT contract_id, org_id INTO v_ctr, v_org
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_ctr IS NULL THEN RETURN '[]'::jsonb; END IF;

  v_may := (has_staff_access() AND v_org = current_org())
    OR caller_is_document_party(p_document_id)
    OR EXISTS (SELECT 1 FROM documents d
                WHERE d.id = p_document_id AND d.horse_id IS NOT NULL
                  AND client_can_read_horse(d.horse_id));
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this document set'; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'document_id', d.id,
        'title', d.title,
        'template_key', t.template_key,
        'sign_sequence', d.sign_sequence,
        'status', d.status,
        'executed', d.status = 'EXECUTED'
      ) ORDER BY d.sign_sequence NULLS LAST, d.created_at), '[]'::jsonb)
    FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
    WHERE d.contract_id = v_ctr AND d.deleted_at IS NULL AND d.sign_sequence IS NOT NULL
  );
END;
$fn$;
REVOKE ALL ON FUNCTION contract_signing_set(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION contract_signing_set(uuid) TO authenticated, service_role;
