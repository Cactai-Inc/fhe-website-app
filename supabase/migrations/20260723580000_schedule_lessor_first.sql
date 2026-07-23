-- Schedule (week grid): put Lessor before Lessee in the parties order to match the
-- rest of the contract UI. This reorders the stored `parties` array (and the days
-- object key order, cosmetically) for existing lease documents that still have the
-- old Lessee-first order; day selections are preserved. New documents get the new
-- default from the client (DEFAULT_WEEK). Then re-compose affected documents.

WITH affected AS (
  SELECT cf.id, cf.document_id, cf.structured
    FROM contract_fields cf
   WHERE cf.field_key = 'TXN.DAYS_USED'
     AND cf.structured ? 'parties'
     AND (cf.structured -> 'parties') @> '["Lessee","Lessor"]'::jsonb
     AND (cf.structured -> 'parties' ->> 0) = 'Lessee'
)
UPDATE contract_fields cf
   SET structured = jsonb_set(cf.structured, '{parties}', '["Lessor","Lessee"]'::jsonb),
       updated_at = now()
  FROM affected a
 WHERE cf.id = a.id;

-- Re-compose every document we touched so the merged body reflects the new order.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT document_id FROM contract_fields
     WHERE field_key = 'TXN.DAYS_USED'
       AND (structured -> 'parties' ->> 0) = 'Lessor'
  LOOP
    PERFORM remerge_contract_from_clauses(r.document_id);
  END LOOP;
END $$;
