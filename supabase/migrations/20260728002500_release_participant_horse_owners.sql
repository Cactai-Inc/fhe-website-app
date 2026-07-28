-- RELEASE_PARTICIPANT: Released Parties definition now covers the owners,
-- lessors, and lessees of any horse used in or present during COMPANY's
-- activities (owner edit, synced from supabase/contract_templates/
-- RELEASE_PARTICIPANT.md). Drift-checked first: the file and the live body
-- were otherwise identical (sole other difference: a trailing blank line in
-- the DB body, preserved). Sentence-level replace, not a body overwrite.
-- Executed release documents are unaffected (flat documents snapshot their
-- body at generation); new signings get the extended definition.

BEGIN;

UPDATE contract_templates SET
  body = replace(body,
    'For purposes of this Agreement, "Released Parties" means COMPANY, its owners, employees, instructors, assistant instructors, trainers, volunteers, independent contractors, agents, representatives, affiliates, property owners, facility owners, licensors, lessors, lessees, hosts, landowners, successors, assigns, heirs, and any person acting on behalf of COMPANY at any location where it is authorized to conduct business.',
    'For purposes of this Agreement, "Released Parties" means COMPANY, its owners, employees, instructors, assistant instructors, trainers, volunteers, independent contractors, agents, representatives, affiliates, property owners, facility owners, licensors, lessors, lessees, hosts, landowners, the owners, lessors, and lessees of any horse used in or present during COMPANY''s activities, successors, assigns, heirs, and any person acting on behalf of COMPANY at any location where it is authorized to conduct business.'),
  version = version + 1,
  updated_at = now()
WHERE template_key = 'RELEASE_PARTICIPANT';

DO $$
DECLARE v_body text;
BEGIN
  SELECT body INTO v_body FROM contract_templates WHERE template_key='RELEASE_PARTICIPANT';
  IF v_body NOT LIKE '%the owners, lessors, and lessees of any horse used in or present during COMPANY''s activities%' THEN
    RAISE EXCEPTION 'Released Parties extension did not apply';
  END IF;
  IF (SELECT count(*) FROM regexp_matches(v_body, 'Released Parties" means COMPANY', 'g')) <> 1 THEN
    RAISE EXCEPTION 'definition sentence count unexpected';
  END IF;
END $$;

COMMIT;
