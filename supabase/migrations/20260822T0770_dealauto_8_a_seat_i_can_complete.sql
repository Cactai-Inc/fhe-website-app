-- DEALAUTO §2 (refinement) — "mine to sign" means a seat I can complete, not
-- only a seat with my own name on it.
--
-- Migration 5 resolved `i_sign` against current_contact_id() alone. That is
-- right for a client and wrong for the barn office, because of a rule this
-- database already has: `record_signature`'s company branch lets any staff
-- member of the org complete a seat held by the org's own COMPANY contact —
-- "the company contact is a faceless entity with no linked account", so a human
-- signs on its behalf. ContractPage already surfaces that as "Sign on behalf of
-- the company".
--
-- On the commonest lease FHE writes, the LESSOR *is* French Heritage
-- Equestrian and so is the horse's owner of record — which means the vet
-- authorization and the care release sequenced behind the lease are addressed
-- to the company too. With `i_sign` keyed on the staff member's personal
-- contact, the person who just completed the company's signature would be
-- advanced nowhere, and the company's own two documents would sit there. Same
-- carve-out, same predicate, same place it already lives.
--
--   i_sign   — a signer seat on this document that I can complete
--   i_signed — no such seat is left unsigned
CREATE OR REPLACE FUNCTION public.contract_signing_set(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctr   uuid;
  v_org   uuid;
  v_may   boolean;
  v_me    uuid;
  v_staff boolean;
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

  v_me    := current_contact_id();
  v_staff := coalesce(has_staff_access() AND v_org = current_org(), false);

  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'document_id', d.id,
        'title', d.title,
        'template_key', t.template_key,
        'short_label', coalesce(t.short_label, t.title),
        'sign_sequence', d.sign_sequence,
        'status', d.status,
        'executed', d.status = 'EXECUTED',
        'i_sign',   seat.mine > 0,
        'i_signed', seat.mine > 0 AND seat.unsigned = 0
      ) ORDER BY d.sign_sequence NULLS LAST, d.created_at), '[]'::jsonb)
    FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS mine,
             count(*) FILTER (WHERE NOT EXISTS (
               SELECT 1 FROM signatures s
                WHERE s.document_id = dp.document_id
                  AND s.signer_contact_id = dp.contact_id
                  AND s.party_role = dp.party_role
                  AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL)) AS unsigned
        FROM document_parties dp
        JOIN contacts c ON c.id = dp.contact_id
       WHERE dp.document_id = d.id AND dp.is_signer
         AND (dp.contact_id = v_me
              -- record_signature's company branch: staff complete the org's
              -- own company seat, which has no login of its own
              OR (v_staff AND coalesce(c.is_company, false)
                  AND c.org_id = v_org AND c.deleted_at IS NULL))
    ) seat ON true
    WHERE d.contract_id = v_ctr AND d.deleted_at IS NULL AND d.sign_sequence IS NOT NULL
  );
END;
$function$;
