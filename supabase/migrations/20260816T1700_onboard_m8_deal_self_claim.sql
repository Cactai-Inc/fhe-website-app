-- TASK ONBOARD §1b — `deal` on /sign: claim an existing contract AND activate an
-- account in one flow.
--
-- Owner: "signing without an account isnt possible, they have no way to access the
-- document. that was the point of adding them to /sign flow so they can click deal,
-- enter their information, and if the contract matching that email exists and they
-- dont have an account yet they can claim the contract and establish their active
-- account in one flow."
--
-- ONE OUTCOME, TWO INITIATION POINTS — the pattern the rest of this task follows.
-- Staff already invite a counterparty (ContractPage → "Send for review" →
-- src/lib/contracts.ts:inviteCounterparty → /api/contract-invite →
-- invite_contract_counterparty → the branded /activate?token=…&kind=contract link →
-- redeem_contract_invitation → promote_contact_to_account). The self-claim from
-- /sign is the SAME chain, entered from the other end. No second claim mechanism,
-- no second account-creation path (D5).
--
-- THE ONLY THING IN THE WAY was the authorization guard on
-- invite_contract_counterparty: `has_staff_access() AND org matches`. A service-role
-- caller has no auth.uid(), so has_staff_access() is false and the call raised. Every
-- other spine function in this schema already spells the pair the same way —
-- `coalesce(auth.role(),'') = 'service_role' OR has_staff_access()` — and this brings
-- it into line. Nothing else about the function changes: the party-roster check, the
-- SENDGUARD already-signed refusal, the token, and the 14-day expiry are untouched.
--
-- WHAT THIS IS *NOT*. There is no live deal population: the owner has confirmed the
-- accountless document parties in prod are test records, and that Sarah Morgan's
-- cancelled contract was the only real contract this system has ever had. So there is
-- no backfill here and nothing to repair — this is the flow for the first real deal
-- that arrives after it ships.

CREATE OR REPLACE FUNCTION public.invite_contract_counterparty(
  p_document_id uuid, p_contact_id uuid, p_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc   documents%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id    uuid;
  v_role  text;
BEGIN
  -- staff of the document's org, or a service-role caller. The service-role arm is
  -- what lets the public /sign deal path reuse this instead of minting a second
  -- claim mechanism; the endpoint that calls it does its own matching and rate
  -- limiting, and can only ever reach a party who has no account yet.
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access() AND v_doc.org_id = current_org(), false)) THEN
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

  -- SENDGUARD: never mint a signing invitation for someone who already signed.
  SELECT s.party_role INTO v_role
    FROM signatures s
   WHERE s.document_id = p_document_id
     AND s.signer_contact_id = p_contact_id
     AND s.deleted_at IS NULL
   ORDER BY s.signed_at NULLS LAST, s.created_at
   LIMIT 1;
  IF v_role IS NOT NULL THEN
    RAISE EXCEPTION 'this party has already signed this document as % — a new signing invitation cannot be sent', v_role
      USING ERRCODE = 'P0001',
            HINT = 'Their signature is on file. Open the document to see it.';
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

-- ── the match, server-side, so the endpoint cannot get the rules wrong ───────
-- Returns AT MOST ONE claimable party for an email, or nothing. Never returns a
-- reason: the caller must not be able to tell "no such contract" from "already has
-- an account" from "already signed", because it answers an unauthenticated
-- stranger. The endpoint's response is identical either way (ONBOARD §1b).
CREATE OR REPLACE FUNCTION public.find_claimable_contract(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row   record;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_email = '' THEN RETURN jsonb_build_object('found', false); END IF;

  SELECT d.id AS document_id, d.org_id, d.title, c.id AS contact_id
    INTO v_row
    FROM document_parties dp
    JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
    JOIN contacts  c ON c.id = dp.contact_id  AND c.deleted_at IS NULL
   WHERE lower(c.email) = v_email
     -- "and they dont have an account yet" — the whole premise of the flow
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id)
     -- a contract that is over is not claimable
     AND d.status NOT IN ('VOID', 'EXECUTED')
     AND d.voided_at IS NULL AND d.terminated_at IS NULL AND d.archived_at IS NULL
     -- SENDGUARD, again: somebody who already signed has nothing to claim
     AND NOT EXISTS (
       SELECT 1 FROM signatures s
        WHERE s.document_id = d.id AND s.signer_contact_id = c.id AND s.deleted_at IS NULL)
   ORDER BY d.created_at DESC
   LIMIT 1;

  IF v_row.document_id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;

  RETURN jsonb_build_object(
    'found', true, 'document_id', v_row.document_id, 'org_id', v_row.org_id,
    'title', v_row.title, 'contact_id', v_row.contact_id);
END;
$function$;

COMMENT ON FUNCTION public.find_claimable_contract(text) IS
  'ONBOARD §1b: the one contract a /sign "deal" visitor may claim — a document party '
  'whose contact email matches, who has NO account yet, on a contract that is still '
  'live, who has not already signed. Returns found=false for every other case with no '
  'reason attached, because the caller is answering an unauthenticated stranger.';

/** Fill in what the claimant typed, on the contact the contract already points at.
 *  Blanks only — a self-service form never overwrites what staff put on a record. */
CREATE OR REPLACE FUNCTION public.fill_claimant_details(
  p_contact_id uuid, p_first_name text, p_last_name text, p_phone text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE contacts
     SET first_name = CASE WHEN nullif(btrim(coalesce(first_name,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_first_name,'')),'') ELSE first_name END,
         last_name  = CASE WHEN nullif(btrim(coalesce(last_name,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_last_name,'')),'') ELSE last_name END,
         phone      = CASE WHEN nullif(btrim(coalesce(phone,'')),'') IS NULL
                           THEN nullif(btrim(coalesce(p_phone,'')),'') ELSE phone END
   WHERE id = p_contact_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.find_claimable_contract(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fill_claimant_details(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_claimable_contract(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fill_claimant_details(uuid, text, text, text) TO service_role;
