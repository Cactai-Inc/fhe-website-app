/*
  # Retire the flat sale templates (R1 archive-then-retire, the HORSE_LEASE precedent)

  - HORSE_PURCHASE_SALE + HORSE_SALE_TRANSFER: deactivate + soft-delete the
    template rows (existing documents — executed AND draft — are untouched; the
    token-registry guard and body checks skip deleted rows). Their .md sources
    are now retired-pointer files, excluded from the bodies loader (RETIRED set),
    and the flat bodies are archived under docs/archive/contract-templates/.
  - Prune the retired templates' template-scoped token rows (the loader no
    longer re-asserts them; the orphan-prune precedent is 20260802060002).
  - start_purchase_contract: hard DROP (the start_lease_contract precedent —
    stop calling in src/, then drop). NewContractPage now calls
    start_sale_contract.
  - document_parties_summary: deterministic ordering (party_role, signer_order)
    so the SECOND BUYER row — the co-buyer — is stably identifiable in the UI.
*/

UPDATE contract_templates
   SET active = false, deleted_at = now()
 WHERE template_key IN ('HORSE_PURCHASE_SALE', 'HORSE_SALE_TRANSFER')
   AND deleted_at IS NULL;

DELETE FROM template_tokens tt
 USING contract_templates ct
 WHERE tt.template_id = ct.id
   AND ct.template_key IN ('HORSE_PURCHASE_SALE', 'HORSE_SALE_TRANSFER');

DROP FUNCTION IF EXISTS public.start_purchase_contract(uuid, uuid, uuid, numeric, numeric);

-- document_parties_summary: ORDER BY dp.party_role → (dp.party_role, dp.signer_order
-- NULLS LAST, dp.id) via in-place rewrite (the 20260801000000 pattern).
DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
    FROM pg_proc WHERE proname = 'document_parties_summary' LIMIT 1;
  IF v_def IS NULL THEN
    RAISE NOTICE 'document_parties_summary missing — check manually'; RETURN;
  END IF;
  IF position('ORDER BY dp.party_role, dp.signer_order' in v_def) > 0 THEN
    RETURN;  -- already applied
  END IF;
  IF position('ORDER BY dp.party_role)' in v_def) = 0 THEN
    RAISE NOTICE 'document_parties_summary: ordering literal not found — check manually'; RETURN;
  END IF;
  v_def := replace(v_def,
    'ORDER BY dp.party_role)',
    'ORDER BY dp.party_role, dp.signer_order NULLS LAST, dp.id)');
  EXECUTE v_def;
END $do$;
