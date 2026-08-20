-- CLOSEOUT §1.5 (CONTRACTWALK B2) — the horse documents are created at EXECUTION,
-- not at lock. Owner-ruled 2026-08-18:
--   "a party looking at a contract they might not sign doesn't need to complete
--    documents that might not be needed."
--
-- ensure_horse_documents had two callers:
--   advance_document_workflow  — at LOCK, before anyone signs  ← removed here
--   apply_contract_execution_effects — at EXECUTION, after both sign ← kept
--
-- The lock-time call manufactured HORSE_EMERGENCY_VET + RELEASE_HORSE_CARE in
-- the horse owner's name while the counterparty was still deciding. If they
-- declined, the paperwork was never needed. Execution is the moment the horse
-- genuinely comes into care, and the execution-time call already generates the
-- same set (verified: contact_document_wall_state reads only
-- contact_required_documents, which ensure_horse_documents never writes, and
-- sign_sequence has no UI consumer — nothing depends on the documents existing
-- at lock time).
--
-- This reissues advance_document_workflow from its live prod body
-- (pg_get_functiondef, 2026-08-19) with ONLY the lock-time block removed.

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
  v_is_party  boolean;
  v_blockers  jsonb;
  v_title     text;
  v_horse_confirmed timestamptz;
  v_signed    boolean;
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

  v_is_staff := coalesce(has_staff_access() AND v_org = current_org(), false);
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
    -- H1: originator authority collapsed — the company (staff) authors; a
    -- counterparty opens editing only when recipient editing is enabled.
    IF NOT v_is_staff AND NOT v_recip THEN
      RAISE EXCEPTION 'the counterparty may open editing only when recipient editing is enabled';
    END IF;

  ELSIF p_to = 'editable' THEN
    -- LEASEFIX 2026-08-09: a LOCKED document with NO standing signature had no way
    -- back. remove_my_signature is the documented escape from locked (L9), but it
    -- is a no-op when nobody has signed, so a document locked prematurely could
    -- only be VOIDED — losing the draft. The staff "Withdraw / correct" button is
    -- shown in exactly that state and raised 'illegal transition locked→editable'
    -- on every click.
    -- Reopening is staff-only, and is refused the moment a signature stands: with
    -- a signature the escape is withdrawal, which archives the attestation to
    -- audit_logs first. That ordering is the whole point of L9 and is preserved.
    IF v_from = 'locked' THEN
      IF NOT v_is_staff THEN
        RAISE EXCEPTION 'only staff may reopen a locked document';
      END IF;
      IF EXISTS (SELECT 1 FROM signatures
                  WHERE document_id = p_document_id
                    AND signed_at IS NOT NULL AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'this document is signed — the signer must remove their signature before it can be reopened';
      END IF;
    ELSIF v_from NOT IN ('editing','in_review') THEN
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
    -- ALL lock preconditions live in contract_lock_blockers (shared with
    -- approve_contract_review) — never re-implement them here.
    v_blockers := contract_lock_blockers(p_document_id);
    IF jsonb_array_length(v_blockers) > 0 THEN
      RAISE EXCEPTION 'cannot lock: %',
        (SELECT string_agg(b->>'message', '; ') FROM jsonb_array_elements(v_blockers) b);
    END IF;
  END IF;

  UPDATE documents SET workflow_state = p_to WHERE id = p_document_id;

  IF p_to = 'locked' THEN
    -- Seed a PENDING signature row for every signer party so the signing surface
    -- has something to render. Idempotent (unique key), leaves sealed rows alone.
    INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, method)
      SELECT v_org, p_document_id, dp.contact_id, dp.party_role, 'TYPED'
        FROM document_parties dp
       WHERE dp.document_id = p_document_id
         AND dp.is_signer = true
         AND dp.contact_id IS NOT NULL
         AND dp.party_role = ANY (ARRAY['CLIENT','BUYER','SELLER','LESSOR','LESSEE',
              'OWNER','RIDER','PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
              'CONTRACTOR','FACILITY_CONTACT','COMPANY'])
      ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      IF EXISTS (SELECT 1 FROM contract_clause_defs cdf JOIN documents d2 ON true JOIN contract_templates ct2 ON ct2.id=d2.template_id AND ct2.template_key=cdf.template_key WHERE d2.id=p_document_id) THEN
       PERFORM remerge_contract_from_clauses(p_document_id);
     ELSE
       PERFORM remerge_contract_from_fields(p_document_id);
     END IF;
    END IF;
    -- CLOSEOUT §1.5 (B2, owner-ruled 2026-08-18): the lock-time
    -- ensure_horse_documents call is REMOVED. A party reviewing a lease they
    -- might not sign gets nothing else attached; execution
    -- (apply_contract_execution_effects) creates HORSE_EMERGENCY_VET +
    -- RELEASE_HORSE_CARE, because only then is the horse genuinely coming
    -- into care.
  END IF;

  IF p_to IN ('in_review','locked') THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      SELECT DISTINCT v_org, pr.user_id,
        CASE p_to WHEN 'in_review' THEN 'contract_in_review' ELSE 'contract_locked' END,
        v_title || (CASE p_to WHEN 'in_review' THEN ' is ready for your review'
                              ELSE ' is ready to sign' END),
        '/app/contracts/' || p_document_id::text
      FROM document_parties dp
      JOIN contacts pc ON pc.id = dp.contact_id
      JOIN profiles pr ON (pr.contact_id = dp.contact_id
                           OR (pc.email IS NOT NULL AND lower(pr.email) = lower(pc.email)))
      WHERE dp.document_id = p_document_id
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();
  END IF;

  RETURN p_to;
END;
$function$;
