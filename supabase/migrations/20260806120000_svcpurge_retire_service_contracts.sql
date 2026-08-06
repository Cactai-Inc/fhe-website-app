/*
  # TASK SVCPURGE — retire the six service contract templates

  Owner ruling 2026-08-05: the six service contracts are not in use and will not
  be. Their language was redrafted into the standalone categorical documents
  (releases / policies / authorizations). Full removal — git history is the archive.

  Removed keys (contract_templates.template_key):
    HORSE_TRAINING, HORSE_EXERCISE, HORSEMANSHIP_TRAINING,
    HORSE_EVALUATION, RIDER_LESSON, RIDER_LESSON_JUMPER

  NOT TOUCHED — read this before editing:
    * EVALUATION_LIABILITY_WAIVER is a RELEASE, not a service contract. It keeps
      service_type = 'HORSE_EVALUATION' (that is the SERVICE, not this template),
      and contract_requirements still maps HORSE_EVALUATION -> that waiver.
    * The SERVICE TYPES that share these names (service_types.code,
      offerings.service_type, contract_requirements.service_type,
      activity_checklists.service_type) are LIVE — 32 active offerings sell them.
      Only the contract TEMPLATES are retired, never the services.
    * audit_logs rows mentioning these keys are the historical record. Untouched.

  Safety: every DELETE below is preceded by an assert. If ANY document row exists
  against ANY of the six templates the migration RAISES and rolls back — nothing
  is deleted. documents.template_id -> contract_templates(id) is ON DELETE
  RESTRICT, so the database itself is a second, independent backstop.

  Service Definition documents (the replacement concept) are a SEPARATE upcoming
  build. This migration only removes.
*/

DO $$
DECLARE
  k_purge  text[] := ARRAY['HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING',
                           'HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER'];
  r        record;
  n        bigint;
BEGIN
  ------------------------------------------------------------------ guard 0
  -- The protected release must never appear in the purge set.
  IF 'EVALUATION_LIABILITY_WAIVER' = ANY (k_purge) THEN
    RAISE EXCEPTION 'SVCPURGE ABORT: EVALUATION_LIABILITY_WAIVER is a RELEASE and must never be purged';
  END IF;

  ------------------------------------------------------------------ guard 1
  -- Exactly the six templates must be present. Fewer means the purge set drifted
  -- from reality; abort rather than delete a partial/renamed set.
  SELECT count(*) INTO n FROM contract_templates WHERE template_key = ANY (k_purge);
  IF n <> 6 THEN
    RAISE EXCEPTION 'SVCPURGE ABORT: expected 6 target templates, found %', n;
  END IF;

  ------------------------------------------------------------------ guard 2
  -- ZERO DOCUMENTS PER KEY. Counts EVERY documents row — drafts, executed,
  -- voided, archived and soft-deleted (deleted_at IS NOT NULL) alike.
  FOR r IN
    SELECT t.template_key, count(d.id) AS doc_count
    FROM contract_templates t
    LEFT JOIN documents d ON d.template_id = t.id
    WHERE t.template_key = ANY (k_purge)
    GROUP BY t.template_key
  LOOP
    IF r.doc_count <> 0 THEN
      RAISE EXCEPTION
        'SVCPURGE ABORT: template % has % document row(s) — refusing to delete a template with documents',
        r.template_key, r.doc_count;
    END IF;
    RAISE NOTICE 'SVCPURGE assert: % — 0 documents', r.template_key;
  END LOOP;

  ------------------------------------------------------------------ guard 3
  -- No live wiring may point at these keys. Any hit means the template is still
  -- referenced by the requirement/assignment matrices — abort, do not work around.
  SELECT count(*) INTO n FROM contract_requirements WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % contract_requirements row(s) reference the purge set', n; END IF;

  SELECT count(*) INTO n FROM contract_role_documents WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % contract_role_documents row(s) reference the purge set', n; END IF;

  SELECT count(*) INTO n FROM category_document_requirements WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % category_document_requirements row(s) reference the purge set', n; END IF;

  SELECT count(*) INTO n FROM contact_required_documents WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % contact_required_documents row(s) reference the purge set', n; END IF;

  SELECT count(*) INTO n FROM invitations WHERE template_keys && k_purge;
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % invitation(s) still request one of the purge set', n; END IF;

  RAISE NOTICE 'SVCPURGE: all guards passed — 6 templates, 0 documents, 0 live references';
END $$;

-- ─────────────────────────────────────────────────────────────────── deletes
-- Clause-engine defs. The six are flat-body templates and hold ZERO def rows
-- (verified pre-migration); these statements are the belt-and-braces sweep so
-- the key leaves no def residue in any environment.
DELETE FROM contract_field_defs
 WHERE template_key IN ('HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING',
                        'HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER');

DELETE FROM contract_clause_defs
 WHERE template_key IN ('HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING',
                        'HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER');

DELETE FROM contract_section_defs
 WHERE template_key IN ('HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING',
                        'HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER');

/*
  Directional token overrides for the retired HORSE_EVALUATION *contract* (6 rows).
  generate_document resolves these with `tv.template_key = p_template_key`, so
  once the HORSE_EVALUATION template is gone they are unreachable orphans.
  They are NOT the waiver's: EVALUATION_LIABILITY_WAIVER has its own template_key
  and zero variant rows, and its body uses no {{DIR.*}} tokens.

  Exact contents, for reversibility:
    (HORSE_EVALUATION, lessee, LEASE_IN,  {"ROLE_TERM":"lessee","DIRECTION_TERM":"lease (lessee)"})
    (HORSE_EVALUATION, owner,  LEASE_OUT, {"ROLE_TERM":"lessor","DIRECTION_TERM":"lease (lessor)"})
    (HORSE_EVALUATION, lessor, LEASE_OUT, {"ROLE_TERM":"lessor","DIRECTION_TERM":"lease (lessor)"})
    (HORSE_EVALUATION, seller, SELL,      {"ROLE_TERM":"seller","DIRECTION_TERM":"sale"})
    (HORSE_EVALUATION, buyer,  BUY,       {"ROLE_TERM":"buyer","DIRECTION_TERM":"purchase"})
    (HORSE_EVALUATION, owner,  SELL,      {"ROLE_TERM":"seller","DIRECTION_TERM":"sale"})
  HORSE_SEARCH_RETAINER's and HORSE_TRANSACTION_REP's variants are untouched.
*/
DELETE FROM template_variants
 WHERE template_key IN ('HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING',
                        'HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER');

-- The template rows themselves. template_tokens (87 rows) cascade via
-- template_tokens.template_id ON DELETE CASCADE.
DELETE FROM contract_templates
 WHERE template_key IN ('HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING',
                        'HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER');

-- ──────────────────────────────────────────────────────────── post-conditions
DO $$
DECLARE
  k_purge text[] := ARRAY['HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING',
                          'HORSE_EVALUATION','RIDER_LESSON','RIDER_LESSON_JUMPER'];
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM contract_templates WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % target template(s) survived the delete', n; END IF;

  SELECT count(*) INTO n FROM contract_section_defs WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % section def(s) survived', n; END IF;

  SELECT count(*) INTO n FROM contract_clause_defs WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % clause def(s) survived', n; END IF;

  SELECT count(*) INTO n FROM contract_field_defs WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % field def(s) survived', n; END IF;

  SELECT count(*) INTO n FROM template_variants WHERE template_key = ANY (k_purge);
  IF n <> 0 THEN RAISE EXCEPTION 'SVCPURGE ABORT: % template variant(s) survived', n; END IF;

  -- The protected release, and the live service rows, must still be there.
  SELECT count(*) INTO n FROM contract_templates WHERE template_key = 'EVALUATION_LIABILITY_WAIVER';
  IF n <> 1 THEN RAISE EXCEPTION 'SVCPURGE ABORT: EVALUATION_LIABILITY_WAIVER missing after purge (found %)', n; END IF;

  SELECT count(*) INTO n FROM contract_requirements WHERE service_type = 'HORSE_EVALUATION' AND template_key = 'EVALUATION_LIABILITY_WAIVER';
  IF n <> 1 THEN RAISE EXCEPTION 'SVCPURGE ABORT: HORSE_EVALUATION -> EVALUATION_LIABILITY_WAIVER requirement lost (found %)', n; END IF;

  SELECT count(*) INTO n FROM service_types WHERE code = ANY (ARRAY['HORSE_TRAINING','HORSE_EXERCISE','HORSEMANSHIP_TRAINING','HORSE_EVALUATION']);
  IF n <> 4 THEN RAISE EXCEPTION 'SVCPURGE ABORT: live service_types disturbed (found % of 4)', n; END IF;

  RAISE NOTICE 'SVCPURGE: complete — 6 templates removed, waiver + service types intact';
END $$;
