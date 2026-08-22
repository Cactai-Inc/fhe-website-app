-- DEALAUTO §2 (the reach) — the signing set says which steps are MINE.
--
-- `contract_signing_set` already returns the contract's documents in signing
-- order, and ContractPage already renders them as a numbered strip with a
-- "Continue to <next> →" button. What it could not say is whether the next step
-- is the current viewer's to sign. Without that, "surface the bundle
-- immediately after the signature" has to either push everyone to the next
-- document — including a staff member who just completed the company's seat and
-- owes nothing — or push nobody, which is where it stood.
--
-- Two additive fields, no shape change. Existing consumers ignore them.
--   i_sign   — the caller is a signer party on that document
--   i_signed — the caller's own signature is already on it
-- Both resolve through current_contact_id(), so a staff member viewing someone
-- else's bundle step gets i_sign = false and is never advanced into it.
CREATE OR REPLACE FUNCTION public.contract_signing_set(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctr uuid;
  v_org uuid;
  v_may boolean;
  v_me  uuid;
BEGIN
  SELECT contract_id, org_id INTO v_ctr, v_org
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_ctr IS NULL THEN RETURN '[]'::jsonb; END IF;

  v_may := (coalesce(has_staff_access() AND v_org = current_org(), false))
    OR caller_is_document_party(p_document_id)
    OR EXISTS (SELECT 1 FROM documents d
                WHERE d.id = p_document_id AND d.horse_id IS NOT NULL
                  AND client_can_read_horse(d.horse_id));
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this document set'; END IF;

  v_me := current_contact_id();

  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'document_id', d.id,
        'title', d.title,
        'template_key', t.template_key,
        'short_label', coalesce(t.short_label, t.title),
        'sign_sequence', d.sign_sequence,
        'status', d.status,
        'executed', d.status = 'EXECUTED',
        'i_sign', v_me IS NOT NULL AND EXISTS (
          SELECT 1 FROM document_parties dp
           WHERE dp.document_id = d.id AND dp.contact_id = v_me AND dp.is_signer),
        'i_signed', v_me IS NOT NULL AND EXISTS (
          SELECT 1 FROM signatures s
           WHERE s.document_id = d.id AND s.signer_contact_id = v_me
             AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL)
      ) ORDER BY d.sign_sequence NULLS LAST, d.created_at), '[]'::jsonb)
    FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
    WHERE d.contract_id = v_ctr AND d.deleted_at IS NULL AND d.sign_sequence IS NOT NULL
  );
END;
$function$;
