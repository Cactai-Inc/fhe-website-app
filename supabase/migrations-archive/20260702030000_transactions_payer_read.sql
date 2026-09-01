/*
  # FHE Suite — transactions payer read (LANE-2, client balances)

  Closes a legitimate client-read gap found while building /app/balance:

    transactions_read (migration 22) grants SELECT via
      is_admin() OR caller_owns_engagement(engagement_id)
    but settlement roll-up invoices (migration 20260630140000) may carry
    engagement_id = NULL (lines spanning several engagements, or un-tied
    fee/consumption lines). caller_owns_engagement(NULL) is false, so the very
    client whose open billable_lines were rolled into that INVOICE could never
    read it — even though the row records them as payer_contact_id and their
    billable_lines already grant them read of the settled source lines
    (billable_lines_client_read, payer_contact_id = current_contact_id()).

  Fix: ONE additive PERMISSIVE SELECT policy — the payer reads their own
  transactions. It ORs with the existing engagement-owner read inside the
  RESTRICTIVE org boundary (transactions_org_boundary, migration 26), so it
  never widens access across tenants and grants no write of any kind.
*/

DROP POLICY IF EXISTS transactions_payer_read ON transactions;
CREATE POLICY transactions_payer_read ON transactions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND payer_contact_id IS NOT NULL
    AND payer_contact_id = current_contact_id()
  );
