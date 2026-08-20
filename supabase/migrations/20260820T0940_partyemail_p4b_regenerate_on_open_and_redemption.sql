-- PARTYEMAIL PHASE 4b — fetch and read on generation, and again at redemption.
--
-- D22 §6 (owner, 2026-08-20): "this requires a fetch and read on generation for
-- the contract even after its signed".
-- D22 §7: "it isnt read from the client record until they claim the contract by
-- activating their account with a matching email."
--
-- TWO GAPS, ONE FUNCTION.
--  1. remerge_contract_from_clauses runs only at EDIT points
--     (src/lib/contracts.ts:696,719,727) — never when a document is opened. A
--     contact record could change and the contract went on rendering the old
--     values until somebody happened to edit a field.
--  2. redeem_contract_invitation promotes the contact and re-anchors the document
--     but calls neither the fill nor the re-merge — so the party who had just
--     activated saw the blanks their email-only party was created with.
--
-- regenerate_contract_document() is the one seam for both: push the horse record
-- into the HORSE.* tokens, push the contact records into the party tokens (Phase 4a
-- decides which of those the record still owns), recompose, replay the signatures,
-- and persist.
--
-- WHY THE SIGNATURE REPLAY IS NOT OPTIONAL. remerge_contract_from_clauses leaves
-- {{SIG.<NS>.NAME}} and {{SIG.<NS>.DATE}} as literal placeholders — it skips SIG
-- tokens deliberately, and record_signature substitutes them at signing. Re-merging
-- a part-signed or executed document without replaying them would erase a signature
-- from the rendered body. The replay reads the signature rows, which are the record
-- of who signed and when.
--
-- WHY WRITING AN EXECUTED DOCUMENT IS SAFE. remerge_contract_from_clauses refuses
-- to persist when workflow_state = 'executed'; this function persists the body
-- itself, so an executed document does re-render. That is safe because execution
-- snapshots the signed content into contract_execution_audit (merged_body,
-- execution_hash, change_log, comments) — the evidence is the SNAPSHOT, not the
-- live row — and PARTYEMAIL Phase 0 made that true of kiosk executions too. The
-- snapshot is written once (ON CONFLICT (document_id) DO NOTHING) and is never
-- rewritten by this path.
--
-- ONE GUARD BEYOND THE SPEC, AND WHY. Clause definitions are NOT versioned:
-- remerge composes from the CURRENT contract_clause_defs rows for the template key.
-- documents.signed_template_version records which template version was signed but
-- nothing consults it when composing. So on an executed document whose template has
-- since moved, a re-merge would silently restate the instrument in today's wording.
-- This function refuses the body write in exactly that case (executed AND
-- signed_template_version distinct from the template's current version): the record
-- data is still pushed into the fields, and the stored body is returned unchanged.
-- Flagged in the report — the underlying exposure (unversioned clause defs) is
-- pre-existing and out of scope here.
--
-- NO BLANKET TRIGGER ON contacts. An AFTER UPDATE ON contacts trigger would
-- re-merge every document the person touches, executed ones included, on every
-- unrelated CRM edit. Propagation happens at generation and at redemption, where a
-- human is looking at the result.

CREATE OR REPLACE FUNCTION public.regenerate_contract_document(p_document_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc     documents%ROWTYPE;
  v_horse   horses%ROWTYPE;
  v_body    text;
  v_new     text;
  v_tver    integer;
  v_drifted boolean := false;
  r         record;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  IF NOT coalesce(caller_is_document_party_or_staff(p_document_id), false) THEN
    RAISE EXCEPTION 'not authorized to regenerate document %', p_document_id;
  END IF;

  -- Only a contract-engine document has party tokens to refresh; a release or a
  -- policy is generated once and never recomposed.
  IF v_doc.contract_id IS NULL THEN RETURN v_doc.merged_body; END IF;
  -- A voided or terminated document is a record of something that ended. Nothing
  -- is pushed into it.
  IF v_doc.status = 'VOID' OR v_doc.voided_at IS NOT NULL OR v_doc.terminated_at IS NOT NULL THEN
    RETURN v_doc.merged_body;
  END IF;

  -- ── the horse record -> HORSE.* tokens (D22 §7's symmetric half) ───────────
  -- Only a value the record actually holds is pushed: horse_field_token_value
  -- returns '' for the tokens the horses table has no column for (HORSE.LABEL,
  -- the medication detail lines), and those keep whatever was typed.
  IF v_doc.horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_doc.horse_id AND deleted_at IS NULL;
    IF FOUND THEN
      FOR r IN
        SELECT cf.id, cf.value,
               upper(split_part(regexp_replace(cf.field_key, '[{}]', '', 'g'), '.', 2)) AS field
          FROM contract_fields cf
         WHERE cf.document_id = p_document_id
           AND regexp_replace(cf.field_key, '[{}]', '', 'g') LIKE 'HORSE.%'
      LOOP
        v_new := horse_field_token_value(v_horse, r.field);
        IF nullif(btrim(coalesce(v_new, '')), '') IS NOT NULL
           AND r.value IS DISTINCT FROM v_new THEN
          UPDATE contract_fields SET value = v_new, updated_at = now() WHERE id = r.id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ── the contact records -> the party tokens ────────────────────────────────
  PERFORM fill_party_fields_from_contacts(p_document_id);

  v_body := remerge_contract_from_clauses(p_document_id);
  -- NULL = a flat (non-clause) template: nothing recomposes from clauses, and the
  -- fill above has already re-merged it from its fields.
  IF v_body IS NULL THEN
    RETURN (SELECT merged_body FROM documents WHERE id = p_document_id);
  END IF;

  -- ── replay the signatures ──────────────────────────────────────────────────
  FOR r IN
    SELECT CASE WHEN s.party_role = 'BUYER' AND t.rn > 1 THEN 'COBUYER' ELSE s.party_role END AS ns,
           s.typed_name, s.signed_at
      FROM signatures s
      LEFT JOIN (
        SELECT dp.contact_id,
               row_number() OVER (ORDER BY dp.signer_order NULLS LAST, dp.id) AS rn
          FROM document_parties dp
         WHERE dp.document_id = p_document_id AND dp.party_role = 'BUYER'
      ) t ON t.contact_id = s.signer_contact_id
     WHERE s.document_id = p_document_id
       AND s.deleted_at IS NULL AND s.signed_at IS NOT NULL
  LOOP
    v_body := replace(v_body, '{{SIG.' || r.ns || '.NAME}}', coalesce(r.typed_name, ''));
    v_body := replace(v_body, '{{SIG.' || r.ns || '.DATE}}',
                      to_char(r.signed_at, 'FMMonth FMDD, YYYY'));
  END LOOP;

  -- ── template drift guard (see the header) ──────────────────────────────────
  IF coalesce(v_doc.workflow_state, '') = 'executed' THEN
    SELECT ct.version INTO v_tver FROM contract_templates ct WHERE ct.id = v_doc.template_id;
    v_drifted := (v_doc.signed_template_version IS DISTINCT FROM v_tver);
  END IF;
  IF v_drifted THEN
    RETURN (SELECT merged_body FROM documents WHERE id = p_document_id);
  END IF;

  UPDATE documents SET merged_body = v_body WHERE id = p_document_id;
  RETURN v_body;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.regenerate_contract_document(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerate_contract_document(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.regenerate_contract_document(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.regenerate_contract_document(uuid) TO service_role;

-- ── the redemption hook ─────────────────────────────────────────────────────
-- Reissued from the live prod body (pg_get_functiondef, 2026-08-20) with one
-- added block.

CREATE OR REPLACE FUNCTION public.redeem_contract_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_profile profiles%ROWTYPE;
  v_inv_is_company boolean;
  v_signed  boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in before redeeming an invitation'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  -- SENDGUARD: resolve the token WITHOUT the liveness filter first, so an
  -- already-signed party who clicks a spent/superseded/expired link can still be
  -- routed to their own signed document. The liveness rules are re-applied below
  -- for anyone who has NOT signed — unchanged.
  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND kind = 'CONTRACT'
   ORDER BY created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation is not valid or has expired'; END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM signatures s
     WHERE s.document_id = v_inv.document_id
       AND s.deleted_at IS NULL
       AND (s.signer_contact_id = v_inv.contact_id
            OR s.signer_user_id = auth.uid()
            OR s.signer_contact_id = (SELECT p.contact_id FROM profiles p WHERE p.user_id = auth.uid()))
  ) INTO v_signed;

  IF v_signed THEN
    -- Nothing to provision and nothing to re-sign: they are already on the
    -- document. Retire a still-live token so it cannot be walked twice, and
    -- leave a spent/superseded one exactly as it is.
    UPDATE invitations
       SET status = 'redeemed', redeemed_at = coalesce(redeemed_at, now())
     WHERE id = v_inv.id AND status = 'sent';
    RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', true);
  END IF;

  -- ORIGINAL liveness rules for a party who has not signed.
  IF NOT (v_inv.status = 'sent' AND v_inv.expires_at > now()) THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'no profile for the signed-in user'; END IF;

  SELECT coalesce(is_company, false) INTO v_inv_is_company FROM contacts WHERE id = v_inv.contact_id;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL THEN
    IF NOT v_inv_is_company THEN
      PERFORM promote_contact_to_account(auth.uid(), v_inv.contact_id);
    ELSE
      UPDATE profiles SET org_id = coalesce(org_id, v_inv.org_id) WHERE user_id = auth.uid();
    END IF;
  ELSIF v_profile.contact_id <> v_inv.contact_id AND NOT v_inv_is_company THEN
    -- THE SPINE merges the duplicate counterparty contact into the account's
    -- contact (documents/parties/signatures/shares re-anchor, duplicate
    -- dissolves) — replacing the hand-rolled partial re-point.
    PERFORM promote_contact_to_account(auth.uid(), v_inv.contact_id);
    UPDATE documents SET originator_contact_id = v_profile.contact_id
     WHERE originator_contact_id = v_inv.contact_id AND deleted_at IS NULL;
  END IF;

  -- FOLD-IN: ensure the counterparty has a real account + clients row (individuals
  -- only — a company party is represented by the company contact, not the person).
  --
  -- PARTYROLE 2026-08-17: `p_template_keys` is an EXPLICIT EMPTY ARRAY, not NULL.
  -- NULL meant "fall through to the category defaults", and the category is
  -- GUEST, so redeeming a contract invitation assigned the general release,
  -- company policies and facility rules to a counterparty who owes none of them —
  -- and, because `apply_category_documents` deletes every requirement outside the
  -- wanted set, STRIPPED the horse-owner requirements off a boarder who was
  -- invited as Lessor. '{}' takes the explicit branch: nothing is inserted, and
  -- nothing is deleted. A Party's document set is decided by staff, never here.
  IF NOT v_inv_is_company AND v_email IS NOT NULL THEN
    BEGIN
      PERFORM _ensure_client_account(v_inv.org_id, v_email,
        nullif(v_inv.first_name,''), nullif(v_inv.last_name,''),
        ARRAY['GUEST'], ARRAY[]::text[]);
    EXCEPTION WHEN others THEN NULL;  -- never block a contract redemption on provisioning
    END;
  END IF;

  -- PARTYEMAIL PHASE 4b — THE MOMENT THE RECORD BECOMES READABLE (D22 §7).
  -- Until now this document held only the address the party was matched on;
  -- name, phone and address were never read from the contact record because the
  -- person had not claimed the contract. They just did. Push the record into the
  -- party tokens and recompose, so the document they are about to be shown carries
  -- their own details rather than blanks. Wrapped, like the fold-in above:
  -- provisioning must never block a redemption.
  BEGIN
    PERFORM regenerate_contract_document(v_inv.document_id);
  EXCEPTION WHEN others THEN NULL;
  END;

  UPDATE invitations SET status = 'redeemed', redeemed_at = now() WHERE id = v_inv.id;
  RETURN jsonb_build_object('document_id', v_inv.document_id, 'already_signed', false);
END;
$function$
;
