-- VALIDATION ROUND — F6: the deal page can attach a horse to the whole deal.
--
-- A deal exists without a horse (a document needs no horse to exist — the horse is
-- a signing blocker, same staging rule as the contract page). But the deal page had
-- no way to attach one: it only DISPLAYED deal.horse when present. So a deal whose
-- documents were added with no horse (add_deal_document only inherits a horse when
-- the governing contract already has one) could never get a horse, and a deal whose
-- seller/lessor owns a horse showed no horse to attach — because there was no attach
-- control at all.
--
-- This migration gives the deal the DATA its attach card needs and the ACTION it
-- calls:
--   1. deal_detail: each document now carries its horse_id, and the deal carries an
--      owner_seat (the SELLER on a sale / LESSOR on a lease — the party whose horse
--      the instrument is about), so the card can offer only that contact's horses
--      and know which documents still need a horse.
--   2. attach_horse_to_deal(deal_id, horse_id): staff-only; attaches the horse to
--      EVERY document on the deal that has none (reusing attach_horse_to_document,
--      which fills the HORSE.* fields from the record). The horse must be owned by
--      the owner-seat party — defence in depth behind the card's own filter.

BEGIN;

-- ── 1. deal_detail: add horse_id per document + the owner_seat object ────────────
DO $dd$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.deal_detail'::regproc) INTO v_def;

  -- a) per-document horse_id — add it right after 'template_key'.
  IF position('''horse_id'', d.horse_id' IN v_def) = 0 THEN
    v_def := replace(v_def,
      '''template_key'', t.template_key, ''status'', d.status,',
      '''template_key'', t.template_key, ''status'', d.status, ''horse_id'', d.horse_id,');
  END IF;

  -- b) the owner_seat — the SELLER/LESSOR party of this deal (role + contact). Added
  --    just before the 'documents' key so it sits in the same object.
  IF position('''owner_seat''' IN v_def) = 0 THEN
    v_def := replace(v_def,
      '    ''documents'', coalesce((',
      '    ''owner_seat'', ('
   || '      SELECT jsonb_build_object(''party_role'', cp.party_role,'
   || '               ''contact_id'', cp.contact_id,'
   || '               ''name'', nullif(btrim(concat_ws('' '', c.first_name, c.last_name)), ''''))'
   || '      FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id'
   || '     WHERE cp.contract_id = v_deal.contract_id'
   || '       AND cp.party_role = v_roles[1]'
   || '     ORDER BY cp.signer_order, cp.id LIMIT 1),' || chr(10)
   || '    ''documents'', coalesce((');
  END IF;

  EXECUTE v_def;
END $dd$;

-- ── 2. attach_horse_to_deal: attach to every hornless document on the deal ───────
CREATE OR REPLACE FUNCTION public.attach_horse_to_deal(p_deal_id uuid, p_horse_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_deal   deals%ROWTYPE;
  v_roles  text[];
  v_owner  uuid;         -- the owner-seat party's contact
  v_horse  horses%ROWTYPE;
  v_doc    uuid;
  v_n      integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to attach a horse'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.org_id <> current_org() THEN RAISE EXCEPTION 'not authorized for this deal'; END IF;

  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown horse: %', p_horse_id; END IF;
  IF v_horse.org_id <> current_org() THEN RAISE EXCEPTION 'horse is not in this organization'; END IF;

  -- The owner-seat party (SELLER on a sale, LESSOR on a lease) owns the instrument's
  -- horse. The card already offers only that contact's horses; enforce it here too.
  v_roles := deal_party_roles(v_deal.deal_type);
  SELECT cp.contact_id INTO v_owner
    FROM contract_parties cp
   WHERE cp.contract_id = v_deal.contract_id AND cp.party_role = v_roles[1]
   ORDER BY cp.signer_order, cp.id LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'attach the % before attaching a horse', lower(v_roles[1]);
  END IF;
  IF v_horse.current_owner_contact_id IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'that horse is not owned by the %', lower(v_roles[1]);
  END IF;

  -- Attach to every document on the deal that has no horse yet. attach_horse_to_document
  -- fills the HORSE.* fields from the record; a document that already has a horse is
  -- left alone (an addendum does not re-subject the agreement).
  FOR v_doc IN
    SELECT d.id FROM documents d
     WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL
       AND d.horse_id IS NULL
  LOOP
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END $fn$;

REVOKE ALL ON FUNCTION public.attach_horse_to_deal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_horse_to_deal(uuid, uuid) TO authenticated;

COMMIT;
