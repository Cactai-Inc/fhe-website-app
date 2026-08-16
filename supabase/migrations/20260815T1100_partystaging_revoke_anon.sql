-- PARTYSTAGING follow-up: revoke the direct anon grants its four new RPCs
-- received. The migration wrote `REVOKE ALL ... FROM PUBLIC` before granting to
-- authenticated, service_role -- but anon held a DIRECT grant (anon=X/postgres
-- in proacl), and a revoke aimed at PUBLIC does not touch a direct grant. This
-- is the repo's documented silent-no-op trap (LESSONS.md); three earlier revokes
-- did nothing for the same reason.
--
-- Not exploitable today: all four raise 'authentication required' when
-- auth.uid() is null (verified). This aligns the grant surface with their own
-- siblings -- add_contract_composition, remove_contract_composition,
-- propose_clause and resolve_field_edit all correctly deny anon -- so defence in
-- depth does not rest on the body check alone.
REVOKE EXECUTE ON FUNCTION public.propose_contract_composition(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_pending_composition(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_pending_composition(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_contract_composition(uuid, text, jsonb) FROM anon;
