-- ─────────────────────────────────────────────────────────────────────────────
-- LATENT DEFECT FOUND WHILE PROVING THIS BATCH — missing table grants.
--
-- `contract_change_requests` and `contract_change_log` each carry a correct RLS
-- policy but have NO grant to `authenticated`:
--
--   contract_change_requests  policy contract_change_requests_read  (SELECT)
--   contract_change_log       policy contract_change_log_read       (SELECT)
--
-- Grants were lost for contract_change_requests in the 20260729040000 ALTER TABLE
-- RENAME (a rename keeps grants, but this table's were never present on the
-- pre-rename object either), and contract_change_log has never had them. With no
-- grant, `authenticated` is refused before RLS is ever consulted, so the policies
-- are dead letter:
--
--   ERROR: permission denied for table contract_change_log
--
-- NOTHING IN THE APP WAS BROKEN, because every read path goes through a
-- SECURITY DEFINER RPC (contract_change_requests_list, contract_change_log_list),
-- which runs as the owner and bypasses the grant. The defect only surfaces on a
-- direct PostgREST read — and it would surface the moment anyone added one.
--
-- Granting SELECT is safe precisely because the policies already exist and are
-- correct: staff-in-org, or a party to the document. The grant makes the written
-- policy the thing that actually decides, instead of a blanket refusal.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

GRANT SELECT ON public.contract_change_requests TO authenticated;
GRANT SELECT ON public.contract_change_log      TO authenticated;

-- assert both policies are in place, so the grant can never widen access beyond
-- what RLS already restricts
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE tablename='contract_change_requests' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'contract_change_requests has no SELECT policy — refusing to grant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE tablename='contract_change_log' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'contract_change_log has no SELECT policy — refusing to grant';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.contract_change_requests'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.contract_change_log'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on one of these tables — refusing to grant';
  END IF;
END
$do$;

COMMIT;
