-- CONTRACTORPHAN Part 1 — delete the two orphaned Beaumont documents.
--
-- Both rows carry contract_id = ae4ffe95-4662-4813-a16c-e7b5b5f325a4, which has no
-- row in `contracts`, while documents_contract_id_fkey reports convalidated = true.
--
--   0360f829-4c31-4dc0-9b95-3489ee9a71cb  DOC-3EVT7RBBZC  RELEASE_HORSE_CARE   horse: Beau
--   fb6abc6c-ef34-4d80-b731-543eaa40ac71  DOC-84AAB8KDWT  HORSE_EMERGENCY_VET  horse: Beau
--
-- Both are AWAITING_SIGNATURE / ready_to_sign and carry no signature at all. They are
-- ARMED: signing either one ERRORS. The signing flow updates the row more than once in
-- one transaction, and Postgres skips the FK re-check only for row versions created by
-- OTHER transactions — so the second same-transaction update re-runs the check against
-- the missing parent and aborts the whole thing.
--
-- Owner ruling 2026-08-10: "delete entirely". Not NULL the contract_id, not regenerate.
--
-- DELETE MEANS THE REPO'S SOFT-DELETE CONVENTION (documents.deleted_at). A hard delete
-- is NOT required to clear the FK situation: `deleted_at` is the same mechanism
-- ensure_horse_documents already uses to sweep unsigned pending documents, and a single
-- UPDATE that does not touch contract_id does not re-run the FK check (the RI trigger
-- fires only when the referencing column is modified). Proven by dry-run.
--
-- The UPDATE is guarded by all four preconditions inline, so if production state has
-- moved on since 2026-08-10 this migration matches zero rows and writes nothing rather
-- than deleting something the ruling was not made about.

-- ---------------------------------------------------------------------------
-- 1. Vocabulary for the cleanup trail.
--
-- is_true_status = false ON PURPOSE. log_status_event() does a second
-- `UPDATE documents SET current_status = …` for any code flagged true — which on these
-- very rows is the second same-transaction update that triggers the FK re-check and
-- aborts. A cleanup is an ops event about the record, not a stage of the contract
-- lifecycle, so it belongs with 'sent' / 'viewed' / 'downloaded' as a sub-status.
-- ---------------------------------------------------------------------------
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('document', 'cleaned_up', 'Removed by cleanup', false, false, 70)
ON CONFLICT (entity_type, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Soft-delete both rows and write the trail, in one guarded statement.
--    Only rows that were actually updated get a status_events row.
-- ---------------------------------------------------------------------------
WITH victim AS (
  SELECT d.id, d.org_id, d.display_code, d.title, d.contract_id, d.horse_id
    FROM documents d
   WHERE d.id IN (
           '0360f829-4c31-4dc0-9b95-3489ee9a71cb',
           'fb6abc6c-ef34-4d80-b731-543eaa40ac71'
         )
     AND d.deleted_at IS NULL
     -- (1) status is AWAITING_SIGNATURE
     AND d.status = 'AWAITING_SIGNATURE'
     -- (3) not executed / void / terminated, by status, workflow_state or timestamp
     AND d.workflow_state NOT IN ('executed', 'void', 'terminated')
     AND d.voided_at IS NULL
     AND d.terminated_at IS NULL
     -- (2) zero live signatures
     AND NOT EXISTS (
           SELECT 1 FROM signatures s
            WHERE s.document_id = d.id AND s.deleted_at IS NULL)
     -- (4) the referenced contract is still absent
     AND d.contract_id IS NOT NULL
     AND NOT EXISTS (
           SELECT 1 FROM contracts c WHERE c.id = d.contract_id)
),
gone AS (
  UPDATE documents d
     SET deleted_at = now()
    FROM victim v
   WHERE d.id = v.id
  RETURNING d.id, d.org_id, v.display_code, v.title, v.contract_id, v.horse_id
)
INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
SELECT g.org_id,
       'document',
       g.id,
       'cleaned_up',
       'CONTRACTORPHAN: ' || g.display_code || ' (' || coalesce(g.title, 'untitled')
         || ', horse ' || coalesce((SELECT coalesce(h.nickname, h.registered_name)
                                      FROM horses h WHERE h.id = g.horse_id), 'none')
         || ') removed. Reason: contract_id ' || g.contract_id::text
         || ' has no row in contracts, so the document could not be signed — the'
         || ' foreign-key re-check aborts the signing transaction. AWAITING_SIGNATURE'
         || ' with zero signatures; no evidence destroyed. Owner ruling 2026-08-10.',
       auth.uid()
FROM gone g;
