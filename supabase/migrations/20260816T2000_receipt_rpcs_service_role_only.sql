-- CASHCONFIRM flagged (not fixed, correctly out of its scope): claim_receipt_send
-- and log_receipt_send are EXECUTE-able by anon AND authenticated, with no
-- internal guard of any kind -- no auth.uid() check, no role check. An
-- unauthenticated caller could claim a receipt send (suppressing a real receipt)
-- or write false delivery rows into the audit trail.
--
-- Both are called ONLY server-side, from api/_lib/receipt.ts, and every caller
-- (stripe-webhook.ts, zelle-reconcile.ts, send-order-receipt.ts) passes the
-- service-role client from getSupabaseAdmin(). anon and authenticated access is
-- pure surplus; service_role bypasses grants entirely, so revoking costs nothing.
--
-- Revoking from the ROLES directly, not just PUBLIC: a REVOKE aimed at PUBLIC
-- does not remove a direct grant, which is how these survived earlier sweeps and
-- how four partystaging RPCs shipped anon-executable on 2026-08-15.
REVOKE EXECUTE ON FUNCTION public.claim_receipt_send(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_receipt_send(uuid, text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
