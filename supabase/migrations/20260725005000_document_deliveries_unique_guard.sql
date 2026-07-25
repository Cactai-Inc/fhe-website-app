-- Harden signed-document email delivery against duplicate sends.
--
-- deliver-documents / deliver-document guard against re-sending an executed
-- document to the same recipient with a soft SELECT-then-skip on
-- document_deliveries. That guard is race-prone and, if a delivery row is ever
-- removed, lets a re-open of an EXECUTED contract (ContractPage fires on mount)
-- resend the email. This adds the missing HARD guard: a unique index on
-- (document_id, recipient_contact_id, channel) over live rows, so a duplicate
-- delivery is impossible at the database level regardless of the app path.
--
-- Partial (deleted_at IS NULL) so a soft-deleted delivery doesn't block a
-- legitimate re-issue. No current duplicates exist (verified), so this creates
-- cleanly.

CREATE UNIQUE INDEX IF NOT EXISTS document_deliveries_doc_recipient_channel_uidx
  ON public.document_deliveries (document_id, recipient_contact_id, channel)
  WHERE deleted_at IS NULL;
