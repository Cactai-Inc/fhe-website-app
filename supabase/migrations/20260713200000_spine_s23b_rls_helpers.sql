/*
  # Spine Refactor — Slice 2.3b: RLS helpers off engagements

  Redefine the ownership/read RLS predicates to derive from the spine
  (ownership/lease + documents.contact_id + contracts/contract_parties) instead
  of engagements, so horse + document visibility survives the engagements drop.
  CREATE OR REPLACE preserves every policy that references these helpers.

  Safe: 0 horses exist and 0 engagements carry a horse (the engagement branch was
  already dead); documents are contact-owned (contact_id backfilled). caller_owns_
  engagement is left as-is and drops in S2.3e with engagements.
*/

-- a document the caller owns = a document that belongs to their contact
CREATE OR REPLACE FUNCTION caller_owns_document(doc_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = doc_id
      AND d.deleted_at IS NULL
      AND d.contact_id = current_contact_id()
  );
$$;

-- a horse the caller owns = they are its current owner or lessee
CREATE OR REPLACE FUNCTION caller_owns_horse(h_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (h.current_owner_contact_id = current_contact_id()
           OR h.lessee_contact_id = current_contact_id())
  );
$$;

-- a horse the caller may READ = they own/lease it, OR a document or contract of
-- theirs references it (lease/purchase/sale deal party, care/lesson doc)
CREATE OR REPLACE FUNCTION client_can_read_horse(h_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (
        h.current_owner_contact_id = current_contact_id()
        OR h.lessee_contact_id = current_contact_id()
        OR EXISTS (SELECT 1 FROM documents d
                    WHERE d.horse_id = h.id AND d.deleted_at IS NULL
                      AND d.contact_id = current_contact_id())
        OR EXISTS (SELECT 1 FROM contracts c
                    JOIN contract_parties cp ON cp.contract_id = c.id
                    WHERE c.horse_id = h.id AND c.deleted_at IS NULL
                      AND cp.contact_id = current_contact_id())
      )
  );
$$;
