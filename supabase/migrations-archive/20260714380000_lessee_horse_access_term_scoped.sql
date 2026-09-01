/*
  # Time-scope a lessee's horse-record access to the lease term

  Owner rule: the lessee sees the full horse record for the DURATION of the lease;
  after the term ends, only the executed lease contract remains visible to them.

  client_can_read_horse governs record visibility. The OWNER always sees the
  record. Every other path (lessee pointer, being the contact on a horse doc,
  being a party to a horse contract) is now gated on the lease being active
  (lease_end NULL or in the future). After lease_end passes, those grants fall
  away, so the lessee loses the record. The lease CONTRACT itself is a document
  the lessee is a party to — its visibility is governed by document RLS, NOT this
  predicate — so it stays visible to them. A non-lease horse (sale, or no lease)
  has lease_end NULL, so the active-window is always open and nothing changes.
*/

CREATE OR REPLACE FUNCTION public.client_can_read_horse(h_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (
        -- the OWNER always sees the record
        h.current_owner_contact_id = current_contact_id()
        -- everyone else only while the lease is active (term not ended)
        OR (
          (h.lease_end IS NULL OR h.lease_end >= current_date)
          AND (
            h.lessee_contact_id = current_contact_id()
            OR EXISTS (SELECT 1 FROM documents d
                        WHERE d.horse_id = h.id AND d.deleted_at IS NULL
                          AND d.contact_id = current_contact_id())
            OR EXISTS (SELECT 1 FROM contracts c
                        JOIN contract_parties cp ON cp.contract_id = c.id
                        WHERE c.horse_id = h.id AND c.deleted_at IS NULL
                          AND cp.contact_id = current_contact_id())
          )
        )
      )
  );
$function$;
