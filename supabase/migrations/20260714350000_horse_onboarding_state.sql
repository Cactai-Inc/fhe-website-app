/*
  # my_horse_onboarding_state — drives the persistent horse-documents dashboard card

  The horse documents (Vet Authorization, Horse-Care Liability Release) are their
  own set, distinct from the client-only paperwork. This reader tells the
  dashboard what's outstanding so it can show a persistent card:
    - pending_horse_docs: the caller's unsigned vet/care docs (each linkable)
    - needs_horse: the caller holds a horse-dependent purchase but no horse is
      attached yet (prompt them to add their horse via the intake form)
    - service_blocked: a horse-care service has been PURCHASED and is waiting on
      an unsigned horse-care release — the dashboard shows the "your service
      won't begin until these are completed" warning ONLY in this case.
*/

CREATE OR REPLACE FUNCTION my_horse_onboarding_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_contact uuid := current_contact_id();
  v_pending jsonb;
  v_care_unsigned boolean;
  v_care_purchase boolean;
  v_needs_horse boolean;
BEGIN
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('pending_horse_docs','[]'::jsonb,'needs_horse',false,'service_blocked',false);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'document_id', d.id, 'template_key', t.template_key,
           'title', d.title, 'link', '/app/contracts/' || d.id) ORDER BY d.created_at), '[]'::jsonb)
    INTO v_pending
    FROM document_parties dp
    JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
    JOIN contract_templates t ON t.id = d.template_id
    WHERE dp.contact_id = v_contact
      AND t.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
      AND d.status <> 'EXECUTED'
      AND NOT EXISTS (SELECT 1 FROM signatures sg
                       WHERE sg.document_id = d.id AND sg.signer_contact_id = v_contact
                         AND sg.deleted_at IS NULL);

  -- an unsigned horse-care release specifically
  SELECT EXISTS (
    SELECT 1 FROM document_parties dp
    JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
    JOIN contract_templates t ON t.id = d.template_id
    WHERE dp.contact_id = v_contact AND t.template_key = 'RELEASE_HORSE_CARE'
      AND d.status <> 'EXECUTED'
  ) INTO v_care_unsigned;

  -- a non-cancelled horse-segment (care) purchase by this buyer
  SELECT EXISTS (
    SELECT 1 FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id
    JOIN offerings o ON o.id = pi.offering_id
    WHERE pu.buyer_user_id = auth.uid()
      AND o.segment = 'horse'
      AND coalesce(pu.status, '') <> 'cancelled'
  ) INTO v_care_purchase;

  -- horse-dependent purchase with no horse attached yet
  SELECT EXISTS (
    SELECT 1 FROM purchases pu
    WHERE pu.buyer_user_id = auth.uid()
      AND pu.horse_id IS NULL
      AND coalesce(pu.status, '') <> 'cancelled'
      AND EXISTS (SELECT 1 FROM purchase_items pi JOIN offerings o ON o.id = pi.offering_id
                   WHERE pi.purchase_id = pu.id AND o.segment = 'horse')
  ) INTO v_needs_horse;

  RETURN jsonb_build_object(
    'pending_horse_docs', v_pending,
    'needs_horse', v_needs_horse,
    'service_blocked', v_care_purchase AND v_care_unsigned
  );
END;
$fn$;
REVOKE ALL ON FUNCTION my_horse_onboarding_state() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_horse_onboarding_state() TO authenticated, service_role;
