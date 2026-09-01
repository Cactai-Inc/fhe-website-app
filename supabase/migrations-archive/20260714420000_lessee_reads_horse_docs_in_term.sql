/*
  # Lessee reads the horse's documents during the lease term

  Owner rule (item 4): the lessee sees EVERYTHING — the horse record and its
  documents (vet auth, care release) — until the lease term concludes; after
  that, only the contract persists.

  documents_select was is_admin() OR caller_owns_document(id). The lessee is not
  a party to the owner-signed vet/care docs, so they couldn't read them. We add a
  horse-scoped path: a client who can currently read the horse (client_can_read_
  horse is already lease-term-scoped — owner always, others only while the lease
  is active) can read that horse's documents. After lease_end the horse read
  falls away, so the lessee loses the vet/care docs — but keeps the lease
  CONTRACT, which they can still read as a document party (caller_owns_document),
  independent of the horse.
*/

DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR caller_owns_document(id)
    OR (horse_id IS NOT NULL AND client_can_read_horse(horse_id))
  );
