/*
  # Generate the horse documents at LOCK (not execution)

  When a HORSE_LEASE is locked (ready to sign), prepare the horse's Vet
  Authorization + Care Release so they're signed alongside the contract, per the
  owner's flow. Guarded on the lease already having a horse on record — a lease
  with no horse_id yet simply locks without generating (never blocks the lock).
  ensure_horse_documents is idempotent, so the existing execution-time bundle
  stays as a harmless backstop.

  Recreated verbatim from the live definition + the DECLARE var (v_hz) and the
  locked block's horse-docs generation.
*/

CREATE OR REPLACE FUNCTION public.advance_document_workflow(p_document_id uuid, p_to text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid;
  v_from      text;
  v_recip     boolean;
  v_is_staff  boolean;
  v_is_orig   boolean;
  v_is_party  boolean;
  v_open      int;
  v_missing   int;
  v_title     text;
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
  v_signed    boolean;
  v_hz        uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing,
         coalesce(title, 'A contract'), horse_section_confirmed_at
    INTO v_org, v_from, v_recip, v_title, v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF p_to = 'executed' THEN
    RAISE EXCEPTION 'workflow_state ''executed'' is reached only by signing (record_signature), not manually';
  END IF;
  IF p_to NOT IN ('editable','editing','in_review','locked','void') THEN
    RAISE EXCEPTION 'unknown target workflow_state: %', p_to;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_is_party := caller_is_document_party(p_document_id);

  IF NOT (v_is_staff OR v_is_party) THEN
    RAISE EXCEPTION 'not authorized to advance document %', p_document_id;
  END IF;

  IF v_from = p_to THEN
    RETURN v_from;
  END IF;

  IF v_from = 'executed' THEN
    RAISE EXCEPTION 'document is executed and cannot change workflow_state';
  END IF;

  IF p_to = 'void' THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'only staff may void a document';
    END IF;

  ELSIF p_to = 'editing' THEN
    IF v_from NOT IN ('editable') THEN
      RAISE EXCEPTION 'illegal transition %→editing', v_from;
    END IF;
    IF NOT v_is_staff AND NOT v_is_orig AND NOT v_recip THEN
      RAISE EXCEPTION 'the counterparty may open editing only when recipient editing is enabled';
    END IF;

  ELSIF p_to = 'editable' THEN
    IF v_from NOT IN ('editing','in_review') THEN
      RAISE EXCEPTION 'illegal transition %→editable', v_from;
    END IF;

  ELSIF p_to = 'in_review' THEN
    IF v_from NOT IN ('editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→in_review', v_from;
    END IF;

  ELSIF p_to = 'locked' THEN
    IF v_from NOT IN ('in_review','editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→locked', v_from;
    END IF;
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot lock: % open change request(s) remain', v_open;
    END IF;
    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'cannot lock: % required field(s) still empty', v_missing;
    END IF;
    v_needs_horse := EXISTS (
      SELECT 1 FROM contract_fields
      WHERE document_id = p_document_id
        AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
    IF v_needs_horse AND v_horse_confirmed IS NULL THEN
      RAISE EXCEPTION 'cannot lock: the horse information has not been confirmed by the Lessor';
    END IF;
  END IF;

  UPDATE documents SET workflow_state = p_to WHERE id = p_document_id;

  IF p_to = 'locked' THEN
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
    END IF;
    -- HORSE_LEASE: at lock, prepare the horse's vet + care docs so they're signed
    -- alongside the contract. Guarded on a horse being on record; a lease with no
    -- horse_id yet simply locks (never blocks). Idempotent.
    IF (SELECT ct.template_key FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
         WHERE d.id = p_document_id) = 'HORSE_LEASE' THEN
      SELECT horse_id INTO v_hz FROM documents WHERE id = p_document_id;
      IF v_hz IS NOT NULL THEN
        PERFORM ensure_horse_documents(
          v_hz, (SELECT contract_id FROM documents WHERE id = p_document_id), true);
      END IF;
    END IF;
  END IF;

  IF p_to IN ('in_review','locked') THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      SELECT DISTINCT v_org, pr.user_id,
        CASE p_to WHEN 'in_review' THEN 'contract_in_review' ELSE 'contract_locked' END,
        v_title || (CASE p_to WHEN 'in_review' THEN ' is ready for your review'
                              ELSE ' is ready to sign' END),
        '/app/contracts/' || p_document_id::text
      FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
      WHERE dp.document_id = p_document_id
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();
  END IF;

  RETURN p_to;
END;
$function$;
