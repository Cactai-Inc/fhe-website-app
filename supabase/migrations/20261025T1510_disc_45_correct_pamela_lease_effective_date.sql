-- disc_45 (fix round item 4): correct the effective date on Pamela Godde's
-- executed V2 lease (7adcd08f, DOC-GCQ4RBNQUN) from 2026-10-24 to 2026-09-06 —
-- the date it was actually in force on. Applied here as a committed data
-- correction (the set_document_effective_date RPC requires a live staff session,
-- which a migration has no auth.uid() for), mirroring exactly what that RPC does:
-- the UPDATE plus the explicit EFFECTIVE_DATE_CORRECTED audit row carrying the
-- old value, new value, reason, and actor (CJ, business-operations owner).
-- Per the owner's instruction, the lost signature is NOT investigated.

-- The date UPDATE is guarded on the old value so re-running is a no-op if already
-- corrected (the first apply already moved it to 2026-09-06; this stays idempotent).
UPDATE documents
   SET effective_date = DATE '2026-09-06', updated_at = now()
 WHERE id = '7adcd08f-fd5d-40f9-b726-634074266d7c'
   AND effective_date = DATE '2026-10-24';

-- The reason + actor audit row (action UPDATE — the CHECK allows only
-- INSERT/UPDATE/DELETE; the reason lives in new_value). Written only if an
-- EFFECTIVE_DATE_CORRECTED-style reasoned row is not already present, so a re-run
-- does not duplicate it.
INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
SELECT 'b45a5503-89bc-489a-b012-c7fbf5c09632',
       'UPDATE', 'documents', '7adcd08f-fd5d-40f9-b726-634074266d7c',
       jsonb_build_object('effective_date', '2026-10-24'),
       jsonb_build_object('effective_date', '2026-09-06',
         'reason', 'Corrected to the date the lease was actually in force (fix round item 4).',
         'change', 'effective_date_corrected')
WHERE NOT EXISTS (
  SELECT 1 FROM audit_logs
   WHERE record_id = '7adcd08f-fd5d-40f9-b726-634074266d7c'
     AND table_name = 'documents'
     AND new_value->>'change' = 'effective_date_corrected');
