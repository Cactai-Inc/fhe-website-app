-- disc_43 (fix round item 3): delete the two unsigned V2 Horse Sale and Purchase
-- drafts, and couple invitation deletion so a redeemed invitation's account
-- survives the document going away.
--
-- WHY THE FK CHANGE FIRST. invitations.document_id referenced documents(id) with
-- NO ACTION, so deleting a document that an invitation points at was blocked —
-- and one of the two invitations here was REDEEMED by Abby Little, whose account
-- is active. ON DELETE SET NULL is what makes the delete safe: the invitation row
-- and the account it created both survive; only the (now meaningless) link to the
-- deleted draft is cleared.
--
-- WHAT IS DELETED (dumped out-of-repo first — see the fix-round report):
--   documents 80537662-7b4e-4adc-9ebc-49ed9d2bed78 (DOC-BW29HG67WR, Kamryn Herrera)
--             2d62b243-f2b2-459a-8f73-92d9f9b0359d (DOC-AHWQBHFKQ8, Abby Little)
--   both AWAITING_SIGNATURE (never executed). Cascade removes contract_fields,
--   contract_change_log, contract_notes, document_horses, document_opened,
--   document_parties, document_party_controls. The two placeholder signatures
--   (signed_at NULL) are RESTRICT, so they are deleted explicitly first. The two
--   invitations are SET NULL (rows kept, document_id cleared).

ALTER TABLE invitations DROP CONSTRAINT invitations_document_id_fkey;
ALTER TABLE invitations
  ADD CONSTRAINT invitations_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

DELETE FROM signatures
 WHERE document_id IN ('80537662-7b4e-4adc-9ebc-49ed9d2bed78',
                       '2d62b243-f2b2-459a-8f73-92d9f9b0359d');

DELETE FROM documents
 WHERE id IN ('80537662-7b4e-4adc-9ebc-49ed9d2bed78',
              '2d62b243-f2b2-459a-8f73-92d9f9b0359d');
