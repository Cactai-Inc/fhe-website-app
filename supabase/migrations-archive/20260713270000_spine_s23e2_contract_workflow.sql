/*
  # Spine Refactor — Slice 2.3e-2: contract workflow off engagement_parties

  Spine contracts (start_lease/purchase/broker_contract) produce contact-owned
  documents with engagement_id = NULL and their roster in contract_parties +
  document_parties. Three KEPT contract-negotiation functions still read/write
  engagement_parties, so on a spine contract they silently do nothing:

    - advance_document_workflow — the in_review/locked notifications selected
      engagement_parties WHERE engagement_id = <NULL> → nobody was notified.
      Now notifies the document_parties of the doc.
    - invite_contract_counterparty — the "is a party" gate checked
      engagement_parties → always failed for a spine contract, blocking invites.
      Now checks document_parties of the doc.
    - redeem_contract_invitation — on an existing-account redeem it repointed the
      placeholder engagement_parties rows to the real contact. Now repoints
      document_parties + contract_parties (the spine roster).

  Bodies are reproduced verbatim except the engagement→spine-party swap. The
  engagement-manufacturing kiosk release (sign_release) is rebuilt separately.
*/

-- 1. advance_document_workflow — notify document_parties (was engagement_parties)
CREATE OR REPLACE FUNCTION public.advance_document_workflow(p_document_id uuid, p_to text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid;
  v_eng       uuid;
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, engagement_id, workflow_state, recipient_editing,
         coalesce(title, 'A contract'), horse_section_confirmed_at
    INTO v_org, v_eng, v_from, v_recip, v_title, v_horse_confirmed
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
    -- SPEC F: the Lessor must have confirmed the horse information — only for
    -- documents that carry LESSOR-owned HORSE.* fields (lease-shaped contracts).
    v_needs_horse := EXISTS (
      SELECT 1 FROM contract_fields
      WHERE document_id = p_document_id
        AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
    IF v_needs_horse AND v_horse_confirmed IS NULL THEN
      RAISE EXCEPTION 'cannot lock: the horse information has not been confirmed by the Lessor';
    END IF;
  END IF;

  UPDATE documents SET workflow_state = p_to WHERE id = p_document_id;

  -- SPEC C.4(a): the locked body is re-derived from the negotiated fields (CUT +
  -- strip-unfilled) — the final text the parties sign. Skipped if any signature
  -- already exists (never erase a signer's SIG substitution).
  IF p_to = 'locked' THEN
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
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

-- 2. invite_contract_counterparty — "is a party" gate off document_parties
CREATE OR REPLACE FUNCTION public.invite_contract_counterparty(p_document_id uuid, p_contact_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_doc   documents%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id    uuid;
BEGIN
  -- staff of the document's org, or a service-role caller (auth.uid() null)
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT (has_staff_access() AND v_doc.org_id = current_org()) THEN
    RAISE EXCEPTION 'not authorized to invite a counterparty on document %', p_document_id;
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'a valid email is required';
  END IF;
  -- the contact must be a party on the document (spine roster)
  IF NOT EXISTS (
    SELECT 1 FROM document_parties
    WHERE document_id = p_document_id AND contact_id = p_contact_id
  ) THEN
    RAISE EXCEPTION 'contact % is not a party on this contract', p_contact_id;
  END IF;

  INSERT INTO invitations (org_id, email, token, expires_at, status, kind, document_id, contact_id)
  VALUES (v_doc.org_id, lower(trim(p_email)), v_token, now() + interval '14 days',
          'sent', 'CONTRACT', p_document_id, p_contact_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'invitation_id', v_id, 'token', v_token,
    'document_id', p_document_id, 'expires_at', now() + interval '14 days');
END;
$function$;

-- 3. redeem_contract_invitation — repoint document_parties + contract_parties
CREATE OR REPLACE FUNCTION public.redeem_contract_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_inv     invitations%ROWTYPE;
  v_email   text;
  v_profile profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in before redeeming an invitation';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations
   WHERE token = p_token AND status = 'sent' AND expires_at > now() AND kind = 'CONTRACT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is not valid or has expired';
  END IF;
  IF lower(v_inv.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'this invitation was issued to a different email address';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for the signed-in user';
  END IF;

  PERFORM set_config('app.allow_profile_link', '1', true);

  IF v_profile.contact_id IS NULL THEN
    -- fresh account: adopt the invite's party contact as their identity
    UPDATE profiles
       SET contact_id = v_inv.contact_id,
           org_id     = coalesce(org_id, v_inv.org_id)
     WHERE user_id = auth.uid();
  ELSIF v_profile.contact_id <> v_inv.contact_id THEN
    -- existing account with its own contact: keep THEIR contact singular and
    -- repoint the spine party rows + shares from the invite's placeholder
    -- contact to the account's contact.
    UPDATE document_parties SET contact_id = v_profile.contact_id
     WHERE contact_id = v_inv.contact_id;
    UPDATE contract_parties SET contact_id = v_profile.contact_id
     WHERE contact_id = v_inv.contact_id;
    UPDATE document_shares SET shared_with_contact_id = v_profile.contact_id
     WHERE shared_with_contact_id = v_inv.contact_id;
    UPDATE documents SET originator_contact_id = v_profile.contact_id
     WHERE originator_contact_id = v_inv.contact_id AND deleted_at IS NULL;
  END IF;

  UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;

  -- deliberately NO memberships insert — a contract counterparty is not a
  -- community member; their surface is the contract + their own account.
  RETURN jsonb_build_object('document_id', v_inv.document_id);
END;
$function$;
