-- Expose the termination lifecycle fields on the contract_document_detail payload
-- so the UI can render the pending-termination banner, the Terminated status, and
-- gate the per-party Archive control.

-- Rebuild only the 'document' jsonb object by patching the function. We fetch the
-- current definition and re-create it with the extra keys appended to the document
-- object. (Idempotent: uses jsonb_build_object with the new keys.)
DO $migration$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('contract_document_detail(uuid)'::regprocedure) INTO v_def;
  v_def := replace(
    v_def,
    E'''horse_section_confirmed_by'', d.horse_section_confirmed_by)',
    E'''horse_section_confirmed_by'', d.horse_section_confirmed_by,\n        ''terminated_at'', d.terminated_at,\n        ''termination_requested_at'', d.termination_requested_at,\n        ''termination_requested_by'', d.termination_requested_by,\n        ''termination_request_reason'', d.termination_request_reason,\n        ''effective_date'', d.effective_date)'
  );
  EXECUTE v_def;
END
$migration$;
