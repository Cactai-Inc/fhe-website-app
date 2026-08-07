-- TASK-SIGREAD: a signer who is not the document owner cannot read their own
-- signature row. signatures_select only has an is_admin() / caller_owns_document()
-- OR-arm; there is no signer-self clause. Mirrors document_parties_self_read
-- (TASK-PARTYRLS, 20260806130000): one additional permissive SELECT policy,
-- OR'd with the existing one, granting a signer read access to their own rows.
CREATE POLICY signatures_self_read
  ON signatures
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND signer_contact_id = current_contact_id());
