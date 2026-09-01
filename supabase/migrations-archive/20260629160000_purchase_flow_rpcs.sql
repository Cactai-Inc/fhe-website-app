/*
  # FHE CRM — Purchase Flow RPCs (migration 23)

  The two orchestration calls the purchase flow needs on top of generate_document:

  - create_purchase_engagement(buyer, horse?, seller?, amount?, deposit?) — in one
    transaction: find-or-create the buyer's client record, open a
    HORSE_PURCHASE_ASSISTANCE engagement, attach BUYER (+ SELLER) signer parties,
    and create the PURCHASE transaction row. Returns the engagement id.

  - record_signature(document, party_role, typed_name, ip?) — capture a party's
    typed signature; when every signer party has signed, mark the document EXECUTED.
    Returns the document's resulting status.

  Both are SECURITY DEFINER (they orchestrate inserts a not-yet-owning caller can't
  do under RLS) and require an authenticated caller.
*/

-- ============================================================
-- create_purchase_engagement
-- ============================================================
CREATE OR REPLACE FUNCTION create_purchase_engagement(
  p_buyer_contact_id  uuid,
  p_horse_id          uuid    DEFAULT NULL,
  p_seller_contact_id uuid    DEFAULT NULL,
  p_amount            numeric DEFAULT NULL,
  p_deposit           numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id uuid;
  v_eng_id    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- find-or-create the buyer's client record (clients.contact_id is UNIQUE)
  SELECT id INTO v_client_id FROM clients WHERE contact_id = p_buyer_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_buyer_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date)
    VALUES (v_client_id, 'HORSE_PURCHASE_ASSISTANCE', p_horse_id, now()::date)
    RETURNING id INTO v_eng_id;

  -- the buyer (our client) and, if known, the seller — both signers
  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, p_seller_contact_id, 'SELLER', true, 2);
  END IF;

  INSERT INTO transactions (engagement_id, txn_type, amount, deposit_amount)
    VALUES (v_eng_id, 'PURCHASE', p_amount, p_deposit);

  RETURN v_eng_id;
END;
$fn$;

-- ============================================================
-- record_signature
-- ============================================================
CREATE OR REPLACE FUNCTION record_signature(
  p_document_id uuid,
  p_party_role  text,
  p_typed_name  text,
  p_ip          text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_eng_id  uuid;
  v_signer  uuid;
  v_need    integer;
  v_have    integer;
  v_status  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT engagement_id INTO v_eng_id FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- the contact who plays this party_role on the document's engagement
  SELECT contact_id INTO v_signer FROM engagement_parties
    WHERE engagement_id = v_eng_id AND party_role = p_party_role
    ORDER BY signer_order NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no % party on this document''s engagement', p_party_role;
  END IF;

  -- one sealed signature per (document, signer, role); ignore a duplicate sign
  INSERT INTO signatures (document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, method)
    VALUES (p_document_id, v_signer, p_party_role, p_typed_name, now(), p_ip, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  -- executed once every signer party has signed
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng_id;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL;

  IF v_need > 0 AND v_have >= v_need THEN
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date
      WHERE id = p_document_id AND status <> 'EXECUTED';
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$fn$;
